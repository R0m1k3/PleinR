/**
 * Publication des promotions sur les pages Facebook / LinkedIn de l'association.
 *
 * Les identifiants et jetons viennent de `social-accounts.ts` : base de données
 * en premier (posés depuis Backend › Réseaux sociaux), variables
 * d'environnement en repli.
 *
 * Si un réseau n'est pas configuré, le backoffice masque simplement sa case :
 * le reste du site fonctionne normalement.
 */

import {
  refreshLinkedInIfNeeded,
  resolveCredentials,
  publicBaseUrl,
  type SocialNetwork,
} from "./social-accounts";
import { memberPath } from "./seo";

export {
  configuredNetworks,
  isNetworkConfigured,
  SOCIAL_LABELS,
  SOCIAL_NETWORKS,
  type SocialNetwork,
} from "./social-accounts";

const FACEBOOK_GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION?.trim() || "v21.0";
const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION?.trim() || "202506";

// ---- Contenu du post ----

export type PromoForSharing = {
  title: string;
  text: string | null;
  badge: string | null;
  validUntil: string | null;
  imageUrl: string | null;
  memberId: number | null;
  memberName: string | null;
  memberCity?: string | null;
};

export async function promoLink(promo: PromoForSharing): Promise<string | null> {
  const base = await publicBaseUrl();
  if (!base) return null;
  return promo.memberId
    ? `${base}${memberPath({ id: promo.memberId, name: promo.memberName ?? "", city: promo.memberCity })}`
    : `${base}/#promotions`;
}

/** Texte du post, commun aux deux réseaux. */
export async function buildPromoMessage(promo: PromoForSharing): Promise<string> {
  const lines: string[] = [];
  lines.push(promo.badge ? `${promo.badge} — ${promo.title}` : promo.title);
  if (promo.memberName) lines.push(`Chez ${promo.memberName}`);
  if (promo.text?.trim()) lines.push("", promo.text.trim());
  if (promo.validUntil?.trim()) lines.push("", promo.validUntil.trim());
  const link = await promoLink(promo);
  if (link) lines.push("", link);
  lines.push("", "#PleinR #BassinDePompey #CommerceLocal");
  return lines.join("\n");
}

// ---- Image ----

type LoadedImage = { bytes: Uint8Array; contentType: string; fileName: string };

/**
 * Les images de promo sont stockées en data-URI (upload direct depuis l'espace
 * adhérent) ; on accepte aussi une URL absolue au cas où.
 */
export async function loadPromoImage(imageUrl: string | null): Promise<LoadedImage | null> {
  if (!imageUrl) return null;

  const dataMatch = /^data:([^;,]+);base64,(.+)$/s.exec(imageUrl.trim());
  if (dataMatch) {
    const contentType = dataMatch[1];
    const bytes = Uint8Array.from(Buffer.from(dataMatch[2], "base64"));
    return { bytes, contentType, fileName: `promo.${extensionFor(contentType)}` };
  }

  // Volontairement : aucune récupération par URL.
  //
  // `imageUrl` provient d'un champ de formulaire alimenté par l'adhérent. Aller
  // chercher l'adresse qu'il indique donnerait au serveur l'ordre d'appeler une
  // cible arbitraire (SSRF) — services internes, métadonnées d'hébergeur — dont
  // le contenu partirait ensuite sur Facebook ou LinkedIn. Toutes les images de
  // l'application sont des data-URI produites par l'upload, ce chemin est donc
  // le seul légitime.
  return null;
}

function extensionFor(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

function toBlob(image: LoadedImage): Blob {
  // `Uint8Array` → `ArrayBuffer` explicite : évite le SharedArrayBuffer côté types.
  return new Blob([image.bytes.slice().buffer as ArrayBuffer], { type: image.contentType });
}

// ---- Résultat ----

export type PublishResult = { externalId: string | null; url: string | null };

export class SocialPublishError extends Error {}

async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return `HTTP ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 500)}` : ""}`;
}

// ---- Facebook (Graph API, page de l'association) ----

async function publishToFacebook(promo: PromoForSharing, message: string): Promise<PublishResult> {
  const credentials = await resolveCredentials("facebook");
  if (!credentials) throw new SocialPublishError("Facebook n'est pas connecté.");
  const { targetId: pageId, accessToken: token } = credentials;

  const image = await loadPromoImage(promo.imageUrl);
  const base = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/${pageId}`;

  const body = new FormData();
  body.set("access_token", token);

  let endpoint: string;
  if (image) {
    // Photo : on téléverse le binaire directement (les images sont en data-URI,
    // Facebook ne peut donc pas aller les chercher par URL).
    endpoint = `${base}/photos`;
    body.set("caption", message);
    body.set("source", toBlob(image), image.fileName);
  } else {
    endpoint = `${base}/feed`;
    body.set("message", message);
    const link = await promoLink(promo);
    if (link) body.set("link", link);
  }

  const res = await fetch(endpoint, { method: "POST", body });
  if (!res.ok) throw new SocialPublishError(`Facebook: ${await readError(res)}`);

  const json = (await res.json()) as { id?: string; post_id?: string };
  const externalId = json.post_id ?? json.id ?? null;
  return {
    externalId,
    url: externalId ? `https://www.facebook.com/${externalId}` : null,
  };
}

// ---- LinkedIn (Posts API, page organisation) ----

/**
 * Le champ `commentary` utilise le « Little Text Format » : ces caractères
 * doivent être échappés sous peine de rejet de la requête.
 */
function escapeLinkedInText(text: string): string {
  return text.replace(/[|{}@[\]()<>#*_~\\]/g, (c) => `\\${c}`);
}

function linkedinHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

async function uploadLinkedInImage(
  token: string,
  owner: string,
  image: LoadedImage
): Promise<string> {
  const initRes = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST",
    headers: { ...linkedinHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  if (!initRes.ok) throw new SocialPublishError(`LinkedIn (init image): ${await readError(initRes)}`);

  const init = (await initRes.json()) as { value?: { uploadUrl?: string; image?: string } };
  const uploadUrl = init.value?.uploadUrl;
  const imageUrn = init.value?.image;
  if (!uploadUrl || !imageUrn) {
    throw new SocialPublishError("LinkedIn: réponse d'initialisation d'image inattendue.");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": image.contentType },
    body: toBlob(image),
  });
  if (!uploadRes.ok) {
    throw new SocialPublishError(`LinkedIn (upload image): ${await readError(uploadRes)}`);
  }

  return imageUrn;
}

async function publishToLinkedIn(promo: PromoForSharing, message: string): Promise<PublishResult> {
  // Rattrape un jeton proche de l'expiration quand LinkedIn a accordé les
  // jetons de rafraîchissement programmatiques à l'application.
  await refreshLinkedInIfNeeded();

  const credentials = await resolveCredentials("linkedin");
  if (!credentials) throw new SocialPublishError("LinkedIn n'est pas connecté.");
  const { accessToken: token, targetId: owner } = credentials;

  const image = await loadPromoImage(promo.imageUrl);
  const imageUrn = image ? await uploadLinkedInImage(token, owner, image) : null;

  const payload: Record<string, unknown> = {
    author: owner,
    commentary: escapeLinkedInText(message),
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
  if (imageUrn) {
    payload.content = { media: { id: imageUrn, altText: promo.title.slice(0, 200) } };
  }

  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: { ...linkedinHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new SocialPublishError(`LinkedIn: ${await readError(res)}`);

  const externalId = res.headers.get("x-restli-id");
  return {
    externalId,
    url: externalId ? `https://www.linkedin.com/feed/update/${externalId}/` : null,
  };
}

// ---- Point d'entrée ----

export async function publishPromoToNetwork(
  network: SocialNetwork,
  promo: PromoForSharing
): Promise<PublishResult> {
  const message = await buildPromoMessage(promo);
  return network === "facebook"
    ? publishToFacebook(promo, message)
    : publishToLinkedIn(promo, message);
}
