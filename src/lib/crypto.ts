import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Chiffrement des secrets stockés en base (jetons OAuth, secrets d'application).
 *
 * AES-256-GCM : le tag d'authentification garantit qu'une valeur altérée en base
 * est rejetée au lieu d'être déchiffrée en silence.
 *
 * La clé dérive de `SOCIAL_TOKEN_KEY`, avec repli sur `AUTH_SECRET` pour ne rien
 * imposer aux déploiements existants. Conséquence : changer `AUTH_SECRET` sans
 * avoir posé `SOCIAL_TOKEN_KEY` rend les secrets illisibles — il suffit alors de
 * reconnecter les comptes, aucune donnée métier n'est perdue.
 */

const PREFIX = "v1";
const SALT = "pleinr.social.v1";

function secretMaterial(): string {
  const key = (process.env.SOCIAL_TOKEN_KEY ?? "").trim() || (process.env.AUTH_SECRET ?? "").trim();
  if (!key) {
    throw new Error(
      "Chiffrement indisponible : définissez SOCIAL_TOKEN_KEY (ou AUTH_SECRET) sur le serveur."
    );
  }
  return key;
}

function key(): Buffer {
  return scryptSync(secretMaterial(), SALT, 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error("Secret chiffré illisible (format inattendu).");
  }
  const [, iv, tag, payload] = parts;
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(payload, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Déchiffre sans lever : une clé changée ne doit pas casser l'affichage. */
export function tryDecryptSecret(stored: string | null): string | null {
  if (!stored) return null;
  try {
    return decryptSecret(stored);
  } catch {
    return null;
  }
}
