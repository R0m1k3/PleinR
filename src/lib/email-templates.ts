import { richTextToEmailHtml, safeHttpUrl } from "@/lib/rich-text";

export type EmailBrand = {
  associationName: string;
  address?: string;
  email?: string;
  phone?: string;
  siret?: string;
};

export type GeneralEmailContent = {
  subject: string;
  kicker: string;
  title: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  signature: string;
};

export type MeetingEmailTexts = {
  greeting: string;
  intro: string;
  outro: string;
  signature: string;
};

export type MeetingEmailData = {
  id: number;
  title: string;
  startsAt: string;
  location: string | null;
  description: string | null;
  capacity: number;
  registered: number;
};

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function lines(value: unknown) {
  return esc(value).replace(/\r?\n/g, "<br>");
}

function paragraphs(value: string) {
  return value
    .split(/\r?\n\s*\r?\n/)
    .filter(Boolean)
    .map(
      (paragraph, index, all) =>
        `<tr><td style="padding-bottom:${index === all.length - 1 ? 0 : 18}px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:25px;color:#5d5447;">${lines(paragraph)}</td></tr>`,
    )
    .join("");
}

function footer(brand: EmailBrand) {
  const contact = [brand.email, brand.phone].filter(Boolean).map(esc).join(" &middot; ");
  return `<tr><td bgcolor="#13324F" style="background:#13324F;padding:25px 40px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:#C9D8E5;">
    <strong style="color:#FFFFFF;">${esc(brand.associationName)}</strong>${brand.address ? ` &middot; ${lines(brand.address)}` : ""}<br>
    ${contact}${brand.siret ? `${contact ? "<br>" : ""}SIRET&nbsp;: ${esc(brand.siret)}` : ""}
  </td></tr>`;
}

function emailShell({ title, content, baseUrl, brand }: { title: string; content: string; baseUrl: string; brand: EmailBrand }) {
  const logoUrl = `${baseUrl.replace(/\/$/, "")}/assets/logo.png`;
  return `<!doctype html>
<html lang="fr" xmlns:o="urn:schemas-microsoft-com:office:office">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body bgcolor="#F6F2E8" style="margin:0;padding:0;background:#F6F2E8;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F6F2E8" style="width:100%;background:#F6F2E8;border-collapse:collapse;">
<tr><td align="center" style="padding:36px 14px;">
<!--[if mso]><table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="width:100%;max-width:620px;background:#FFFFFF;border:1px solid #E6DCC6;border-collapse:collapse;">
  <tr><td bgcolor="#13324F" style="background:#13324F;padding:22px 40px;border-bottom:5px solid #E0A63C;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="64" valign="middle"><span style="display:block;background:#F6F2E8;padding:6px;border-radius:10px;"><img src="${esc(logoUrl)}" width="52" alt="${esc(brand.associationName)}" style="display:block;width:52px;height:auto;"></span></td>
      <td valign="middle" style="padding-left:17px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#FFFFFF;">${esc(brand.associationName)}</td>
    </tr></table>
  </td></tr>
  ${content}
  ${footer(brand)}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`;
}

function cta(url: string, label: string) {
  const safe = safeHttpUrl(url);
  if (!safe || !label) return "";
  return `<table role="presentation" width="300" cellpadding="0" cellspacing="0" border="0" style="width:300px;border-collapse:collapse;"><tr><td align="center" bgcolor="#2C6FB3" style="background:#2C6FB3;padding:16px 0;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;"><a href="${esc(safe)}" target="_blank" style="display:block;color:#FFFFFF;text-decoration:none;">${esc(label)}</a></td></tr></table>`;
}

export function buildGeneralEmail(content: GeneralEmailContent, baseUrl: string, brand: EmailBrand) {
  const button = cta(content.buttonUrl, content.buttonLabel);
  const body = `
  <tr><td style="padding:42px 40px 16px;">
    ${content.kicker ? `<div style="padding-bottom:15px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:14px;letter-spacing:2.2px;text-transform:uppercase;color:#9A6638;font-weight:bold;">${esc(content.kicker)}</div>` : ""}
    <div style="padding-bottom:23px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:36px;color:#26201A;">${esc(content.title)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${paragraphs(content.body)}</table>
  </td></tr>
  ${button ? `<tr><td align="center" style="padding:22px 40px 8px;">${button}</td></tr>` : ""}
  <tr><td style="padding:25px 40px 40px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:25px;color:#26201A;">${lines(content.signature)}</td></tr>`;
  return { subject: content.subject, html: emailShell({ title: content.subject, content: body, baseUrl, brand }) };
}

export function defaultMeetingEmailTexts(brand: EmailBrand): MeetingEmailTexts {
  return {
    greeting: "Chère adhérente, cher adhérent,",
    intro: "Plein R a le plaisir de vous convier à sa prochaine rencontre. Un moment pour créer des liens, partager les actualités locales et faire grandir notre réseau.",
    outro: "Les places sont limitées : pensez à confirmer votre présence dès maintenant.",
    signature: `À très bientôt,\nL'équipe de ${brand.associationName}`,
  };
}

export function buildMeetingEmail(meeting: MeetingEmailData, texts: MeetingEmailTexts, baseUrl: string, brand: EmailBrand) {
  const date = new Date(meeting.startsAt);
  const dateLong = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  const remaining = Math.max(0, meeting.capacity - meeting.registered);
  const registrationUrl = `${baseUrl.replace(/\/$/, "")}/inscription/${meeting.id}`;
  const subject = `Invitation Plein R — ${meeting.title} · ${dateLong}`;
  const button = cta(registrationUrl, "Je m'inscris à la rencontre");
  const body = `
  <tr><td style="padding:42px 40px 18px;">
    <div style="padding-bottom:16px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2.2px;text-transform:uppercase;color:#9A6638;font-weight:bold;">Invitation &middot; Rencontre Plein R</div>
    ${texts.greeting ? `<div style="padding-bottom:15px;font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:25px;color:#26201A;">${lines(texts.greeting)}</div>` : ""}
    ${texts.intro ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:25px;color:#5D5447;">${lines(texts.intro)}</div>` : ""}
  </td></tr>
  <tr><td style="padding:8px 40px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAF7EF" style="width:100%;background:#FAF7EF;border:1px solid #E6DCC6;border-left:5px solid #E0A63C;border-collapse:collapse;">
      <tr><td style="padding:27px 28px;">
        <div style="padding-bottom:11px;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:31px;color:#26201A;">${esc(meeting.title)}</div>
        ${meeting.description ? `<div style="padding-bottom:17px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#5D5447;">${lines(meeting.description)}</div>` : ""}
        <div style="border-top:1px solid #E6DCC6;padding-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:25px;color:#5D5447;">
          <strong style="color:#26201A;">${esc(dateLong.charAt(0).toUpperCase() + dateLong.slice(1))}</strong><br>
          ${meeting.location ? `${esc(meeting.location)}<br>` : ""}
          ${remaining > 0 ? `${remaining} place${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}` : "Rencontre complète"}
        </div>
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding:28px 40px 12px;">${button}</td></tr>
  <tr><td style="padding:14px 40px 40px;">
    ${texts.outro ? `<div style="padding-bottom:22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:25px;color:#5D5447;">${lines(texts.outro)}</div>` : ""}
    ${texts.signature ? `<div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:25px;color:#26201A;">${lines(texts.signature)}</div>` : ""}
  </td></tr>
  <tr><td style="padding:0 40px 24px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;color:#8C8068;">Si bouton bloqué, copiez ce lien :<br><a href="${esc(registrationUrl)}" style="color:#2C6FB3;word-break:break-all;">${esc(registrationUrl)}</a></td></tr>`;
  return { subject, html: emailShell({ title: subject, content: body, baseUrl, brand }), registrationUrl };
}

export type CredentialsEmailData = {
  name: string;
  email: string;
  tempPassword: string;
  /** « Votre compte adhérent », « Votre accès à l'administration »… */
  intro: string;
};

/**
 * Identifiants d'un compte qui vient d'être créé ou réinitialisé.
 *
 * Construit dans la portée de l'action qui émet le mot de passe et expédié
 * aussitôt : ce message ne passe **jamais** par la file d'attente, dont le
 * corps est stocké en base.
 */
export function buildCredentialsEmail(data: CredentialsEmailData, baseUrl: string, brand: EmailBrand) {
  const loginUrl = `${baseUrl.replace(/\/$/, "")}/login`;
  const subject = `Vos identifiants ${brand.associationName}`;
  const body = `
  <tr><td style="padding:42px 40px 16px;">
    <div style="padding-bottom:15px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:14px;letter-spacing:2.2px;text-transform:uppercase;color:#9A6638;font-weight:bold;">${esc(brand.associationName)}</div>
    <div style="padding-bottom:23px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:36px;color:#26201A;">Bonjour ${esc(data.name)},</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:25px;color:#5D5447;">${lines(data.intro)}</div>
  </td></tr>
  <tr><td style="padding:8px 40px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAF7EF" style="width:100%;background:#FAF7EF;border:1px solid #E6DCC6;border-left:5px solid #E0A63C;border-collapse:collapse;">
      <tr><td style="padding:24px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:24px;color:#5D5447;">
        Identifiant<br><strong style="font-size:16px;color:#26201A;">${esc(data.email)}</strong>
        <div style="padding-top:14px;">Mot de passe temporaire<br>
          <strong style="font-family:'Courier New',Courier,monospace;font-size:19px;letter-spacing:1.5px;color:#26201A;">${esc(data.tempPassword)}</strong>
        </div>
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding:26px 40px 10px;">${cta(loginUrl, "Me connecter")}</td></tr>
  <tr><td style="padding:12px 40px 40px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:23px;color:#5D5447;">
    Ce mot de passe est <strong style="color:#26201A;">provisoire</strong> : il vous sera demandé d'en choisir un
    nouveau dès votre première connexion. Si vous n'êtes pas à l'origine de cette demande, prévenez
    l'association.
  </td></tr>
  <tr><td style="padding:0 40px 24px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;color:#8C8068;">Si le bouton ne fonctionne pas, copiez ce lien :<br><a href="${esc(loginUrl)}" style="color:#2C6FB3;word-break:break-all;">${esc(loginUrl)}</a></td></tr>`;
  return { subject, html: emailShell({ title: subject, content: body, baseUrl, brand }) };
}

export type InformationEmailData = {
  id: number;
  title: string;
  /** Texte balisé, analysé par `src/lib/rich-text.ts`. */
  body: string;
  hasImage: boolean;
};

/**
 * Une information de l'association, mise en e-mail.
 *
 * Un constructeur à part plutôt qu'un élargissement de `GeneralEmailContent` :
 * le contrat du studio de composition reste intact.
 *
 * L'image de couverture part par **URL** (`/api/informations/<id>/image`) et
 * non en data-URI : Gmail et Outlook suppriment les `<img src="data:">`, et
 * l'incorporer gonflerait chaque ligne de la file d'attente à plusieurs méga-octets.
 */
export function buildInformationEmail(data: InformationEmailData, baseUrl: string, brand: EmailBrand) {
  const base = baseUrl.replace(/\/$/, "");
  const spaceUrl = `${base}/backend/espace/informations`;
  const subject = `${brand.associationName} — ${data.title}`;
  const body = `
  <tr><td style="padding:42px 40px 8px;">
    <div style="padding-bottom:15px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:14px;letter-spacing:2.2px;text-transform:uppercase;color:#9A6638;font-weight:bold;">Information &middot; ${esc(brand.associationName)}</div>
    <div style="padding-bottom:20px;font-family:Georgia,'Times New Roman',serif;font-size:29px;line-height:36px;color:#26201A;">${esc(data.title)}</div>
  </td></tr>
  ${
    data.hasImage
      ? `<tr><td style="padding:0 40px 18px;"><img src="${esc(`${base}/api/informations/${data.id}/image`)}" alt="" width="540" style="display:block;width:100%;max-width:540px;height:auto;border:1px solid #E6DCC6;"></td></tr>`
      : ""
  }
  <tr><td style="padding:0 40px 10px;">${richTextToEmailHtml(data.body)}</td></tr>
  <tr><td align="center" style="padding:18px 40px 10px;">${cta(spaceUrl, "Lire dans mon espace")}</td></tr>
  <tr><td style="padding:14px 40px 34px;font-family:Arial,Helvetica,sans-serif;font-size:11.5px;line-height:18px;color:#8C8068;">
    Vous recevez ce message en tant qu'adhérent de ${esc(brand.associationName)}.<br>
    Si le bouton ne fonctionne pas, copiez ce lien : <a href="${esc(spaceUrl)}" style="color:#2C6FB3;word-break:break-all;">${esc(spaceUrl)}</a>
  </td></tr>`;
  return { subject, html: emailShell({ title: subject, content: body, baseUrl, brand }) };
}
