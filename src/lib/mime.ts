/**
 * Construction d'un message RFC 822.
 *
 * Module **pur** (verrouillé par `tests/mime.test.ts`) : il n'utilise que
 * `TextEncoder` et `btoa`, disponibles aussi bien dans Node que dans le
 * navigateur. Il sert donc deux appelants qui n'ont rien à voir :
 *
 * - `src/lib/email-client.ts`, qui fabrique le brouillon `.eml` téléchargé
 *   depuis le studio de composition ;
 * - le transport Gmail (`src/lib/mailer.ts`), dont le champ `raw` attend
 *   exactement ce format, encodé en base64url.
 *
 * Tout corps est encodé en base64 : une frontière ne peut donc jamais
 * apparaître dans la charge utile, et les sauts de ligne restent en CRLF —
 * un LF isolé casse le « dot-stuffing » SMTP et se fait rejeter par Gmail.
 */

const CRLF = "\r\n";

/** Longueur maximale d'une ligne base64 (RFC 2045). */
const BASE64_LINE = 76;

/**
 * Un mot encodé RFC 2047 ne doit pas dépasser 75 caractères. L'enveloppe
 * `=?UTF-8?B?` + `?=` en consomme 12, il reste 63 caractères de base64, soit
 * 45 octets de source (4 caractères base64 pour 3 octets).
 */
const HEADER_CHUNK_BYTES = 45;

const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

export type MimeAttachment = {
  filename: string;
  contentType: string;
  /** Contenu déjà encodé en base64, sans repli de ligne. */
  base64: string;
  /** Présent = pièce jointe en ligne, référencée par `cid:<contentId>`. */
  contentId?: string;
};

export type MimeMessage = {
  from?: string;
  to?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  /** En-têtes libres ajoutés en tête (`X-Unsent`, `List-Unsubscribe`…). */
  headers?: Record<string, string>;
  inline?: MimeAttachment[];
  /**
   * Frontières imposées. Injectable pour que les tests décrivent une sortie
   * stable ; en production elles sont tirées au hasard.
   */
  boundaries?: string[];
};

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  // Par tranches : `String.fromCharCode(...bytes)` dépasse la pile d'appels
  // au-delà de quelques dizaines de milliers d'octets.
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return globalThis.btoa(binary);
}

export function utf8ToBase64(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value));
}

export function wrapBase64(value: string): string {
  return value.match(new RegExp(`.{1,${BASE64_LINE}}`, "g"))?.join(CRLF) ?? "";
}

/** Encodage attendu par le champ `raw` de l'API Gmail. */
export function toBase64Url(value: string): string {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Valeur d'en-tête sûre. Les caractères hors ASCII imprimable passent en mots
 * encodés RFC 2047, repliés si le texte est long ; un accent dans un objet ne
 * doit jamais partir tel quel.
 */
export function encodeHeaderValue(value: string): string {
  // Un CR ou un LF dans une valeur d'en-tête permettrait d'en injecter
  // d'autres (un `Bcc:` par exemple) : on les réduit à une espace.
  const clean = String(value ?? "").replace(/[\r\n]+/g, " ").trim();
  if (PRINTABLE_ASCII.test(clean)) return clean;

  const encoder = new TextEncoder();
  const words: string[] = [];
  let chunk: number[] = [];
  // Itération par point de code : découper le tableau d'octets au ras des 45
  // couperait une séquence UTF-8 en deux.
  for (const char of clean) {
    const bytes = encoder.encode(char);
    if (chunk.length > 0 && chunk.length + bytes.length > HEADER_CHUNK_BYTES) {
      words.push(`=?UTF-8?B?${bytesToBase64(Uint8Array.from(chunk))}?=`);
      chunk = [];
    }
    chunk.push(...bytes);
  }
  if (chunk.length > 0) words.push(`=?UTF-8?B?${bytesToBase64(Uint8Array.from(chunk))}?=`);
  return words.join(`${CRLF} `);
}

/** « Nom affiché » <adresse>, avec le nom encodé ou échappé selon les cas. */
export function formatAddress(email: string, name?: string | null): string {
  const address = String(email ?? "").replace(/[\r\n<>,;]/g, "").trim();
  const display = String(name ?? "").replace(/[\r\n]+/g, " ").trim();
  if (!address) return "";
  if (!display) return address;
  if (PRINTABLE_ASCII.test(display)) {
    return `"${display.replace(/(["\\])/g, "\\$1")}" <${address}>`;
  }
  return `${encodeHeaderValue(display)} <${address}>`;
}

function randomBoundary(index: number): string {
  const noise = Math.random().toString(36).slice(2, 12);
  return `----=_PleinR_${index}_${noise}`;
}

type Part = { headers: string[]; body: string };

function textPart(contentType: string, value: string): Part {
  return {
    headers: [`Content-Type: ${contentType}; charset=UTF-8`, "Content-Transfer-Encoding: base64"],
    body: wrapBase64(utf8ToBase64(value)),
  };
}

function attachmentPart(attachment: MimeAttachment): Part {
  const disposition = attachment.contentId ? "inline" : "attachment";
  const headers = [
    `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: ${disposition}; filename="${attachment.filename}"`,
  ];
  if (attachment.contentId) headers.splice(2, 0, `Content-ID: <${attachment.contentId}>`);
  return { headers, body: wrapBase64(attachment.base64) };
}

function multipart(subtype: string, boundary: string, parts: Part[], extra = ""): Part {
  const body = [
    ...parts.flatMap((part) => [`--${boundary}`, ...part.headers, "", part.body]),
    `--${boundary}--`,
  ].join(CRLF);
  return {
    headers: [`Content-Type: multipart/${subtype}; ${extra}boundary="${boundary}"`],
    body,
  };
}

/**
 * Assemble le message complet. Structure choisie selon ce qui est fourni :
 *
 *   html seul                 → text/html
 *   html + texte              → multipart/alternative
 *   … + images en ligne       → multipart/related enveloppant le précédent
 */
export function buildMimeMessage(message: MimeMessage): string {
  const boundaryAt = (index: number) => message.boundaries?.[index] ?? randomBoundary(index);
  const inline = message.inline ?? [];

  let root: Part = textPart("text/html", message.html);
  if (message.text) {
    // L'ordre compte : le repli texte d'abord, la version préférée en dernier.
    root = multipart("alternative", boundaryAt(0), [
      textPart("text/plain", message.text),
      root,
    ]);
  }
  if (inline.length > 0) {
    root = multipart(
      "related",
      boundaryAt(1),
      [root, ...inline.map(attachmentPart)],
      'type="text/html"; ',
    );
  }

  const headers: string[] = [];
  for (const [key, value] of Object.entries(message.headers ?? {})) {
    headers.push(`${key}: ${encodeHeaderValue(value)}`);
  }
  if (message.from) headers.push(`From: ${message.from}`);
  if (message.to) headers.push(`To: ${message.to}`);
  if (message.replyTo) headers.push(`Reply-To: ${message.replyTo}`);
  headers.push(`Subject: ${encodeHeaderValue(message.subject)}`);
  headers.push("MIME-Version: 1.0");

  return [...headers, ...root.headers, "", root.body, ""].join(CRLF);
}
