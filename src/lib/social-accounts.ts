import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings, socialAccounts, type SocialAccount, type SocialNetwork } from "@/db/schema";
import { decryptSecret, encryptSecret } from "./crypto";

/**
 * Configuration des comptes Facebook / LinkedIn.
 *
 * Les identifiants d'application et les jetons vivent en base (chiffrés), posés
 * depuis Backend › Réseaux sociaux. Les variables d'environnement restent
 * acceptées en **repli** pour ne pas casser les déploiements antérieurs.
 */

export type { SocialNetwork };

export const SOCIAL_NETWORKS: SocialNetwork[] = ["facebook", "linkedin"];

export const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  facebook: "Facebook",
  linkedin: "LinkedIn",
};

const FACEBOOK_GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION?.trim() || "v21.0";
const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION?.trim() || "202506";

/** Un jeton LinkedIn qui expire dans moins de 7 jours est signalé. */
export const EXPIRY_WARNING_DAYS = 7;

function env(key: string): string {
  return (process.env[key] ?? "").trim();
}

/**
 * URL publique de l'application. Réglée dans Backend › Réseaux sociaux ; les
 * variables d'environnement restent acceptées en repli.
 */
export async function siteUrl(): Promise<string> {
  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, "site_public_url"));
  const stored = (row?.value ?? "").trim();
  return (stored || env("NEXT_PUBLIC_SITE_URL") || env("AUTH_URL")).replace(/\/+$/, "");
}

export async function redirectUri(network: SocialNetwork): Promise<string> {
  return `${await siteUrl()}/api/social/${network}/callback`;
}

// ---- Lecture ----

export async function getSocialAccount(network: SocialNetwork): Promise<SocialAccount | null> {
  const [row] = await db.select().from(socialAccounts).where(eq(socialAccounts.network, network));
  return row ?? null;
}

export async function getSocialAccounts(): Promise<SocialAccount[]> {
  return db.select().from(socialAccounts);
}

export type SocialCredentials = {
  source: "db" | "env";
  accessToken: string;
  targetId: string;
  expiresAt: Date | null;
};

/** Identifiants utilisables pour publier : la base d'abord, l'environnement ensuite. */
export async function resolveCredentials(
  network: SocialNetwork
): Promise<SocialCredentials | null> {
  const account = await getSocialAccount(network);
  if (account?.accessToken && account.targetId) {
    try {
      return {
        source: "db",
        accessToken: decryptSecret(account.accessToken),
        targetId: account.targetId,
        expiresAt: account.expiresAt,
      };
    } catch {
      // Clé de chiffrement changée : on retombe sur l'environnement s'il existe.
    }
  }

  if (network === "facebook") {
    const token = env("FACEBOOK_PAGE_ACCESS_TOKEN");
    const pageId = env("FACEBOOK_PAGE_ID");
    if (token && pageId) return { source: "env", accessToken: token, targetId: pageId, expiresAt: null };
    return null;
  }

  const token = env("LINKEDIN_ACCESS_TOKEN");
  const urn = env("LINKEDIN_ORGANIZATION_URN") ||
    (env("LINKEDIN_ORGANIZATION_ID") ? `urn:li:organization:${env("LINKEDIN_ORGANIZATION_ID")}` : "");
  if (token && urn) return { source: "env", accessToken: token, targetId: urn, expiresAt: null };
  return null;
}

export async function isNetworkConfigured(network: SocialNetwork): Promise<boolean> {
  return (await resolveCredentials(network)) !== null;
}

export async function configuredNetworks(): Promise<SocialNetwork[]> {
  const found = await Promise.all(
    SOCIAL_NETWORKS.map(async (n) => ((await isNetworkConfigured(n)) ? n : null))
  );
  return found.filter((n): n is SocialNetwork => n !== null);
}

/** État d'expiration, pour le bandeau d'alerte du backoffice. */
export type ExpiryStatus = "never" | "ok" | "soon" | "expired";

export function expiryStatus(expiresAt: Date | null | undefined): ExpiryStatus {
  if (!expiresAt) return "never";
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) return "expired";
  return remainingMs <= EXPIRY_WARNING_DAYS * 86_400_000 ? "soon" : "ok";
}

// ---- OAuth ----

export class SocialAuthError extends Error {}

async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return `HTTP ${res.status}${body ? ` — ${body.slice(0, 400)}` : ""}`;
}

const SCOPES: Record<SocialNetwork, string> = {
  facebook: "pages_show_list,pages_manage_posts,pages_read_engagement",
  linkedin: "w_organization_social r_organization_social rw_organization_admin",
};

export async function authorizeUrl(
  network: SocialNetwork,
  appId: string,
  state: string
): Promise<string> {
  const redirect = await redirectUri(network);
  if (network === "facebook") {
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirect,
      state,
      scope: SCOPES.facebook,
      response_type: "code",
    });
    return `https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth?${params}`;
  }
  const params = new URLSearchParams({
    response_type: "code",
    client_id: appId,
    redirect_uri: redirect,
    state,
    scope: SCOPES.linkedin,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

/** Cible publiable : page Facebook ou organisation LinkedIn. */
export type SocialTarget = { id: string; name: string; token?: string };

export type ExchangeResult = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  targets: SocialTarget[];
};

export async function exchangeCode(
  network: SocialNetwork,
  appId: string,
  appSecret: string,
  code: string
): Promise<ExchangeResult> {
  return network === "facebook"
    ? exchangeFacebook(appId, appSecret, code)
    : exchangeLinkedIn(appId, appSecret, code);
}

async function exchangeFacebook(
  appId: string,
  appSecret: string,
  code: string
): Promise<ExchangeResult> {
  const base = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}`;

  const shortRes = await fetch(
    `${base}/oauth/access_token?${new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: await redirectUri("facebook"),
      code,
    })}`
  );
  if (!shortRes.ok) throw new SocialAuthError(`Facebook (code) : ${await readError(shortRes)}`);
  const short = (await shortRes.json()) as { access_token?: string };
  if (!short.access_token) throw new SocialAuthError("Facebook : jeton court absent de la réponse.");

  // Jeton utilisateur longue durée (~60 j) : c'est lui qui rend les jetons de
  // page permanents.
  const longRes = await fetch(
    `${base}/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: short.access_token,
    })}`
  );
  if (!longRes.ok) throw new SocialAuthError(`Facebook (jeton longue durée) : ${await readError(longRes)}`);
  const long = (await longRes.json()) as { access_token?: string };
  const userToken = long.access_token ?? short.access_token;

  const pagesRes = await fetch(
    `${base}/me/accounts?${new URLSearchParams({
      fields: "id,name,access_token",
      access_token: userToken,
    })}`
  );
  if (!pagesRes.ok) throw new SocialAuthError(`Facebook (pages) : ${await readError(pagesRes)}`);
  const pages = (await pagesRes.json()) as {
    data?: { id: string; name: string; access_token: string }[];
  };
  const targets = (pages.data ?? []).map((p) => ({ id: p.id, name: p.name, token: p.access_token }));
  if (targets.length === 0) {
    throw new SocialAuthError(
      "Aucune page Facebook administrée par ce compte. Connectez-vous avec un compte administrateur de la page Plein R."
    );
  }

  // Le jeton de page ne dépend pas de l'expiration du jeton utilisateur.
  return { accessToken: userToken, refreshToken: null, expiresAt: null, targets };
}

async function exchangeLinkedIn(
  clientId: string,
  clientSecret: string,
  code: string
): Promise<ExchangeResult> {
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: await redirectUri("linkedin"),
    }),
  });
  if (!tokenRes.ok) throw new SocialAuthError(`LinkedIn (code) : ${await readError(tokenRes)}`);
  const token = (await tokenRes.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
  };
  if (!token.access_token) throw new SocialAuthError("LinkedIn : jeton absent de la réponse.");

  const targets = await listLinkedInOrganizations(token.access_token);
  if (targets.length === 0) {
    throw new SocialAuthError(
      "Aucune page LinkedIn administrée par ce compte. Connectez-vous avec un administrateur de la page de l'association."
    );
  }

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
    targets,
  };
}

function linkedinHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

async function listLinkedInOrganizations(token: string): Promise<SocialTarget[]> {
  const res = await fetch(
    "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
    { headers: linkedinHeaders(token) }
  );
  if (!res.ok) throw new SocialAuthError(`LinkedIn (organisations) : ${await readError(res)}`);
  const json = (await res.json()) as {
    elements?: { organization?: string; organizationTarget?: string }[];
  };

  // Le finder renvoie tantôt `organization`, tantôt `organizationTarget`.
  const urns = Array.from(
    new Set((json.elements ?? []).map((e) => e.organization ?? e.organizationTarget).filter(Boolean))
  ) as string[];

  return Promise.all(
    urns.map(async (urn) => ({ id: urn, name: (await linkedInOrgName(token, urn)) ?? urn }))
  );
}

async function linkedInOrgName(token: string, urn: string): Promise<string | null> {
  const id = urn.split(":").pop();
  if (!id) return null;
  try {
    const res = await fetch(`https://api.linkedin.com/rest/organizations/${id}`, {
      headers: linkedinHeaders(token),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { localizedName?: string };
    return json.localizedName ?? null;
  } catch {
    return null; // Le nom est un confort : l'URN suffit à publier.
  }
}

/**
 * Reliste les cibles publiables avec le jeton déjà enregistré. Sert à l'écran de
 * sélection quand le compte administre plusieurs pages : les jetons de page ne
 * transitent ainsi jamais par une URL.
 */
export async function listStoredTargets(network: SocialNetwork): Promise<SocialTarget[]> {
  const account = await getSocialAccount(network);
  if (!account?.accessToken) return [];
  const token = decryptSecret(account.accessToken);

  if (network === "linkedin") return listLinkedInOrganizations(token);

  const res = await fetch(
    `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me/accounts?${new URLSearchParams({
      fields: "id,name,access_token",
      access_token: token,
    })}`
  );
  if (!res.ok) throw new SocialAuthError(`Facebook (pages) : ${await readError(res)}`);
  const json = (await res.json()) as { data?: { id: string; name: string; access_token: string }[] };
  return (json.data ?? []).map((p) => ({ id: p.id, name: p.name, token: p.access_token }));
}

// ---- Écriture ----

export async function saveAppCredentials(
  network: SocialNetwork,
  appId: string,
  appSecret: string | null
) {
  const existing = await getSocialAccount(network);
  if (!existing) {
    if (!appSecret) throw new Error("Le secret de l'application est requis à la première saisie.");
    await db.insert(socialAccounts).values({
      network,
      appId,
      appSecret: encryptSecret(appSecret),
      updatedAt: new Date(),
    });
    return;
  }
  await db
    .update(socialAccounts)
    .set({
      appId,
      // Champ laissé vide = on conserve le secret déjà enregistré.
      ...(appSecret ? { appSecret: encryptSecret(appSecret) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(socialAccounts.network, network));
}

export async function saveConnection(
  network: SocialNetwork,
  result: ExchangeResult,
  target: SocialTarget | null,
  userId: number | null
) {
  await db
    .update(socialAccounts)
    .set({
      // Facebook : c'est le jeton de la page qui sert à publier, pas celui de
      // l'utilisateur — et lui n'expire pas.
      accessToken: encryptSecret(target?.token ?? result.accessToken),
      refreshToken: result.refreshToken ? encryptSecret(result.refreshToken) : null,
      expiresAt: target?.token ? null : result.expiresAt,
      targetId: target?.id ?? null,
      targetName: target?.name ?? null,
      connectedById: userId,
      connectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(socialAccounts.network, network));
}

/**
 * Fixe la page / organisation à utiliser, une fois la connexion faite. Côté
 * Facebook, on bascule ici du jeton utilisateur vers le jeton de page — celui
 * qui n'expire pas.
 */
export async function selectTarget(network: SocialNetwork, targetId: string) {
  const targets = await listStoredTargets(network);
  const target = targets.find((t) => t.id === targetId);
  if (!target) throw new Error("Page introuvable : relancez la connexion.");

  await db
    .update(socialAccounts)
    .set({
      targetId: target.id,
      targetName: target.name,
      ...(target.token
        ? { accessToken: encryptSecret(target.token), expiresAt: null }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(socialAccounts.network, network));
}

export async function disconnectAccount(network: SocialNetwork) {
  await db
    .update(socialAccounts)
    .set({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      targetId: null,
      targetName: null,
      connectedById: null,
      connectedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(socialAccounts.network, network));
}

export async function getDecryptedAppSecret(network: SocialNetwork): Promise<string | null> {
  const account = await getSocialAccount(network);
  if (!account) return null;
  try {
    return decryptSecret(account.appSecret);
  } catch {
    return null;
  }
}

/**
 * Rafraîchit un jeton LinkedIn proche de l'expiration. N'est possible que si
 * LinkedIn a accordé les « programmatic refresh tokens » à l'application ;
 * sinon on s'appuie sur le bandeau de reconnexion du backoffice.
 */
export async function refreshLinkedInIfNeeded(): Promise<void> {
  const account = await getSocialAccount("linkedin");
  if (!account?.refreshToken || !account.accessToken) return;
  if (expiryStatus(account.expiresAt) === "ok") return;

  try {
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: decryptSecret(account.refreshToken),
        client_id: account.appId,
        client_secret: decryptSecret(account.appSecret),
      }),
    });
    if (!res.ok) return;
    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
    };
    if (!json.access_token) return;

    await db
      .update(socialAccounts)
      .set({
        accessToken: encryptSecret(json.access_token),
        refreshToken: json.refresh_token ? encryptSecret(json.refresh_token) : account.refreshToken,
        expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
        updatedAt: new Date(),
      })
      .where(eq(socialAccounts.network, "linkedin"));
  } catch {
    // Échec silencieux : la publication signalera l'erreur si le jeton est mort.
  }
}
