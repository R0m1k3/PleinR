import type { MetadataRoute } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { getCategoriesInUse } from "@/lib/queries";
import { STATIC_ROUTES, absoluteUrl, categoryPath, memberPath } from "@/lib/seo";
import { publicBaseUrl } from "@/lib/seo-server";

export const dynamic = "force-dynamic";

/** /sitemap.xml : pages publiques + une entrée par adhérent actif. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await publicBaseUrl();

  // Pas de `lastModified` : sans date de mise à jour fiable en base, mieux vaut
  // l'omettre qu'annoncer une valeur que les moteurs finiraient par ignorer.
  const statics: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(base, route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  let rows: { id: number; name: string; city: string | null }[] = [];
  let categoriesInUse: { slug: string }[] = [];
  try {
    [rows, categoriesInUse] = await Promise.all([
      db
        .select({ id: members.id, name: members.name, city: members.city })
        .from(members)
        .where(eq(members.status, "active"))
        .orderBy(asc(members.id)),
      getCategoriesInUse(),
    ]);
  } catch {
    // Base indisponible : on livre au moins les pages statiques.
  }

  // Pages métier : seulement celles qui ont au moins un adhérent (les autres
  // sont en noindex, une page vide n'apporte rien aux moteurs).
  const metiers: MetadataRoute.Sitemap = categoriesInUse.map((c) => ({
    url: absoluteUrl(base, categoryPath(c.slug)),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const fiches: MetadataRoute.Sitemap = rows.map((m) => ({
    url: absoluteUrl(base, memberPath(m)),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...statics, ...metiers, ...fiches];
}
