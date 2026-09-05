import type { MetadataRoute } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema";
import { STATIC_ROUTES, absoluteUrl, memberPath } from "@/lib/seo";
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

  let rows: { id: number }[] = [];
  try {
    rows = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.status, "active"))
      .orderBy(asc(members.id));
  } catch {
    // Base indisponible : on livre au moins les pages statiques.
  }

  const fiches: MetadataRoute.Sitemap = rows.map((m) => ({
    url: absoluteUrl(base, memberPath(m.id)),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...statics, ...fiches];
}
