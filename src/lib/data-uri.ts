/**
 * Décode une image stockée en data-URI (`data:image/png;base64,…`) en octets,
 * pour les routes qui la servent comme un fichier ordinaire. Tout autre type
 * (SVG, HTML…) est refusé.
 */
const DATA_URI = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/;

export function decodeImageDataUri(value: string): { mime: string; bytes: Buffer<ArrayBuffer> } | null {
  const match = DATA_URI.exec(value);
  if (!match) return null;
  return { mime: match[1], bytes: Buffer.from(match[2].replace(/\s+/g, ""), "base64") };
}
