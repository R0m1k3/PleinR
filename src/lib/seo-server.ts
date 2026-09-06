import { publicBaseUrl } from "@/lib/social-accounts";

/**
 * URL publique du site pour le référencement (canoniques, sitemap, JSON-LD).
 *
 * Priorité au réglage `site_public_url` (Backend › Réseaux sociaux) puis aux
 * variables d'environnement ; en dernier recours, l'URL est déduite des
 * en-têtes de la requête (reverse proxy compris). Voir `publicBaseUrl()`.
 */
export { publicBaseUrl };

/** `metadataBase` pour Next : indéfini si aucune URL n'est connue. */
export async function metadataBase(): Promise<URL | undefined> {
  const base = await publicBaseUrl();
  if (!base) return undefined;
  try {
    return new URL(base);
  } catch {
    return undefined;
  }
}
