/**
 * Port SMTP et chiffrement : deux réglages qui doivent s'accorder.
 *
 * Il existe deux façons de chiffrer une session SMTP, et elles ne se
 * négocient pas sur le même port :
 *
 * - **TLS implicite** (port 465) : la connexion est chiffrée dès son
 *   ouverture, avant le moindre octet de protocole.
 * - **STARTTLS** (ports 587, 25, 2525) : la connexion s'ouvre en clair, le
 *   client lit les capacités annoncées, puis demande `STARTTLS` pour passer
 *   la suite — authentification comprise — dans le tunnel.
 *
 * Se tromper ne produit pas un message d'erreur lisible : un client qui tente
 * une poignée de main TLS sur le port 587 reçoit la bannière en clair du
 * serveur et la lit comme un enregistrement TLS invalide (« wrong version
 * number ») ; à l'inverse, un client qui parle en clair sur le port 465
 * attend une bannière qui ne viendra jamais et finit en délai dépassé. D'où
 * ce module : l'écran accorde les deux champs tout seul, et les échecs sont
 * traduits avant d'être affichés.
 *
 * Module **pur** (aucun accès réseau ni base), verrouillé par
 * `tests/smtp-config.test.ts`.
 */

/** Seul port où le chiffrement précède le protocole. */
export const IMPLICIT_TLS_PORT = 465;

/** Ports de soumission qui s'ouvrent en clair puis passent par STARTTLS. */
export const STARTTLS_PORTS = [587, 25, 2525];

/** Le réglage « chiffré dès l'ouverture » qu'appelle un port donné. */
export function impliedSecure(port: number): boolean {
  return port === IMPLICIT_TLS_PORT;
}

/**
 * Message d'avertissement quand le port et la case ne s'accordent pas —
 * `null` si le couple est cohérent. On explique, on ne bloque pas :
 * un relais peut très bien écouter du TLS implicite sur un port exotique.
 */
export function tlsMismatch(port: number, secure: boolean): string | null {
  if (secure && !impliedSecure(port)) {
    return `Le port ${port} s'ouvre en clair puis passe par STARTTLS : en gardant la case cochée, la poignée de main TLS échouera dès la connexion.`;
  }
  if (!secure && impliedSecure(port)) {
    return "Le port 465 chiffre dès l'ouverture : sans la case cochée, la connexion reste sans réponse jusqu'au délai dépassé.";
  }
  return null;
}

export type SmtpErrorContext = { host?: string; port?: number; secure?: boolean };

const RAW_DETAIL = 110;

function withDetail(explanation: string, raw: string): string {
  const detail = raw.replace(/\s+/g, " ").trim();
  if (!detail) return explanation;
  return `${explanation} (détail : ${detail.slice(0, RAW_DETAIL)})`;
}

/**
 * Traduit l'échec d'une connexion SMTP en phrase actionnable.
 *
 * L'explication passe **avant** le message d'origine : l'écran tronque le
 * verdict, et c'est la consigne qu'il faut préserver, pas la trace OpenSSL.
 */
export function describeSmtpError(raw: string, context: SmtpErrorContext = {}): string {
  const text = String(raw ?? "");
  const lower = text.toLowerCase();
  const where = context.host ? `${context.host}:${context.port ?? IMPLICIT_TLS_PORT}` : "le serveur";

  // Bannière en clair lue comme du TLS : la case est cochée sur un port STARTTLS.
  if (lower.includes("wrong version number") || lower.includes("ssl3_get_record") || lower.includes("packet length too long")) {
    return withDetail(
      `${where} a répondu en clair alors qu'une connexion chiffrée était attendue. Décochez « Connexion chiffrée dès l'ouverture » : sur le port ${context.port ?? 587}, le chiffrement se demande par STARTTLS.`,
      text,
    );
  }

  // Le serveur exige le tunnel avant l'authentification.
  if (lower.includes("must issue a starttls") || lower.includes("starttls is required") || lower.includes("no starttls")) {
    return withDetail(
      `${where} exige STARTTLS avant l'authentification. Vérifiez que le port est bien un port de soumission (587) et non un port de relais filtré.`,
      text,
    );
  }

  // Poignée de main en clair sur un port qui chiffre d'emblée, ou port filtré.
  if (lower.includes("greeting never received") || lower.includes("etimedout") || lower.includes("timed out") || lower.includes("timeout")) {
    const hint = context.secure === false && impliedSecure(context.port ?? 0)
      ? "Cochez « Connexion chiffrée dès l'ouverture » : le port 465 chiffre avant toute réponse."
      : "Le port est probablement filtré en sortie : beaucoup d'hébergeurs bloquent les connexions SMTP sortantes, et il faut alors leur demander l'ouverture.";
    return withDetail(`Aucune réponse de ${where}. ${hint}`, text);
  }

  if (lower.includes("econnrefused")) {
    return withDetail(`${where} a refusé la connexion : ce port n'écoute pas. Essayez 465 (chiffré dès l'ouverture) ou 587 (STARTTLS).`, text);
  }

  if (lower.includes("enotfound") || lower.includes("eai_again") || lower.includes("getaddrinfo")) {
    return withDetail(`Nom de serveur introuvable : vérifiez l'adresse « ${context.host ?? ""} ».`, text);
  }

  if (lower.includes("eauth") || lower.includes("535") || lower.includes("invalid login") || lower.includes("authentication failed") || lower.includes("username and password not accepted")) {
    return withDetail(
      "Identifiants refusés. L'identifiant est l'adresse complète de la boîte, et certains fournisseurs exigent un mot de passe d'application plutôt que celui du compte.",
      text,
    );
  }

  if (lower.includes("altnames") || lower.includes("self signed") || lower.includes("self-signed") || lower.includes("unable to verify") || lower.includes("cert")) {
    return withDetail(
      `Le certificat présenté par ${where} ne correspond pas à ce nom de serveur. Utilisez le nom annoncé par le fournisseur plutôt qu'une adresse IP ou un alias.`,
      text,
    );
  }

  if (lower.includes("5.7.1") || lower.includes("relay") || lower.includes("not permitted") || lower.includes("sender address rejected")) {
    return withDetail(
      "Le serveur refuse cette adresse d'expédition : elle doit appartenir au domaine de la boîte qui authentifie la connexion.",
      text,
    );
  }

  return text || "Serveur SMTP injoignable";
}
