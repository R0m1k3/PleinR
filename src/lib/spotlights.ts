/**
 * Carrousel « Entreprises à découvrir » de l'accueil : règles pures.
 *
 * Aucune dépendance serveur : verrouillé par `tests/spotlights.test.ts`.
 * `isDisplayable` est la **seule** définition de « s'affiche sur l'accueil » :
 * la requête ne filtre que `published`, la page et la route d'image appliquent
 * cette fonction.
 */

export const SPOTLIGHT_SLOTS = [1, 2, 3, 4] as const;
export const SPOTLIGHT_NAME_MAX = 160;
export const SPOTLIGHT_TEXT_MAX = 500;

/** Les navigateurs envoient les retours à la ligne d'un textarea en `\r\n`. */
export function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

/** Numéro d'emplacement 1 à 4, sinon `null`. */
export function parseSlot(raw: string): number | null {
  if (!/^[1-4]$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

/** Message d'erreur à afficher, ou `null`. Le texte arrive déjà normalisé. */
export function validateSpotlight(input: { published: boolean; name: string; text: string }): string | null {
  if (input.name.length > SPOTLIGHT_NAME_MAX) return `Nom trop long (${SPOTLIGHT_NAME_MAX} caractères maximum).`;
  if (input.text.length > SPOTLIGHT_TEXT_MAX) return `Texte trop long (${SPOTLIGHT_TEXT_MAX} caractères maximum).`;
  if (input.published && (!input.name.trim() || !input.text.trim())) {
    return "Nom et texte requis pour publier sur l'accueil.";
  }
  return null;
}

export function isDisplayable(row: { published: boolean; name: string; text: string }): boolean {
  return row.published && row.name.trim() !== "" && row.text.trim() !== "";
}
