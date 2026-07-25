import { asc } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";

export const SITE_SETTING_DEFAULTS = {
  // URL publique de l'application : sert à l'adresse de retour OAuth des réseaux
  // sociaux et au lien inséré dans les publications.
  site_public_url: "",
  association_name: "Plein R",
  association_tagline: "Association des commerçants et entreprises du Bassin de Pompey.",
  association_intro:
    "Plein R rassemble les acteurs économiques locaux autour du réseau, des rencontres et de la mise en valeur du territoire.",
  association_mission:
    "Créer du lien entre adhérents, encourager les échanges de proximité et porter une dynamique collective au service du Bassin de Pompey.",
  association_address: "",
  association_email: "",
  association_phone: "",
  association_website: "",
  association_facebook:
    "https://www.facebook.com/search/top?q=pleinr%20-%20les%20bons%20plan%20du%20bassin%20de%20pompey",
  association_linkedin:
    "https://www.linkedin.com/company/association-plein-r-bassin-de-pompey/",
  association_siret: "",
  association_rna: "",
  association_contact: "",
  association_president: "",
  association_president_role: "Présidence",
  association_president_message: "",
  association_president_photo: "",
  association_vice_president: "",
  association_treasurer: "",
  association_secretary: "",
  association_board_members: "",
  association_host_name: "",
  association_host_address: "",
  association_host_phone: "",
  association_publication_director: "",
  association_privacy_contact: "",
  legal_updated: "",
};

export type SiteSettings = typeof SITE_SETTING_DEFAULTS;
export type SiteSettingKey = keyof SiteSettings;

export async function getSiteSettings(): Promise<SiteSettings> {
  const rows = await db.select().from(siteSettings).orderBy(asc(siteSettings.key));
  const merged = { ...SITE_SETTING_DEFAULTS };
  for (const row of rows) {
    if (row.key in merged) {
      merged[row.key as SiteSettingKey] = row.value ?? "";
    }
  }
  return merged;
}

export type SocialLink = {
  network: "facebook" | "linkedin";
  label: string;
  handle: string;
  href: string;
};

/** Réseaux sociaux publics de l'association, dans l'ordre d'affichage. */
export function socialLinks(settings: SiteSettings): SocialLink[] {
  const links: SocialLink[] = [];
  const facebook = settings.association_facebook.trim();
  const linkedin = settings.association_linkedin.trim();
  if (facebook) {
    links.push({
      network: "facebook",
      label: "Facebook",
      handle: "Plein R — Les bons plans du Bassin de Pompey",
      href: facebook,
    });
  }
  if (linkedin) {
    links.push({
      network: "linkedin",
      label: "LinkedIn",
      handle: "Association Plein R — Bassin de Pompey",
      href: linkedin,
    });
  }
  return links;
}

export function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseBoardMembers(value: string) {
  return splitLines(value).map((line) => {
    const [name, role] = line.split("|").map((part) => part.trim());
    return { name, role: role || "Membre du directoire" };
  });
}
