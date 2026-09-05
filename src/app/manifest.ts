import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, THEME_COLOR } from "@/lib/seo";

/** Manifeste web : nom, icône et couleurs, pour l'ajout à l'écran d'accueil. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_TITLE,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    lang: "fr",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F2E8",
    theme_color: THEME_COLOR,
    icons: [{ src: "/assets/logo.png", sizes: "any", type: "image/png" }],
  };
}
