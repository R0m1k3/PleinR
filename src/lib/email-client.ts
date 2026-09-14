/**
 * Sorties navigateur du studio de composition : copie enrichie, brouillon
 * Outlook, export HTML. Rien ici ne part sur le réseau — l'envoi réel vit
 * côté serveur dans `src/lib/mailer.ts`.
 *
 * L'assemblage du message est délégué à `src/lib/mime.ts`, partagé avec le
 * transport Gmail : un seul constructeur RFC 822, verrouillé par ses tests.
 */
import { buildMimeMessage, bytesToBase64, type MimeAttachment } from "@/lib/mime";

const LOGO_CONTENT_ID = "plein-r-logo";
const LOGO_SRC = /(\bsrc\s*=\s*)(["'])[^"']*\/assets\/logo\.png(?:\?[^"']*)?\2/gi;

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "email-plein-r";
}

function emailBody(html: string) {
  return new DOMParser().parseFromString(html, "text/html").body.innerHTML.trim();
}

export async function copyRichEmail(html: string, plainText: string) {
  const holder = document.createElement("div");
  holder.contentEditable = "true";
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText = "position:fixed;left:-10000px;top:0;width:700px;background:#F6F2E8;pointer-events:none;z-index:-1";
  holder.innerHTML = emailBody(html);
  document.body.appendChild(holder);
  const selection = window.getSelection();
  const range = document.createRange();
  try {
    holder.focus();
    range.selectNodeContents(holder);
    selection?.removeAllRanges();
    selection?.addRange(range);
    if (!document.execCommand("copy")) throw new Error("Copie refusée");
  } catch (error) {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw error;
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([emailBody(html)], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      }),
    ]);
  } finally {
    selection?.removeAllRanges();
    holder.remove();
  }
}

export async function downloadOutlookDraft(subject: string, html: string, prefix = "email") {
  const logoUrl = html.match(/\bsrc=["']([^"']*\/assets\/logo\.png(?:\?[^"']*)?)["']/i)?.[1];
  let renderedHtml = html;
  const inline: MimeAttachment[] = [];

  // Le logo est embarqué plutôt que laissé en lien : un brouillon ouvert hors
  // ligne, ou avant la mise en ligne du site, afficherait sinon un cadre vide.
  if (logoUrl) {
    const response = await fetch(logoUrl, { cache: "force-cache" });
    if (!response.ok) throw new Error("Logo Plein R introuvable.");
    renderedHtml = html.replace(LOGO_SRC, `$1$2cid:${LOGO_CONTENT_ID}$2`);
    inline.push({
      filename: "logo.png",
      contentType: "image/png",
      contentId: LOGO_CONTENT_ID,
      base64: bytesToBase64(new Uint8Array(await response.arrayBuffer())),
    });
  }

  // `X-Unsent: 1` : Outlook ouvre le fichier comme un brouillon modifiable et
  // non comme un message reçu.
  const mime = buildMimeMessage({ subject, html: renderedHtml, inline, headers: { "X-Unsent": "1" } });
  downloadBlob(new Blob([mime], { type: "message/rfc822" }), `${prefix}-${slug(subject)}-outlook.eml`);
}

export function downloadHtml(subject: string, html: string, prefix = "email") {
  downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${prefix}-${slug(subject)}.html`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
