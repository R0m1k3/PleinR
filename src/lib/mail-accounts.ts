import { eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { mailAccounts } from "@/db/schema";
import type { MailAccount, MailProvider } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

/**
 * Boîte mail de l'association : configuration, connexion, santé.
 *
 * Décalque volontaire de `src/lib/social-accounts.ts` — mêmes règles, mêmes
 * garanties : les secrets sont chiffrés en base, ne repartent jamais vers le
 * navigateur, un champ laissé vide conserve celui déjà enregistré, et le
 * contrôle de santé ne lève jamais.
 *
 * Trois transports, un seul actif à la fois. Pas de cascade automatique : si
 * Google se bloque, c'est l'administrateur qui bascule, et il le voit.
 */

export const MAIL_PROVIDERS: MailProvider[] = ["google", "microsoft", "smtp"];

export const MAIL_LABELS: Record<MailProvider, string> = {
  google: "Google — Gmail / Workspace",
  microsoft: "Microsoft — Outlook / Hotmail / 365",
  smtp: "Autre serveur (SMTP)",
};

/** Le jeton d'accès est renouvelé un peu avant l'échéance annoncée. */
const REFRESH_MARGIN_MS = 5 * 60_000;

function env(key: string): string {
  return (process.env[key] ?? "").trim();
}

// ---- Lecture ----

export async function getMailAccount(provider: MailProvider): Promise<MailAccount | null> {
  const [row] = await db.select().from(mailAccounts).where(eq(mailAccounts.provider, provider));
  return row ?? null;
}

export async function getMailAccounts(): Promise<MailAccount[]> {
  return db.select().from(mailAccounts);
}

export async function getActiveMailAccount(): Promise<MailAccount | null> {
  const [row] = await db.select().from(mailAccounts).where(eq(mailAccounts.isActive, true));
  return row ?? null;
}

export type MailSender = {
  provider: MailProvider;
  fromAddress: string;
  fromName: string;
  /** Google / Microsoft : jeton valide. SMTP : chaîne vide. */
  accessToken: string;
  smtp?: { host: string; port: number; secure: boolean; user: string; password: string };
};

/**
 * Le transport prêt à expédier, ou `null` si rien n'est configuré.
 *
 * Aucun repli sur l'environnement pour les jetons OAuth — ils ne peuvent
 * venir que du parcours de connexion — mais les réglages SMTP restent lisibles
 * depuis l'environnement, ce qui permet un premier déploiement sans passer par
 * l'écran.
 */
export async function resolveMailSender(): Promise<MailSender | null> {
  const account = await getActiveMailAccount();

  if (account?.provider === "smtp") {
    const password = safeDecrypt(account.smtpPassword);
    if (account.smtpHost && account.smtpUser && password) {
      return {
        provider: "smtp",
        fromAddress: account.fromAddress || account.smtpUser,
        fromName: account.fromName ?? "",
        accessToken: "",
        smtp: {
          host: account.smtpHost,
          port: account.smtpPort ?? 465,
          secure: account.smtpSecure,
          user: account.smtpUser,
          password,
        },
      };
    }
  }

  if (account && (account.provider === "google" || account.provider === "microsoft")) {
    const accessToken = await ensureAccessToken(account.provider);
    if (accessToken && account.fromAddress) {
      return {
        provider: account.provider,
        fromAddress: account.fromAddress,
        fromName: account.fromName ?? "",
        accessToken,
      };
    }
  }

  // Repli d'environnement : utile avant toute configuration depuis l'écran.
  const host = env("SMTP_HOST");
  const user = env("SMTP_USER");
  const password = env("SMTP_PASSWORD");
  if (host && user && password) {
    return {
      provider: "smtp",
      fromAddress: env("SMTP_FROM") || user,
      fromName: env("SMTP_FROM_NAME"),
      accessToken: "",
      smtp: { host, port: Number(env("SMTP_PORT") || 465), secure: env("SMTP_SECURE") !== "false", user, password },
    };
  }

  return null;
}

export async function isMailConfigured(): Promise<boolean> {
  return (await resolveMailSender()) !== null;
}

function safeDecrypt(value: string | null): string | null {
  if (!value) return null;
  try {
    return decryptSecret(value);
  } catch {
    // Clé de chiffrement changée : on préfère « non configuré » à une erreur.
    return null;
  }
}

// ---- Écriture ----

export async function saveOAuthApp(provider: MailProvider, appId: string, appSecret: string | null) {
  const existing = await getMailAccount(provider);
  if (!existing) {
    if (!appSecret) throw new Error("Le secret de l'application est requis à la première saisie.");
    await db.insert(mailAccounts).values({ provider, appId, appSecret: encryptSecret(appSecret), updatedAt: new Date() });
    return;
  }
  await db
    .update(mailAccounts)
    .set({
      appId,
      // Champ laissé vide = on conserve le secret déjà enregistré.
      ...(appSecret ? { appSecret: encryptSecret(appSecret) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(mailAccounts.provider, provider));
}

export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string | null;
  fromAddress: string;
  fromName: string;
};

export async function saveSmtpAccount(settings: SmtpSettings) {
  const existing = await getMailAccount("smtp");
  const shared = {
    smtpHost: settings.host,
    smtpPort: settings.port,
    smtpSecure: settings.secure,
    smtpUser: settings.user,
    fromAddress: settings.fromAddress || settings.user,
    fromName: settings.fromName,
    updatedAt: new Date(),
    // Les réglages changent : le dernier verdict ne vaut plus rien.
    lastCheckAt: null,
    lastCheckOk: null,
    lastCheckError: null,
  };

  if (!existing) {
    if (!settings.password) throw new Error("Le mot de passe est requis à la première saisie.");
    await db.insert(mailAccounts).values({ provider: "smtp", ...shared, smtpPassword: encryptSecret(settings.password) });
    return;
  }
  await db
    .update(mailAccounts)
    .set({ ...shared, ...(settings.password ? { smtpPassword: encryptSecret(settings.password) } : {}) })
    .where(eq(mailAccounts.provider, "smtp"));
}

export async function saveMailConnection(input: {
  provider: MailProvider;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  fromAddress: string;
  fromName?: string | null;
  connectedById: number | null;
}) {
  const existing = await getMailAccount(input.provider);
  const values = {
    accessToken: encryptSecret(input.accessToken),
    // Microsoft fait tourner le jeton de rafraîchissement à chaque
    // renouvellement ; un `null` ici ne doit pas effacer celui en place.
    ...(input.refreshToken ? { refreshToken: encryptSecret(input.refreshToken) } : {}),
    expiresAt: input.expiresAt,
    fromAddress: input.fromAddress,
    ...(input.fromName ? { fromName: input.fromName } : {}),
    connectedById: input.connectedById,
    connectedAt: new Date(),
    lastCheckAt: null,
    lastCheckOk: null,
    lastCheckError: null,
    updatedAt: new Date(),
  };

  if (!existing) {
    await db.insert(mailAccounts).values({ provider: input.provider, ...values });
    return;
  }
  await db.update(mailAccounts).set(values).where(eq(mailAccounts.provider, input.provider));
}

/** Désigne le fournisseur expéditeur ; les autres restent configurés. */
export async function setActiveMailProvider(provider: MailProvider) {
  await db.update(mailAccounts).set({ isActive: false }).where(ne(mailAccounts.provider, provider));
  await db.update(mailAccounts).set({ isActive: true, updatedAt: new Date() }).where(eq(mailAccounts.provider, provider));
}

/**
 * Coupe la connexion sans effacer les identifiants d'application : une
 * reconnexion ne redemande pas de recopier l'identifiant et le secret.
 */
export async function disconnectMailAccount(provider: MailProvider) {
  await db
    .update(mailAccounts)
    .set({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      fromAddress: null,
      isActive: false,
      lastCheckAt: null,
      lastCheckOk: null,
      lastCheckError: null,
      updatedAt: new Date(),
    })
    .where(eq(mailAccounts.provider, provider));
}

export async function getDecryptedAppSecret(provider: MailProvider): Promise<string | null> {
  const account = await getMailAccount(provider);
  return safeDecrypt(account?.appSecret ?? null);
}

// ---- Jetons OAuth ----

const TOKEN_ENDPOINT: Record<"google" | "microsoft", string> = {
  google: "https://oauth2.googleapis.com/token",
  microsoft: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
};

/**
 * Jeton d'accès valide, renouvelé si besoin. Appelée par l'expéditeur, jamais
 * par le rendu d'une page : un renouvellement est une écriture.
 */
export async function ensureAccessToken(provider: "google" | "microsoft"): Promise<string | null> {
  const account = await getMailAccount(provider);
  if (!account) return null;

  const current = safeDecrypt(account.accessToken);
  const stillValid =
    current && account.expiresAt && new Date(account.expiresAt).getTime() - Date.now() > REFRESH_MARGIN_MS;
  if (stillValid) return current;

  const refreshToken = safeDecrypt(account.refreshToken);
  const appSecret = safeDecrypt(account.appSecret);
  if (!refreshToken || !account.appId || !appSecret) return current;

  try {
    const res = await fetch(TOKEN_ENDPOINT[provider], {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: account.appId,
        client_secret: appSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return current;

    const payload = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!payload.access_token) return current;

    await db
      .update(mailAccounts)
      .set({
        accessToken: encryptSecret(payload.access_token),
        // Microsoft renvoie un nouveau jeton de rafraîchissement à chaque
        // appel et invalide l'ancien : ne pas l'enregistrer condamnerait
        // l'envoi au bout d'une heure.
        ...(payload.refresh_token ? { refreshToken: encryptSecret(payload.refresh_token) } : {}),
        expiresAt: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000) : null,
        updatedAt: new Date(),
      })
      .where(eq(mailAccounts.provider, provider));

    return payload.access_token;
  } catch {
    return current;
  }
}

// ---- Santé ----

export type MailHealth = { ok: true; detail: string } | { ok: false; reason: string };

async function rememberCheck(provider: MailProvider, health: MailHealth) {
  await db
    .update(mailAccounts)
    .set({
      lastCheckAt: new Date(),
      lastCheckOk: health.ok,
      lastCheckError: health.ok ? null : health.reason.slice(0, 2000),
    })
    .where(eq(mailAccounts.provider, provider));
}

async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return `HTTP ${res.status}${body ? ` — ${body.slice(0, 400)}` : ""}`;
}

/**
 * Interroge le fournisseur. Ne lève jamais : un échec est un verdict, pas une
 * exception — l'écran doit pouvoir l'afficher.
 */
export async function checkMailHealth(provider: MailProvider): Promise<MailHealth | null> {
  const account = await getMailAccount(provider);
  if (!account) return null;

  try {
    if (provider === "smtp") {
      const password = safeDecrypt(account.smtpPassword);
      if (!account.smtpHost || !account.smtpUser || !password) return null;
      const { verifySmtp } = await import("@/lib/mailer");
      const health = await verifySmtp({
        host: account.smtpHost,
        port: account.smtpPort ?? 465,
        secure: account.smtpSecure,
        user: account.smtpUser,
        password,
      });
      await rememberCheck(provider, health);
      return health;
    }

    const token = await ensureAccessToken(provider);
    if (!token) return null;

    const url =
      provider === "google"
        ? "https://gmail.googleapis.com/gmail/v1/users/me/profile"
        : "https://graph.microsoft.com/v1.0/me";
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const health: MailHealth = res.ok
      ? { ok: true, detail: `Boîte accessible (${account.fromAddress ?? "compte connecté"})` }
      : { ok: false, reason: await readError(res) };
    await rememberCheck(provider, health);
    return health;
  } catch (error) {
    const health: MailHealth = {
      ok: false,
      reason: error instanceof Error ? error.message : "Fournisseur injoignable",
    };
    await rememberCheck(provider, health);
    return health;
  }
}

/** Verdict mis en cache : évite un appel réseau à chaque affichage. */
export async function mailHealthCached(
  provider: MailProvider,
  maxAgeMs = 6 * 3_600_000
): Promise<MailHealth | null> {
  const account = await getMailAccount(provider);
  if (!account) return null;

  const fresh = account.lastCheckAt && Date.now() - new Date(account.lastCheckAt).getTime() < maxAgeMs;
  if (fresh && account.lastCheckOk !== null) {
    return account.lastCheckOk
      ? { ok: true, detail: "Vérifiée récemment" }
      : { ok: false, reason: account.lastCheckError ?? "Boîte refusée" };
  }
  return checkMailHealth(provider);
}

// ---- Parcours OAuth ----

export class MailAuthError extends Error {}

/**
 * Portées demandées.
 *
 * Google : `gmail.send` est classée *sensible*. `https://mail.google.com/`,
 * qu'exigerait SMTP avec XOAUTH2, est *restreinte* et déclenche un audit de
 * sécurité — d'où le choix de l'API Gmail.
 *
 * Microsoft : délégué, sur l'autorité `/common`, pour accepter aussi bien une
 * boîte professionnelle qu'un compte outlook.com ou hotmail.com personnel.
 */
const SCOPES: Record<"google" | "microsoft", string> = {
  google: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email",
  microsoft: "offline_access Mail.Send User.Read",
};

export async function mailRedirectUri(provider: MailProvider, base: string): Promise<string> {
  return `${base.replace(/\/+$/, "")}/api/mail/${provider}/callback`;
}

export async function mailAuthorizeUrl(
  provider: "google" | "microsoft",
  appId: string,
  state: string,
  base: string
): Promise<string> {
  const redirectUri = await mailRedirectUri(provider, base);

  if (provider === "google") {
    return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.google,
      // Sans `offline` et `consent`, Google ne délivre pas de jeton de
      // rafraîchissement au deuxième passage : l'envoi mourrait au bout d'une
      // heure sans raison visible.
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    })}`;
  }

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: SCOPES.microsoft,
    state,
  })}`;
}

export type MailExchange = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  fromAddress: string;
  fromName: string | null;
};

/**
 * Échange le code contre des jetons, puis **lit l'adresse chez le
 * fournisseur** : Gmail expédie comme l'utilisateur authentifié et Graph comme
 * la boîte. Laisser l'administrateur saisir une autre adresse ferait tomber
 * SPF et DKIM, et tous les messages partiraient en indésirable.
 */
export async function exchangeMailCode(
  provider: "google" | "microsoft",
  appId: string,
  appSecret: string,
  code: string,
  base: string
): Promise<MailExchange> {
  const res = await fetch(TOKEN_ENDPOINT[provider], {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code,
      redirect_uri: await mailRedirectUri(provider, base),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new MailAuthError(await readError(res));

  const payload = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!payload.access_token) throw new MailAuthError("Aucun jeton d'accès renvoyé.");

  const identity = await readIdentity(provider, payload.access_token);
  if (!identity.address) {
    throw new MailAuthError("Impossible de lire l'adresse de la boîte connectée.");
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresAt: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000) : null,
    fromAddress: identity.address,
    fromName: identity.name,
  };
}

async function readIdentity(
  provider: "google" | "microsoft",
  accessToken: string
): Promise<{ address: string; name: string | null }> {
  if (provider === "google") {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new MailAuthError(await readError(res));
    const profile = (await res.json()) as { emailAddress?: string };
    return { address: profile.emailAddress ?? "", name: null };
  }

  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new MailAuthError(await readError(res));
  const profile = (await res.json()) as { mail?: string; userPrincipalName?: string; displayName?: string };
  return { address: profile.mail ?? profile.userPrincipalName ?? "", name: profile.displayName ?? null };
}
