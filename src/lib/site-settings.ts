import { asc } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";

export const SITE_SETTING_DEFAULTS = {
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
