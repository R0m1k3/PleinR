/**
 * Plan de compression des images déposées dans le backoffice.
 *
 * Module **pur** (aucun accès DOM, base ou réseau), verrouillé par
 * `tests/image-compress.test.ts`. Le travail sur le canvas — donc le seul code
 * qui a besoin d'un navigateur — vit dans `image-compress-dom.ts`.
 *
 * Pourquoi compresser côté navigateur : une image voyage jusqu'au serveur en
 * data-URI, à travers une server action plafonnée à 4 Mo, et finit stockée en
 * base. Une photo de téléphone (4 à 12 Mo) ne passe pas. Le réflexe précédent
 * était de la refuser — « Image trop lourde, compressez-la d'abord » — ce qui
 * revenait à demander à l'utilisateur de faire à la main ce que le navigateur
 * sait faire tout seul.
 *
 * La règle : on ne descend en qualité que le strict nécessaire. Une image déjà
 * dans le budget n'est **pas** réencodée (un réencodage JPEG n'est jamais
 * neutre), et le premier essai garde la pleine résolution à qualité quasi
 * maximale. Ce n'est qu'en cas d'échec qu'on baisse, d'abord la qualité, puis
 * la définition.
 */

export type Size = { width: number; height: number };

/**
 * Côté le plus long conservé. 2048 px couvre le plein écran d'un portable
 * récent (et le grand format des réseaux) ; au-delà, l'œil ne voit rien de
 * plus, seul le poids grimpe.
 */
export const MAX_SIDE = 2048;

/** Budget d'une image de formulaire : couverture, logo, visuel de promotion. */
export const FIELD_MAX_BYTES = 1_200_000;

/**
 * Budget d'une photo de galerie. Plus serré : plusieurs photos partent dans la
 * même requête, et une rencontre en compte facilement vingt.
 */
export const PHOTO_MAX_BYTES = 800_000;

/**
 * Taille d'un envoi groupé de photos. La limite des server actions est à 4 Mo
 * de corps de requête, et le base64 gonfle les octets d'un tiers : 2 Mo de
 * photos font ~2,7 Mo sur le fil, marge comprise.
 */
export const BATCH_MAX_BYTES = 2_000_000;

/** Plancher de qualité : en dessous, le grain se voit sur une photo de groupe. */
export const MIN_QUALITY = 0.6;

const QUALITY_LADDER = [0.92, 0.84, 0.76, 0.68, MIN_QUALITY];

/** Définitions successives, en fraction du côté maximal demandé. */
const SIDE_LADDER = [1, 0.78, 0.6, 0.45];

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Dimensions ramenées dans un carré de `maxSide`, rapport conservé. Une image
 * plus petite est renvoyée telle quelle : on ne l'agrandit jamais, cela
 * n'ajouterait que du flou et du poids.
 */
export function scaleToFit(width: number, height: number, maxSide: number = MAX_SIDE): Size {
  if (!positive(width) || !positive(height) || !positive(maxSide)) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width: Math.round(width), height: Math.round(height) };
  const ratio = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

export type CompressionStep = { maxSide: number; quality: number };

/**
 * Essais successifs, du meilleur au plus économe. On épuise la qualité à
 * définition pleine avant de réduire la définition : une photo de groupe reste
 * lisible bien plus longtemps en baissant la qualité qu'en perdant des pixels.
 */
export function compressionSteps(maxSide: number = MAX_SIDE): CompressionStep[] {
  if (!positive(maxSide)) return [];
  const steps: CompressionStep[] = [];
  SIDE_LADDER.forEach((fraction, index) => {
    const side = Math.max(320, Math.round(maxSide * fraction));
    // Le premier palier essaie toute l'échelle de qualité ; les suivants
    // repartent plus bas, la définition ayant déjà fait une partie du travail.
    for (const quality of QUALITY_LADDER.slice(index)) steps.push({ maxSide: side, quality });
  });
  return steps;
}

/** Poids réel d'une data-URI base64, sans la décoder. */
export function base64Bytes(dataUri: string): number {
  const marker = dataUri.indexOf("base64,");
  if (marker < 0) return 0;
  const payload = dataUri.slice(marker + 7).replace(/\s+/g, "");
  if (payload.length === 0) return 0;
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

/** `true` pour une data-URI d'image, la seule forme acceptée par le serveur. */
export function isImageDataUri(value: string): boolean {
  return /^data:image\/[a-z+.-]+;base64,/i.test(value.trim());
}

/**
 * Faut-il réencoder ? Non si l'image tient déjà dans le budget **et** dans la
 * définition : le fichier d'origine est alors la meilleure version possible.
 */
export function needsCompression(
  info: { bytes: number; width: number; height: number },
  options: { maxBytes: number; maxSide?: number } = { maxBytes: FIELD_MAX_BYTES },
): boolean {
  const maxSide = options.maxSide ?? MAX_SIDE;
  if (!positive(info.width) || !positive(info.height)) return false;
  if (Math.max(info.width, info.height) > maxSide) return true;
  return info.bytes > options.maxBytes;
}

function bytesLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1000) return `${Math.round(bytes)} o`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} Ko`;
  const mo = bytes / 1_000_000;
  return `${(mo < 10 ? mo.toFixed(1) : String(Math.round(mo))).replace(".", ",")} Mo`;
}

export type CompressionResult = {
  width: number;
  height: number;
  bytes: number;
  originalBytes: number;
  /** `false` quand le fichier d'origine a été gardé tel quel. */
  recompressed: boolean;
};

/** Phrase affichée sous l'aperçu : ce que le navigateur a fait, en clair. */
export function compressionSummary(result: CompressionResult): string {
  const size = `${Math.round(result.width)} × ${Math.round(result.height)} px`;
  if (!result.recompressed) return `${size} · ${bytesLabel(result.bytes)} · qualité d'origine conservée`;
  return `${size} · ${bytesLabel(result.originalBytes)} → ${bytesLabel(result.bytes)} · compressée automatiquement`;
}

/**
 * Groupe des envois consécutifs pour tenir sous la limite d'une requête. Un
 * élément plus gros que le budget part seul plutôt que d'être écarté : c'est au
 * serveur de le refuser, pas à la file de l'oublier en silence.
 */
export function chunkByBytes(sizes: number[], maxBytes: number = BATCH_MAX_BYTES): number[][] {
  const groups: number[][] = [];
  let current: number[] = [];
  let total = 0;
  sizes.forEach((size, index) => {
    const weight = Math.max(0, size);
    if (current.length > 0 && total + weight > maxBytes) {
      groups.push(current);
      current = [];
      total = 0;
    }
    current.push(index);
    total += weight;
  });
  if (current.length > 0) groups.push(current);
  return groups;
}
