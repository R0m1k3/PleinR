import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { siteSettings, socialAccounts, type SocialAccount, type SocialNetwork } from "@/db/schema";
import { decryptSecret, encryptSecret } from "./crypto";
import { originFromHeaders } from "./site-url";
import {
  assessFacebookDebugToken,
  ERR_NO_APP,
  ERR_NO_PAGE_SYSTEM,
  linkedinNeedsRefresh,
  linkedinRefreshUpdate,
  type DebugTokenData,
  type FacebookWarning,
  type LinkedInRefreshJson,
} from "./social-tokens";

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

/**
 * URL publique effective : le réglage s'il existe, sinon l'adresse par laquelle
 * la requête en cours est arrivée (en-têtes du reverse proxy compris). Chaîne
 * vide hors requête si rien n'est configuré.
 */
export async function publicBaseUrl(): Promise<string> {
  const configured = await siteUrl().catch(() => "");
  if (configured) return configured;
  try {
    return originFromHeaders(await headers());
  } catch {
    // Hors requête (génération de robots/sitemap au build par exemple).
    return "";
  }
}

/**
 * Adresse de retour OAuth. Elle doit être identique au clic sur « Connecter »
 * et au retour du réseau : les deux passent par le même hôte, la déduction
 * depuis la requête est donc stable.
 */
export async function redirectUri(network: SocialNetwork): Promise<string> {
  return `${await publicBaseUrl()}/api/social/${network}/callback`;
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

/**
 * Vérifie que le jeton fonctionne encore, en interrogeant la plateforme.
 *
 * « N'expire pas » ne veut pas dire « ne meurt jamais » : un jeton de page
 * Facebook est invalidé si le mot de passe du compte connecté change, si ce
 * compte perd son rôle d'administrateur de la page, si l'autorisation est
 * retirée, ou si Meta le révoque. Sans cette vérification, on ne l'apprend
 * qu'au moment où une publication échoue.
 */
export type TokenHealth =
  | { ok: true; detail: string }
  | { ok: false; reason: string };

export async function checkTokenHealth(network: SocialNetwork): Promise<TokenHealth | null> {
  const health = await probeToken(network);
  if (health) await rememberCheck(network, health);
  return health;
}

/** Contrôle mis en cache : évite un appel réseau à chaque affichage. */
export async function tokenHealthCached(
  network: SocialNetwork,
  maxAgeMs = 6 * 3_600_000
): Promise<TokenHealth | null> {
  const account = await getSocialAccount(network);
  if (!account?.accessToken || !account.targetId) return null;

  const fresh =
    account.lastCheckAt && Date.now() - new Date(account.lastCheckAt).getTime() < maxAgeMs;
  if (fresh && account.lastCheckOk !== null) {
    return account.lastCheckOk
      ? { ok: true, detail: "Vérifié récemment" }
      : { ok: false, reason: account.lastCheckError ?? "Jeton refusé" };
  }
  return checkTokenHealth(network);
}

async function rememberCheck(network: SocialNetwork, health: TokenHealth) {
  await db
    .update(socialAccounts)
    .set({
      lastCheckAt: new Date(),
      lastCheckOk: health.ok,
      lastCheckError: health.ok ? null : health.reason.slice(0, 2000),
    })
    .where(eq(socialAccounts.network, network));
}

async function probeToken(network: SocialNetwork): Promise<TokenHealth | null> {
  const credentials = await resolveCredentials(network);
  if (!credentials) return null;

  try {
    if (network === "facebook") {
      // Un jeton de page répond `/me` avec la page elle-même.
      const res = await fetch(
        `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me?${new URLSearchParams({
          fields: "id,name",
          access_token: credentials.accessToken,
        })}`
      );
      if (!res.ok) return { ok: false, reason: await readError(res) };
      const page = (await res.json()) as { id?: string; name?: string };
      if (page.id && credentials.targetId && page.id !== credentials.targetId) {
        return {
          ok: false,
          reason: `Le jeton ne pointe plus vers la bonne page (${page.name ?? page.id}).`,
        };
      }
      return { ok: true, detail: page.name ?? "Page accessible" };
    }

    const res = await fetch(
      "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=1",
      { headers: linkedinHeaders(credentials.accessToken) }
    );
    if (!res.ok) return { ok: false, reason: await readError(res) };
    return { ok: true, detail: "Accès à la page confirmé" };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Plateforme injoignable",
    };
  }
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
  /** Fin de validité du refresh token LinkedIn ; null ailleurs. */
  refreshExpiresAt: Date | null;
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

  const targets = await facebookPagesFromUserToken(
    userToken,
    "Aucune page Facebook administrée par ce compte. Connectez-vous avec un compte administrateur de la page Plein R."
  );

  // Le jeton de page ne dépend pas de l'expiration du jeton utilisateur.
  return { accessToken: userToken, refreshToken: null, expiresAt: null, refreshExpiresAt: null, targets };
}

/** Pages administrées par un jeton utilisateur (personnel ou système), avec leur jeton. */
async function facebookPagesFromUserToken(
  userToken: string,
  emptyMessage: string
): Promise<SocialTarget[]> {
  const res = await fetch(
    `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me/accounts?${new URLSearchParams({
      fields: "id,name,access_token",
      access_token: userToken,
    })}`
  );
  if (!res.ok) throw new SocialAuthError(`Facebook (pages) : ${await readError(res)}`);
  const pages = (await res.json()) as {
    data?: { id: string; name: string; access_token: string }[];
  };
  const targets = (pages.data ?? []).map((p) => ({ id: p.id, name: p.name, token: p.access_token }));
  if (targets.length === 0) throw new SocialAuthError(emptyMessage);
  return targets;
}

/**
 * Connexion par jeton d'utilisateur système Meta Business. Ce jeton n'est lié
 * à aucun compte personnel : un changement de mot de passe ne casse plus les
 * jetons de page qui en découlent. `debug_token` ne sert qu'à avertir ; ce qui
 * prouve que le jeton sert, c'est la liste des pages puis le contrôle de santé.
 */
export async function connectWithFacebookSystemToken(
  token: string
): Promise<{ result: ExchangeResult; warning: FacebookWarning | null }> {
  const account = await getSocialAccount("facebook");
  const appSecret = account ? await getDecryptedAppSecret("facebook") : null;
  if (!account?.appId || !appSecret) throw new SocialAuthError(ERR_NO_APP);

  let warning: FacebookWarning | null = "unverified";
  try {
    const res = await fetch(
      `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/debug_token?${new URLSearchParams({
        input_token: token,
        access_token: `${account.appId}|${appSecret}`,
      })}`
    );
    if (res.ok) {
      const json = (await res.json()) as { data?: DebugTokenData };
      const assessment = assessFacebookDebugToken(json.data);
      if (!assessment.ok) throw new SocialAuthError(assessment.error);
      warning = assessment.warning;
    }
  } catch (error) {
    if (error instanceof SocialAuthError) throw error;
    // debug_token injoignable : on continue, avertissement « non vérifié ».
  }

  const targets = await facebookPagesFromUserToken(token, ERR_NO_PAGE_SYSTEM);
  return {
    result: { accessToken: token, refreshToken: null, expiresAt: null, refreshExpiresAt: null, targets },
    warning,
  };
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
    refresh_token_expires_in?: number;
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
    refreshExpiresAt: token.refresh_token_expires_in
      ? new Date(Date.now() + token.refresh_token_expires_in * 1000)
      : null,
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
      refreshExpiresAt: result.refreshExpiresAt,
      refreshError: null,
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
      refreshExpiresAt: null,
      refreshError: null,
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
 * Rafraîchit le jeton LinkedIn quand il reste moins de 30 jours. Possible
 * seulement si LinkedIn a accordé les « programmatic refresh tokens » à
 * l'application (Community Management API) ; sans refresh token, rien à faire.
 * Appelé par la boucle de fond et avant chaque publication.
 *
 * Les écritures sont conditionnées à l'échéance lue avant l'appel : si la
 * boucle et une publication rafraîchissent en même temps, le premier jeton
 * écrit est gardé et l'autre résultat est ignoré.
 */
export async function refreshLinkedInIfNeeded(now = new Date()): Promise<void> {
  const account = await getSocialAccount("linkedin");
  if (!account?.refreshToken || !account.accessToken) return;
  if (!linkedinNeedsRefresh(account.expiresAt, now)) return;

  const sameRow = and(
    eq(socialAccounts.network, "linkedin"),
    account.expiresAt ? eq(socialAccounts.expiresAt, account.expiresAt) : isNull(socialAccounts.expiresAt)
  );

  let failure: string;
  try {
    let refreshToken: string;
    let clientSecret: string;
    try {
      refreshToken = decryptSecret(account.refreshToken);
      clientSecret = decryptSecret(account.appSecret);
    } catch {
      throw new Error("Déchiffrement du refresh token impossible");
    }
    let res: Response;
    try {
      res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: account.appId,
          client_secret: clientSecret,
        }),
      });
    } catch (error) {
      throw new Error(`Réseau : ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!res.ok) throw new Error(await readError(res));
    const update = linkedinRefreshUpdate((await res.json()) as LinkedInRefreshJson, now);

    await db
      .update(socialAccounts)
      .set({
        accessToken: encryptSecret(update.accessToken),
        ...(update.refreshToken ? { refreshToken: encryptSecret(update.refreshToken) } : {}),
        expiresAt: update.expiresAt,
        ...(update.refreshExpiresAt ? { refreshExpiresAt: update.refreshExpiresAt } : {}),
        refreshError: null,
        updatedAt: new Date(),
      })
      .where(sameRow);
    console.log(`[social] jeton LinkedIn renouvelé jusqu'au ${update.expiresAt.toISOString()}`);
    return;
  } catch (error) {
    failure = (error instanceof Error ? error.message : String(error)).slice(0, 2000);
  }

  console.error(`[social] renouvellement LinkedIn en échec : ${failure}`);
  await db.update(socialAccounts).set({ refreshError: failure }).where(sameRow);
}

/**
 * Passage de fond : renouvelle LinkedIn si besoin, puis contrôle chaque jeton
 * connecté. Le tableau de bord lit ensuite ces résultats sans appeler les
 * plateformes.
 */
export async function runTokenMaintenance(now = new Date()): Promise<void> {
  try {
    await refreshLinkedInIfNeeded(now);
  } catch (error) {
    console.error("[social] renouvellement LinkedIn :", error);
  }
  for (const account of await getSocialAccounts()) {
    if (!account.accessToken || !account.targetId) continue;
    try {
      await checkTokenHealth(account.network);
    } catch (error) {
      console.error(`[social] contrôle ${account.network} :`, error);
    }
  }
}
