/**
 * Période de validité d'une promotion.
 *
 * Module **pur** : aucune dépendance à la base ni à React, pour être verrouillé
 * par les tests. Les dates arrivent en `YYYY-MM-DD` (colonnes `date` de
 * Postgres, lues telles quelles par Drizzle) et sont donc traitées comme des
 * jours calendaires, sans fuseau horaire.
 */

export type PromoValidity = {
  startsOn?: string | null;
  endsOn?: string | null;
  /** Texte libre des anciennes promotions, utilisé à défaut de dates. */
  validUntil?: string | null;
};

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

type Parts = { day: number; month: number; year: number };

function parse(value: string | null | undefined): Parts | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const parts = { day: Number(day), month: Number(month) - 1, year: Number(year) };
  if (parts.month < 0 || parts.month > 11 || parts.day < 1 || parts.day > 31) return null;
  return parts;
}

/** « 1er » et non « 1 », comme on l'écrit en français. */
function dayLabel(day: number): string {
  return day === 1 ? "1er" : String(day);
}

function full(p: Parts): string {
  return `${dayLabel(p.day)} ${MONTHS[p.month]} ${p.year}`;
}

/**
 * Phrase de validité, ou `null` si la promotion n'en a pas.
 * L'année et le mois ne sont répétés que lorsqu'ils changent : « du 1er au
 * 15 mars 2027 » plutôt que « du 1er mars 2027 au 15 mars 2027 ».
 */
export function formatValidity(promo: PromoValidity): string | null {
  const start = parse(promo.startsOn);
  const end = parse(promo.endsOn);

  if (start && end) {
    const sameYear = start.year === end.year;
    const sameMonth = sameYear && start.month === end.month;
    const from = sameMonth
      ? dayLabel(start.day)
      : sameYear
        ? `${dayLabel(start.day)} ${MONTHS[start.month]}`
        : full(start);
    return `Valable du ${from} au ${full(end)}`;
  }
  if (end) return `Valable jusqu'au ${full(end)}`;
  if (start) return `Valable à partir du ${full(start)}`;

  const legacy = promo.validUntil?.trim();
  return legacy || null;
}

/** Variante sans le mot « Valable », pour les libellés déjà introduits. */
export function formatValidityShort(promo: PromoValidity): string | null {
  const formatted = formatValidity(promo);
  if (!formatted) return null;
  return formatted.replace(/^Valable /, "");
}

/** `true` si la date de fin est dépassée. Un jour de fin reste valable en entier. */
export function isExpired(promo: PromoValidity, today = new Date()): boolean {
  const end = parse(promo.endsOn);
  if (!end) return false;
  const endOfDay = Date.UTC(end.year, end.month, end.day, 23, 59, 59);
  return today.getTime() > endOfDay;
}

/** Bornes invalides : fin antérieure au début. */
export function isRangeInvalid(promo: PromoValidity): boolean {
  const start = parse(promo.startsOn);
  const end = parse(promo.endsOn);
  if (!start || !end) return false;
  return Date.UTC(end.year, end.month, end.day) < Date.UTC(start.year, start.month, start.day);
}
