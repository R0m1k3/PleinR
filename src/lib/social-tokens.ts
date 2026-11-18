/**
 * Règles pures des jetons réseaux sociaux : quand rafraîchir LinkedIn, comment
 * lire sa réponse, comment juger un jeton Facebook collé à la main, quand une
 * publication en échec signale un jeton cassé. Aucun accès base ni Next ici :
 * le module se teste seul.
 */

const DAY_MS = 86_400_000;

/** On rafraîchit LinkedIn dès qu'il reste moins de 30 jours (jeton de 60 jours). */
export const LINKEDIN_REFRESH_DAYS = 30;

const LINKEDIN_DEFAULT_TTL_S = 60 * 86_400;

export function linkedinNeedsRefresh(expiresAt: Date | null | undefined, now: Date): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() - now.getTime() < LINKEDIN_REFRESH_DAYS * DAY_MS;
}

/** Vrai si une date (fin du refresh token) tombe dans moins de 30 jours. */
export function withinRefreshWindow(date: Date | null | undefined, now: Date): boolean {
  return linkedinNeedsRefresh(date, now);
}

export type LinkedInRefreshJson = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
};

export type LinkedInRefreshUpdate = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  refreshExpiresAt: Date | null;
};

export function linkedinRefreshUpdate(json: LinkedInRefreshJson, now: Date): LinkedInRefreshUpdate {
  if (!json.access_token) throw new Error("Réponse sans access_token");
  const ttl = json.expires_in && json.expires_in > 0 ? json.expires_in : LINKEDIN_DEFAULT_TTL_S;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: new Date(now.getTime() + ttl * 1000),
    refreshExpiresAt: json.refresh_token_expires_in
      ? new Date(now.getTime() + json.refresh_token_expires_in * 1000)
      : null,
  };
}

// ---- Facebook : jeton d'utilisateur système ----

export const ERR_NO_APP =
  "Enregistrez d'abord l'identifiant et la clé secrète de l'application Facebook.";
export const ERR_INVALID =
  "Jeton invalide : Meta le refuse. Générez-en un nouveau dans Business Suite.";
export const ERR_NO_PAGE_SYSTEM =
  "Aucune page assignée à cet utilisateur système. Dans Business Suite, assignez-lui la page Plein R avec le contrôle total.";

export const FACEBOOK_WARNINGS = {
  personal:
    "Ce jeton n'est pas un jeton d'utilisateur système sans expiration : il cessera de fonctionner si le mot de passe du compte change ou à son expiration.",
  unverified:
    "Type de jeton non vérifié : la page est connectée, mais rien ne garantit qu'il n'expire pas.",
} as const;

export type FacebookWarning = keyof typeof FACEBOOK_WARNINGS;

/** Texte d'un code d'avertissement venu de l'URL ; tout autre valeur est ignorée. */
export function facebookWarningText(code: unknown): string | null {
  if (typeof code !== "string" || !Object.hasOwn(FACEBOOK_WARNINGS, code)) return null;
  return FACEBOOK_WARNINGS[code as FacebookWarning];
}

export type DebugTokenData = {
  is_valid?: boolean;
  type?: string;
  expires_at?: number;
  error?: { message?: string };
};

export type DebugTokenAssessment =
  | { ok: false; error: string }
  | { ok: true; warning: FacebookWarning | null };

export function assessFacebookDebugToken(data: DebugTokenData | null | undefined): DebugTokenAssessment {
  if (!data) return { ok: true, warning: "unverified" };
  if (data.is_valid === false) {
    const detail = data.error?.message ? ` (${data.error.message.slice(0, 200)})` : "";
    return { ok: false, error: `${ERR_INVALID}${detail}` };
  }
  const permanent = !data.expires_at;
  if (data.type === "SYSTEM_USER" && permanent) return { ok: true, warning: null };
  return { ok: true, warning: "personal" };
}

// ---- Tableau de bord ----

const AUTH_ERROR = /oauth|token|401|expired|invalid|permission/i;

/**
 * Une publication en échec pour cause de jeton ne compte que si elle a eu lieu
 * après la dernière connexion : une fois le jeton remplacé, seul le contrôle de
 * santé décide.
 */
export function isAuthFailureSinceConnection(
  last: { status: string; error: string | null; createdAt: Date } | undefined,
  connectedAt: Date | null
): boolean {
  if (!last || last.status !== "failed" || !AUTH_ERROR.test(last.error ?? "")) return false;
  if (!connectedAt) return true;
  return new Date(last.createdAt).getTime() > new Date(connectedAt).getTime();
}
