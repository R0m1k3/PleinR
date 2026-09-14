/**
 * Description d'une image déposée dans un formulaire : dimensions, format et
 * poids, plus les remarques à montrer à l'adhérent avant l'envoi.
 *
 * Module **pur** (aucun accès DOM, base ou réseau) : il est appelé depuis un
 * composant client, et verrouillé par `tests/image-info.test.ts`.
 *
 * Le besoin vient des réseaux sociaux. L'application publie le fichier tel
 * quel — `loadPromoImage()` décode la data-URI et envoie les octets sans y
 * toucher — donc un visuel qui n'est pas au format attendu par Facebook ou
 * LinkedIn est recadré ou entouré de bandes de couleur *par la plateforme*,
 * une couleur prise dans l'image. Rien ne se voit côté site, qui recadre en
 * `cover` : d'où l'information au moment du dépôt, seul endroit où l'adhérent
 * peut encore changer de fichier.
 */

export type ImageInfo = {
  /** Largeur en pixels. */
  width: number;
  /** Hauteur en pixels. */
  height: number;
  /** Poids du fichier d'origine, en octets. */
  bytes: number;
};

/** Écart toléré autour du carré parfait (2 %) : 1080×1078 reste « carré ». */
export const SQUARE_TOLERANCE = 0.02;

/** En dessous, l'image sera floue une fois agrandie dans un fil d'actualité. */
export const MIN_SIDE = 800;

/** Côté conseillé, celui qu'attendent les deux réseaux. */
export const IDEAL_SIDE = 1080;

/**
 * Au delà, la data-URI (base64, ~+33 %) approche la limite de 4 Mo des server
 * actions : l'envoi peut être refusé.
 */
export const MAX_BYTES = 2_500_000;

/** Formats courants reconnus, du plus au moins fréquent. */
const KNOWN_RATIOS: { ratio: number; label: string }[] = [
  { ratio: 1, label: "1:1" },
  { ratio: 4 / 5, label: "4:5" },
  { ratio: 5 / 4, label: "5:4" },
  { ratio: 3 / 4, label: "3:4" },
  { ratio: 4 / 3, label: "4:3" },
  { ratio: 2 / 3, label: "2:3" },
  { ratio: 3 / 2, label: "3:2" },
  { ratio: 9 / 16, label: "9:16" },
  { ratio: 16 / 9, label: "16:9" },
  { ratio: 1.91, label: "1,91:1" },
];

function isValid(info: ImageInfo): boolean {
  return (
    Number.isFinite(info.width) &&
    Number.isFinite(info.height) &&
    info.width > 0 &&
    info.height > 0
  );
}

/** Poids lisible : « 840 Ko », « 1,2 Mo ». */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1000) return `${Math.round(bytes)} o`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} Ko`;
  const mo = bytes / 1_000_000;
  // Une décimale jusqu'à 10 Mo, virgule française.
  const value = mo < 10 ? mo.toFixed(1).replace(".", ",") : String(Math.round(mo));
  return `${value} Mo`;
}

/**
 * Libellé du rapport largeur/hauteur : un format courant quand il en approche
 * un à 2 % près, sinon une approximation décimale plutôt qu'un « 1083:721 »
 * illisible.
 */
export function aspectLabel(width: number, height: number): string {
  if (!isValid({ width, height, bytes: 0 })) return "";
  const ratio = width / height;
  for (const known of KNOWN_RATIOS) {
    if (Math.abs(ratio - known.ratio) / known.ratio <= SQUARE_TOLERANCE) return known.label;
  }
  return ratio >= 1
    ? `${ratio.toFixed(2).replace(".", ",")}:1`
    : `1:${(1 / ratio).toFixed(2).replace(".", ",")}`;
}

/** `true` si l'image est carrée à la tolérance près. */
export function isSquare(info: ImageInfo): boolean {
  if (!isValid(info)) return false;
  return Math.abs(info.width / info.height - 1) <= SQUARE_TOLERANCE;
}

/** Orientation en toutes lettres, pour accompagner le ratio. */
export function orientationLabel(info: ImageInfo): string {
  if (!isValid(info)) return "";
  if (isSquare(info)) return "carré";
  return info.width > info.height ? "paysage" : "portrait";
}

/** « 1080 × 1350 px · portrait 4:5 · 420 Ko ». */
export function imageSummary(info: ImageInfo): string {
  if (!isValid(info)) return "";
  const parts = [
    `${Math.round(info.width)} × ${Math.round(info.height)} px`,
    `${orientationLabel(info)} ${aspectLabel(info.width, info.height)}`.trim(),
  ];
  const weight = formatBytes(info.bytes);
  if (weight) parts.push(weight);
  return parts.join(" · ");
}

export type ImageNote = { tone: "warn" | "info"; text: string };

/**
 * Remarques à afficher sous l'aperçu. Elles **informent**, elles ne bloquent
 * pas : un visuel non carré reste publiable, l'adhérent doit seulement savoir
 * ce que les réseaux en feront.
 */
export function imageNotes(info: ImageInfo): ImageNote[] {
  if (!isValid(info)) return [];
  const notes: ImageNote[] = [];

  if (!isSquare(info)) {
    notes.push({
      tone: "warn",
      text:
        `Format ${aspectLabel(info.width, info.height)} : sur Facebook et LinkedIn, l'image sera ` +
        `recadrée ou entourée de bandes de couleur. Une image carrée (${IDEAL_SIDE} × ${IDEAL_SIDE} px) ` +
        `s'affiche entière.`,
    });
  }

  if (Math.min(info.width, info.height) < MIN_SIDE) {
    notes.push({
      tone: "warn",
      text: `Image de petite taille : elle paraîtra floue une fois agrandie. Visez ${IDEAL_SIDE} px de côté.`,
    });
  }

  if (info.bytes > MAX_BYTES) {
    notes.push({
      tone: "warn",
      text: `Fichier lourd (${formatBytes(info.bytes)}) : l'envoi peut être refusé. Compressez l'image avant de la déposer.`,
    });
  }

  if (notes.length === 0) {
    notes.push({ tone: "info", text: "Format idéal : l'image s'affichera entière sur le site et sur les réseaux." });
  }

  return notes;
}
