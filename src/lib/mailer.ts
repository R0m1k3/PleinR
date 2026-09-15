import { buildMimeMessage, formatAddress, toBase64Url, utf8ToBase64 } from "@/lib/mime";
import { resolveMailSender, type MailHealth, type MailSender } from "@/lib/mail-accounts";
import { describeSmtpError } from "@/lib/smtp-config";

/**
 * Expédition d'un message.
 *
 * Trois transports, deux familles :
 *
 * - **Google** passe par l'API Gmail (`users.messages.send`) et non par SMTP
 *   avec XOAUTH2 : celui-ci exigerait la portée `https://mail.google.com/`,
 *   classée « restreinte », donc un audit de sécurité. `gmail.send` est une
 *   portée simplement « sensible ».
 * - **Microsoft** passe par Graph (`/me/sendMail`) : l'authentification
 *   basique SMTP est désactivée par défaut depuis 2024, y compris sur les
 *   boîtes outlook.com et hotmail.com.
 * - **SMTP** couvre tout le reste (mot de passe d'application Gmail, Outlook
 *   professionnel, OVH, Ionos…) via `nodemailer`.
 *
 * `sendNow` ne lève jamais : elle renvoie un verdict, que la file d'attente ou
 * l'action appelante affiche. Un envoi raté ne doit pas faire tomber la page
 * qui l'a déclenché.
 */

export type OutgoingMail = {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text?: string | null;
  replyTo?: string | null;
};

export type SendResult =
  | { ok: true; provider: MailSender["provider"] }
  | { ok: false; reason: string };

export type SmtpConfig = { host: string; port: number; secure: boolean; user: string; password: string };

async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return `HTTP ${res.status}${body ? ` — ${body.slice(0, 400)}` : ""}`;
}

export async function sendNow(mail: OutgoingMail): Promise<SendResult> {
  const sender = await resolveMailSender();
  if (!sender) {
    return { ok: false, reason: "Aucune boîte mail n'est configurée (Backend › Boîte mail)." };
  }

  try {
    if (sender.provider === "google") return await sendViaGmail(sender, mail);
    if (sender.provider === "microsoft") return await sendViaGraph(sender, mail);
    return await sendViaSmtp(sender, mail);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Envoi impossible" };
  }
}

async function sendViaGmail(sender: MailSender, mail: OutgoingMail): Promise<SendResult> {
  // Le champ `raw` de l'API Gmail attend le message RFC 822 en base64url.
  const raw = toBase64Url(
    utf8ToBase64(
      buildMimeMessage({
        from: formatAddress(sender.fromAddress, sender.fromName),
        to: formatAddress(mail.to, mail.toName),
        replyTo: mail.replyTo ?? undefined,
        subject: mail.subject,
        html: mail.html,
        text: mail.text ?? undefined,
      }),
    ),
  );

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${sender.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) return { ok: false, reason: await readError(res) };
  return { ok: true, provider: "google" };
}

async function sendViaGraph(sender: MailSender, mail: OutgoingMail): Promise<SendResult> {
  // Graph prend du JSON : aucun MIME à construire de ce côté.
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${sender.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: mail.subject,
        body: { contentType: "HTML", content: mail.html },
        toRecipients: [{ emailAddress: { address: mail.to, name: mail.toName ?? undefined } }],
        ...(mail.replyTo ? { replyTo: [{ emailAddress: { address: mail.replyTo } }] } : {}),
      },
      saveToSentItems: true,
    }),
  });
  if (!res.ok) return { ok: false, reason: await readError(res) };
  return { ok: true, provider: "microsoft" };
}

async function sendViaSmtp(sender: MailSender, mail: OutgoingMail): Promise<SendResult> {
  if (!sender.smtp) return { ok: false, reason: "Réglages SMTP incomplets." };
  const transport = await smtpTransport(sender.smtp);
  try {
    await transport.sendMail({
      from: formatAddress(sender.fromAddress, sender.fromName),
      to: formatAddress(mail.to, mail.toName),
      replyTo: mail.replyTo ?? undefined,
      subject: mail.subject,
      html: mail.html,
      text: mail.text ?? undefined,
    });
  } catch (error) {
    // Le verdict part dans le journal d'envoi : il doit se lire sans trace OpenSSL.
    return { ok: false, reason: describeSmtpError(error instanceof Error ? error.message : String(error), sender.smtp) };
  }
  return { ok: true, provider: "smtp" };
}

/**
 * `nodemailer` charge `net`, `tls` et `dns` par des requires dynamiques : il
 * est importé à la demande, et déclaré dans `serverExternalPackages`, pour ne
 * jamais entrer dans un bundle qui ne les a pas.
 *
 * Deux réglages qui ne sont pas des détails :
 *
 * - `requireTLS` hors TLS implicite : sans lui, STARTTLS est *opportuniste*.
 *   Un serveur qui ne l'annonce pas — ou un intermédiaire qui retire la
 *   capacité de la réponse EHLO — ferait partir l'identifiant et le mot de
 *   passe en clair sans que rien ne le signale. On préfère l'échec.
 * - les délais : ceux de `nodemailer` se comptent en minutes, or ces
 *   connexions sont ouvertes depuis une action serveur. Un port filtré en
 *   sortie — cas courant chez les hébergeurs — doit rendre son verdict en
 *   quelques secondes, pas bloquer l'écran.
 */
async function smtpTransport(config: SmtpConfig) {
  const nodemailer = (await import("nodemailer")).default;
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 30_000,
    // SNI explicite : sans lui, un hôte joint par IP casse la validation.
    tls: { servername: config.host, minVersion: "TLSv1.2" },
  });
}

/** Contrôle de santé SMTP : ouvre la connexion, s'authentifie, referme. */
export async function verifySmtp(config: SmtpConfig): Promise<MailHealth> {
  const transport = await smtpTransport(config).catch(() => null);
  if (!transport) return { ok: false, reason: "Transport SMTP indisponible." };
  try {
    await transport.verify();
    const how = config.secure ? "chiffrée dès l'ouverture" : "STARTTLS";
    return { ok: true, detail: `Connexion établie avec ${config.host} sur le port ${config.port} (${how})` };
  } catch (error) {
    return { ok: false, reason: describeSmtpError(error instanceof Error ? error.message : "", config) };
  } finally {
    // Sans cela, un échec laisserait la socket au pool jusqu'à son expiration.
    transport.close();
  }
}
