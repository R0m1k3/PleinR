import { PRIVATE_PATHS } from "@/lib/seo";

/**
 * Mesure d'audience Google Analytics 4.
 *
 * Module **pur** (verrouillé par `tests/analytics.test.ts`) : il ne sait ni lire
 * la base ni rendre du HTML, il décide seulement ce qui part dans la page.
 * L'identifiant vient du réglage `google_analytics_id` (Backend › Paramètres) :
 * tant qu'il est vide, aucune balise n'est posée et aucun appel n'est fait.
 */

/** Identifiant de mesure GA4 : « G- » suivi de l'identifiant du flux. */
const MEASUREMENT_ID = /^G-[A-Z0-9]{4,24}$/;

/**
 * Valide la saisie de l'administrateur avant qu'elle n'atteigne la page.
 *
 * Renvoie `""` pour tout ce qui n'est pas un identifiant GA4 : c'est la garde
 * qui interdit d'injecter une chaîne arbitraire dans le script en ligne — un
 * identifiant validé ne contient ni guillemet, ni `<`, ni `</script>`.
 * Les identifiants Universal Analytics (`UA-…`), arrêtés depuis 2023, sont
 * refusés : ils ne collectent plus rien.
 */
export function normalizeMeasurementId(raw: string | null | undefined): string {
  const value = (raw ?? "").trim().toUpperCase();
  return MEASUREMENT_ID.test(value) ? value : "";
}

/** URL du chargeur gtag.js pour un identifiant **déjà normalisé**. */
export function gtagSrc(measurementId: string): string {
  const id = normalizeMeasurementId(measurementId);
  return id ? `https://www.googletagmanager.com/gtag/js?id=${id}` : "";
}

/**
 * Script d'amorçage de gtag.js. Il porte le nonce de la CSP comme le reste des
 * scripts du site ; les scripts que gtag.js charge ensuite passent grâce à
 * `'strict-dynamic'`.
 */
export function gtagConfigScript(measurementId: string): string {
  const id = normalizeMeasurementId(measurementId);
  if (!id) return "";
  return [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    "gtag('js',new Date());",
    `gtag('config','${id}');`,
  ].join("");
}

/**
 * Seules les pages publiques sont mesurées.
 *
 * L'espace adhérent et le backoffice portent des identifiants de membres et de
 * promotions dans leurs URLs : les envoyer à un tiers n'apporterait rien et
 * ferait sortir des données personnelles du site.
 */
export function isTrackedPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? "/";
  return !PRIVATE_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Jeton de validation Search Console (balise `google-site-verification`). */
export function normalizeSiteVerification(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  // Google livre un jeton alphanumérique d'une quarantaine de caractères ; on
  // refuse le reste — dont la balise <meta> complète, collée telle quelle —
  // plutôt que de recopier dans le <head> une chaîne venue de n'importe où.
  return /^[A-Za-z0-9_-]{20,128}$/.test(value) ? value : "";
}
