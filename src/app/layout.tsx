import type { Metadata, Viewport } from "next";
import { JsonLd } from "@/components/JsonLd";
import {
  INDEX_FOLLOW,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_LOCALE,
  SITE_NAME,
  SITE_TITLE,
  THEME_COLOR,
  organizationJsonLd,
  webSiteJsonLd,
} from "@/lib/seo";
import { metadataBase, publicBaseUrl } from "@/lib/seo-server";
import { getSiteSettings, socialLinks } from "@/lib/site-settings";
import "./globals.css";

// Rendu dynamique pour toutes les pages : la CSP à nonce du middleware ne peut
// pas signer les scripts d'un HTML pré-généré au build. Toutes les pages
// interrogent de toute façon la base.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: THEME_COLOR,
  colorScheme: "light",
};

/**
 * Métadonnées par défaut de tout le site. Chaque page complète ou remplace
 * titre, description et canonique ; `metadataBase` rend absolues les URLs
 * relatives (canonique, Open Graph, image de partage).
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: await metadataBase(),
    title: {
      default: SITE_TITLE,
      template: `%s · ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    keywords: SITE_KEYWORDS,
    authors: [{ name: `Association ${SITE_NAME}` }],
    creator: `Association ${SITE_NAME}`,
    publisher: `Association ${SITE_NAME}`,
    category: "business",
    referrer: "strict-origin-when-cross-origin",
    // Pas de canonique ici : chaque page publique pose la sienne via
    // `pageMetadata()` ; les pages privées (noindex) n'en ont pas.
    openGraph: {
      type: "website",
      locale: SITE_LOCALE,
      siteName: SITE_NAME,
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      url: "/",
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
    },
    robots: INDEX_FOLLOW,
    icons: {
      icon: [{ url: "/assets/logo.png", type: "image/png" }],
      apple: [{ url: "/assets/logo.png", type: "image/png" }],
      shortcut: ["/assets/logo.png"],
    },
    manifest: "/manifest.webmanifest",
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Données structurées communes : l'association (Organization) et le site
  // (WebSite + recherche dans l'annuaire). Ne bloque jamais le rendu.
  const [baseUrl, settings] = await Promise.all([
    publicBaseUrl(),
    getSiteSettings().catch(() => null),
  ]);
  const structuredData = settings
    ? [organizationJsonLd(baseUrl, settings, socialLinks(settings)), webSiteJsonLd(baseUrl)]
    : [webSiteJsonLd(baseUrl)];

  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Public+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
        {/* Fallback: if JS is disabled, never keep revealed content hidden. */}
        <noscript>
          <style>{`.reveal,.reveal-stagger>*{opacity:1!important}`}</style>
        </noscript>
      </head>
      <body>
        {children}
        <JsonLd data={structuredData} />
      </body>
    </html>
  );
}
