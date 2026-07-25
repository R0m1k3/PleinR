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
    "Plein R fédère les commerçants, artisans et entreprises du Bassin de Pompey autour d'une conviction simple : on va plus loin ensemble. L'association crée les occasions de se rencontrer, de se connaître et de travailler les uns avec les autres.\n\n" +
    "Nous mettons chaque adhérent en avant auprès des habitants comme des autres professionnels du territoire : une fiche dans l'annuaire, des bons plans relayés sur le site et sur nos réseaux sociaux, une place dans nos rencontres et nos publications.\n\n" +
    "L'objectif est double : amener des clients aux commerces de proximité, et faire naître des courants d'affaires entre les entreprises du bassin.",
  association_pillars:
    "Se rencontrer|Des rendez-vous réguliers entre adhérents pour échanger, partager les bonnes pratiques et rompre l'isolement du quotidien.\n" +
    "Gagner en visibilité|Une fiche dans l'annuaire, vos promotions relayées sur le site et sur les pages Facebook et LinkedIn de l'association.\n" +
    "Attirer des clients (B to C)|Vos offres mises sous les yeux des habitants du bassin, pour faire vivre le commerce de proximité toute l'année.\n" +
    "Développer des affaires (B to B)|Un réseau de professionnels qui se connaissent et se recommandent : prestataires, fournisseurs et partenaires à deux pas.",
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

/** Paragraphes d'un champ libre : une ligne vide sépare deux paragraphes. */
export function parseParagraphs(value: string) {
  return value
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.replace(/\s*\r?\n\s*/g, " ").trim())
    .filter(Boolean);
}

/** « Titre|Description », une ligne par apport de l'association. */
export function parsePillars(value: string) {
  return splitLines(value)
    .map((line) => {
      const [title, description] = line.split("|").map((part) => part.trim());
      return { title, description: description ?? "" };
    })
    .filter((pillar) => pillar.title);
}

export function parseBoardMembers(value: string) {
  return splitLines(value).map((line) => {
    const [name, role] = line.split("|").map((part) => part.trim());
    return { name, role: role || "Membre du directoire" };
  });
}
