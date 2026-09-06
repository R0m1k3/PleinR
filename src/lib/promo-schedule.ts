/**
 * Programmation de la publication d'une promotion.
 *
 * Une promotion validée peut soit partir tout de suite, soit attendre une
 * date choisie : c'est `promotions.publish_at`. Tant que cette date n'est pas
 * atteinte la promotion reste au statut `scheduled` — invisible sur le site
 * public (les lectures filtrent `status = 'live'`) et non diffusée sur les
 * réseaux. Le libérateur (`releaseDuePromotions`) fait la bascule.
 *
 * Ce module est **pur** : aucune base, aucun réseau. Il ne s'occupe que de la
 * conversion et du rendu des dates, et il est verrouillé par
 * `tests/promo-schedule.test.ts`.
 *
 * Le fuseau est celui de l'association, pas celui du serveur : un conteneur
 * qui tourne en UTC ne doit pas décaler d'une heure la publication demandée
 * par un adhérent lorrain.
 */

export const ASSOCIATION_TIME_ZONE = "Europe/Paris";

const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/;

/**
 * Décalage du fuseau de l'association à un instant donné, en millisecondes.
 * Passe par `Intl` plutôt que par une constante : l'heure d'été change deux
 * fois par an et une valeur figée publierait à la mauvaise heure la moitié de
 * l'année.
 */
function zoneOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ASSOCIATION_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  // `hour` vaut 24 à minuit avec hour12:false sur certaines plateformes.
  const hour = get("hour") % 24;
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return asIfUtc - instant.getTime();
}

/**
 * Convertit la saisie d'un `<input type="datetime-local">` (heure locale de
 * l'association) en instant absolu.
 *
 * Renvoie `null` si le champ est vide, et lève si la saisie n'a pas la forme
 * attendue : une date illisible ne doit pas se transformer silencieusement en
 * publication immédiate.
 */
export function parseScheduleInput(value: string | null | undefined): Date | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  const m = LOCAL_DATETIME.exec(raw);
  if (!m) throw new Error("Date de programmation invalide.");
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];

  // `Date.UTC` accepte 13 comme mois ou 99 comme heure en débordant sur la
  // date suivante : on refuse plutôt que de publier à un moment inattendu.
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) {
    throw new Error("Date de programmation invalide.");
  }

  const naive = Date.UTC(y, mo - 1, d, h, mi);
  if (new Date(naive).getUTCDate() !== d) throw new Error("Date de programmation invalide.");
  // Deux passes : la première donne un décalage approché, la seconde le corrige
  // quand la date tombe juste après un changement d'heure.
  const first = new Date(naive - zoneOffsetMs(new Date(naive)));
  const exact = new Date(naive - zoneOffsetMs(first));
  if (Number.isNaN(exact.getTime())) throw new Error("Date de programmation invalide.");
  return exact;
}

/** Valeur à remettre dans un `<input type="datetime-local">`. */
export function toScheduleInput(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() + zoneOffsetMs(date));
  return local.toISOString().slice(0, 16);
}

/** Une programmation passée n'a plus lieu d'être : on publie tout de suite. */
export function isDue(publishAt: Date | null | undefined, now = new Date()): boolean {
  return !publishAt || publishAt.getTime() <= now.getTime();
}

/** `true` si la promotion doit attendre. */
export function isPending(publishAt: Date | null | undefined, now = new Date()): boolean {
  return !isDue(publishAt, now);
}

/** « le 12 mars 2027 à 09:00 » — sans majuscule, à insérer dans une phrase. */
export function formatSchedule(publishAt: Date | null | undefined): string | null {
  if (!publishAt || Number.isNaN(publishAt.getTime())) return null;
  const day = new Intl.DateTimeFormat("fr-FR", {
    timeZone: ASSOCIATION_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(publishAt);
  const time = new Intl.DateTimeFormat("fr-FR", {
    timeZone: ASSOCIATION_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(publishAt);
  return `le ${day} à ${time}`;
}

/** Phrase complète pour le backoffice. */
export function scheduleLabel(publishAt: Date | null | undefined): string | null {
  const when = formatSchedule(publishAt);
  return when ? `Publication programmée ${when}` : null;
}
