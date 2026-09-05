import type { Metadata } from "next";
import type { DaySchedule, WeekDayKey } from "@/lib/member-profile";
import type { SiteSettings, SocialLink } from "@/lib/site-settings";

/**
 * Référencement : constantes, métadonnées et données structurées (JSON-LD).
 *
 * Tout ce module est **pur** : aucune lecture en base, aucun accès aux en-têtes
 * de requête. Les pages lui passent l'URL publique obtenue via
 * `publicBaseUrl()` (src/lib/seo-server.ts). Cela permet de verrouiller le
 * comportement par des tests unitaires (tests/seo.test.ts).
 */

export const SITE_NAME = "Plein R";
export const SITE_TITLE = "Plein R — Commerçants & entreprises du Bassin de Pompey";
export const SITE_DESCRIPTION =
  "Plein R, association des commerçants, artisans et entreprises du Bassin de Pompey : " +
  "annuaire des professionnels, bons plans et rencontres près de chez vous.";
export const SITE_LOCALE = "fr_FR";
export const THEME_COLOR = "#E0A63C";

/** Mots-clés de la thématique : commerce de proximité sur le Bassin de Pompey. */
export const SITE_KEYWORDS = [
  "Plein R",
  "Bassin de Pompey",
  "commerçants Bassin de Pompey",
  "association de commerçants",
  "entreprises Pompey",
  "artisans Pompey",
  "commerces Frouard",
  "commerces Liverdun",
  "commerces Champigneulles",
  "commerces Custines",
  "annuaire des professionnels",
  "bons plans",
  "promotions locales",
  "commerce de proximité",
  "Meurthe-et-Moselle",
  "Lorraine",
];

/** Longueur cible d'une meta description : Google tronque vers 155–160 caractères. */
export const DESCRIPTION_MAX_LENGTH = 155;

/** Pages transactionnelles ou privées : jamais indexées. */
export const NOINDEX: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false, noimageindex: true },
};

/** Directives d'indexation généreuses pour les pages publiques. */
export const INDEX_FOLLOW: NonNullable<Metadata["robots"]> = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

/** Chemins exclus des moteurs (robots.txt + sitemap). */
export const PRIVATE_PATHS = ["/backend", "/api", "/login", "/inscription"];

/** Pages publiques statiques, avec leur priorité relative dans le sitemap. */
export const STATIC_ROUTES: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/annuaire", priority: 0.9, changeFrequency: "daily" },
  { path: "/association", priority: 0.8, changeFrequency: "weekly" },
  { path: "/rencontres-passees", priority: 0.6, changeFrequency: "monthly" },
  { path: "/mentions-legales", priority: 0.2, changeFrequency: "yearly" },
  { path: "/confidentialite", priority: 0.2, changeFrequency: "yearly" },
];

/** Construit une URL absolue à partir de l'URL publique et d'un chemin. */
export function absoluteUrl(baseUrl: string, path = "/"): string {
  const base = baseUrl.replace(/\/+$/, "");
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Chemin canonique d'une fiche adhérent. */
export function memberPath(id: number): string {
  return `/adherents/${id}`;
}

/**
 * Ramène un texte libre à une meta description propre : espaces normalisés,
 * coupée sur un mot entier avec une ellipse si elle dépasse la longueur cible.
 */
export function metaDescription(text: string | null | undefined, fallback = SITE_DESCRIPTION): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return metaDescription(fallback, "");
  if (clean.length <= DESCRIPTION_MAX_LENGTH) return clean;
  const cut = clean.slice(0, DESCRIPTION_MAX_LENGTH - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.!?–—-]+$/, "")}…`;
}

/**
 * Sérialise un objet JSON-LD pour l'insérer dans un `<script>`.
 *
 * Les données viennent en partie des adhérents (descriptions, noms) : on échappe
 * `<`, `>` et `&` en séquences Unicode pour qu'aucune saisie ne puisse fermer la
 * balise `</script>` et injecter du HTML. JSON reste strictement valide.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Retire les clés dont la valeur est vide : JSON-LD n'aime pas les `null`. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out as Partial<T>;
}

// ---------------------------------------------------------------------------
// Données structurées
// ---------------------------------------------------------------------------

export function organizationId(baseUrl: string): string {
  return `${absoluteUrl(baseUrl)}#organization`;
}

export function webSiteId(baseUrl: string): string {
  return `${absoluteUrl(baseUrl)}#website`;
}

/** L'association elle-même (utilisée sur toutes les pages via le layout). */
export function organizationJsonLd(baseUrl: string, settings: SiteSettings, socials: SocialLink[]) {
  const address = settings.association_address.trim();
  return compact({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationId(baseUrl),
    name: settings.association_name || SITE_NAME,
    alternateName: "Association Plein R — Bassin de Pompey",
    legalName: settings.association_name ? `Association ${settings.association_name}` : undefined,
    url: absoluteUrl(baseUrl),
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl(baseUrl, "/assets/logo.png"),
    },
    image: absoluteUrl(baseUrl, "/opengraph-image"),
    description: metaDescription(settings.association_intro || settings.association_tagline),
    slogan: "Réseau · Rencontre · Réussite",
    email: settings.association_email.trim() || undefined,
    telephone: settings.association_phone.trim() || undefined,
    address: address
      ? { "@type": "PostalAddress", streetAddress: address, addressCountry: "FR" }
      : undefined,
    areaServed: {
      "@type": "AdministrativeArea",
      name: "Bassin de Pompey, Meurthe-et-Moselle, France",
    },
    sameAs: socials.map((s) => s.href),
  });
}

/** Le site et sa fonction de recherche (annuaire), pour la « sitelinks searchbox ». */
export function webSiteJsonLd(baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": webSiteId(baseUrl),
    name: SITE_NAME,
    alternateName: SITE_TITLE,
    url: absoluteUrl(baseUrl),
    inLanguage: "fr-FR",
    publisher: { "@id": organizationId(baseUrl) },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl(baseUrl, "/annuaire")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export type BreadcrumbItem = { name: string; path: string };

/** Fil d'Ariane : améliore l'affichage du chemin dans les résultats. */
export function breadcrumbJsonLd(baseUrl: string, items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(baseUrl, item.path),
    })),
  };
}

const SCHEMA_DAYS: Record<WeekDayKey, string> = {
  monday: "https://schema.org/Monday",
  tuesday: "https://schema.org/Tuesday",
  wednesday: "https://schema.org/Wednesday",
  thursday: "https://schema.org/Thursday",
  friday: "https://schema.org/Friday",
  saturday: "https://schema.org/Saturday",
  sunday: "https://schema.org/Sunday",
};

/** Horaires d'un adhérent au format `OpeningHoursSpecification`. */
export function openingHoursJsonLd(hours: DaySchedule[]) {
  return hours
    .filter((day) => !day.closed && day.slots.length > 0)
    .flatMap((day) =>
      day.slots.map((slot) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: SCHEMA_DAYS[day.key],
        opens: slot.start,
        closes: slot.end,
      }))
    );
}

export type LocalBusinessInput = {
  id: number;
  name: string;
  description: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  categoryLabel: string | null;
  tags: string | null;
};

/** Une fiche adhérent : commerce ou entreprise locale. */
export function localBusinessJsonLd(
  baseUrl: string,
  member: LocalBusinessInput,
  hours: DaySchedule[],
  website: string | null
) {
  const hasAddress = Boolean(member.address || member.postalCode || member.city);
  const keywords = (member.tags ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const url = absoluteUrl(baseUrl, memberPath(member.id));
  return compact({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${url}#business`,
    name: member.name,
    description: member.description ? metaDescription(member.description, "") : undefined,
    url: website ?? url,
    mainEntityOfPage: url,
    telephone: member.phone ?? undefined,
    email: member.email ?? undefined,
    address: hasAddress
      ? compact({
          "@type": "PostalAddress",
          streetAddress: member.address ?? undefined,
          postalCode: member.postalCode ?? undefined,
          addressLocality: member.city ?? undefined,
          addressRegion: "Grand Est",
          addressCountry: "FR",
        })
      : undefined,
    openingHoursSpecification: openingHoursJsonLd(hours),
    keywords: keywords.length > 0 ? keywords.join(", ") : undefined,
    additionalType: member.categoryLabel ?? undefined,
    memberOf: { "@id": organizationId(baseUrl) },
  });
}

export type EventInput = {
  id: number;
  title: string;
  startsAt: Date;
  location: string | null;
  description: string | null;
  capacity: number;
  registered: number;
};

/** Une rencontre à venir de l'association. */
export function eventJsonLd(baseUrl: string, meeting: EventInput) {
  const remaining = Math.max(0, meeting.capacity - Number(meeting.registered));
  return compact({
    "@context": "https://schema.org",
    "@type": "BusinessEvent",
    name: meeting.title,
    description: meeting.description ? metaDescription(meeting.description, "") : undefined,
    startDate: meeting.startsAt.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: meeting.location
      ? { "@type": "Place", name: meeting.location, address: meeting.location }
      : undefined,
    organizer: { "@id": organizationId(baseUrl) },
    url: absoluteUrl(baseUrl, "/association"),
    maximumAttendeeCapacity: meeting.capacity,
    remainingAttendeeCapacity: remaining,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      availability: remaining > 0 ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      url: absoluteUrl(baseUrl, `/inscription/${meeting.id}`),
    },
  });
}

export type ItemListEntry = { id: number; name: string; description?: string | null };

/** Liste d'adhérents (annuaire) : chaque entrée pointe vers sa fiche. */
export function memberListJsonLd(baseUrl: string, name: string, members: ItemListEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: members.length,
    itemListElement: members.map((m, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(baseUrl, memberPath(m.id)),
      name: m.name,
    })),
  };
}

/**
 * Image de partage par défaut (générée par app/opengraph-image.tsx). Une page
 * qui définit son propre `openGraph` remplace celui du layout en bloc : il faut
 * donc redonner l'image explicitement, sinon elle disparaît des partages.
 */
export const SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: SITE_TITLE,
  type: "image/png",
};

/** Métadonnées Open Graph / Twitter communes, complétées par chaque page. */
export function pageMetadata(input: {
  title: string;
  /** Titre complet pour Open Graph quand le titre de page est déjà « absolu ». */
  ogTitle?: string;
  description: string;
  path: string;
  robots?: Metadata["robots"];
  ogType?: "website" | "profile" | "article";
}): Metadata {
  const ogTitle = input.ogTitle ?? `${input.title} · ${SITE_NAME}`;
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      title: ogTitle,
      description: input.description,
      url: input.path,
      type: input.ogType ?? "website",
      locale: SITE_LOCALE,
      siteName: SITE_NAME,
      images: [SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: input.description,
      images: [SHARE_IMAGE],
    },
    robots: input.robots ?? INDEX_FOLLOW,
  };
}
