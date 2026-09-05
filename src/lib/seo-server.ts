import { headers } from "next/headers";
import { siteUrl } from "@/lib/social-accounts";

/**
 * URL publique du site pour le référencement (canoniques, sitemap, JSON-LD).
 *
 * Priorité au réglage `site_public_url` (Backend › Réseaux sociaux) puis aux
 * variables d'environnement, via `siteUrl()`. En dernier recours, l'URL est
 * déduite des en-têtes de la requête (reverse proxy compris) : le site reste
 * ainsi correctement référencé tant que le réglage n'est pas renseigné.
 */
export async function publicBaseUrl(): Promise<string> {
  const configured = await siteUrl().catch(() => "");
  if (configured) return configured;
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    if (!host) return "";
    const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${protocol}://${host}`.replace(/\/+$/, "");
  } catch {
    // Hors requête (génération de robots/sitemap au build par exemple).
    return "";
  }
}

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
