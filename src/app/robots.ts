import type { MetadataRoute } from "next";
import { PRIVATE_PATHS, absoluteUrl } from "@/lib/seo";
import { publicBaseUrl } from "@/lib/seo-server";

export const dynamic = "force-dynamic";

/** /robots.txt : tout le site public est explorable, l'espace privé exclu. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await publicBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: base ? absoluteUrl(base, "/sitemap.xml") : undefined,
  };
}
