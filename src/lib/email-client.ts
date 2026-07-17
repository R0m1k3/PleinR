function bytesBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return globalThis.btoa(binary);
}

function utf8Base64(value: string) {
  return bytesBase64(new TextEncoder().encode(value));
}

function wrapBase64(value: string) {
  return value.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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
  let logoPart = "";
  const boundary = "----=_PleinR_Outlook_Draft";

  if (logoUrl) {
    const response = await fetch(logoUrl, { cache: "force-cache" });
    if (!response.ok) throw new Error("Logo Plein R introuvable.");
    const base64 = bytesBase64(new Uint8Array(await response.arrayBuffer()));
    renderedHtml = html.replace(/(\bsrc\s*=\s*)(["'])[^"']*\/assets\/logo\.png(?:\?[^"']*)?\2/gi, "$1$2cid:plein-r-logo$2");
    logoPart = [`--${boundary}`, "Content-Type: image/png; name=\"logo.png\"", "Content-Transfer-Encoding: base64", "Content-ID: <plein-r-logo>", "Content-Disposition: inline; filename=\"logo.png\"", "", wrapBase64(base64)].join("\r\n");
  }

  const mime = logoPart
    ? ["X-Unsent: 1", `Subject: =?UTF-8?B?${utf8Base64(subject)}?=`, "MIME-Version: 1.0", `Content-Type: multipart/related; type=\"text/html\"; boundary=\"${boundary}\"`, "", `--${boundary}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", wrapBase64(utf8Base64(renderedHtml)), logoPart, `--${boundary}--`, ""].join("\r\n")
    : ["X-Unsent: 1", `Subject: =?UTF-8?B?${utf8Base64(subject)}?=`, "MIME-Version: 1.0", "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", wrapBase64(utf8Base64(html)), ""].join("\r\n");
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
