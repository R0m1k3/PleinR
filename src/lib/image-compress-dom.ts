/**
 * Compression d'une image **dans le navigateur**, avant qu'elle ne parte vers
 * une server action. Pendant du module pur `image-compress.ts`, qui porte les
 * seuils et les paliers ; ici vivent le décodage, le canvas et l'encodage,
 * c'est-à-dire tout ce qui a besoin d'un DOM.
 *
 * Trois choix méritent d'être expliqués :
 *
 * - **L'orientation EXIF est appliquée au décodage** (`createImageBitmap` avec
 *   `imageOrientation: "from-image"`). Une photo prise à l'horizontale porte
 *   souvent sa rotation dans ses métadonnées ; dessinée telle quelle sur un
 *   canvas, elle repartirait couchée, l'information perdue.
 * - **Une image avec transparence ne devient jamais un JPEG** : le logo d'un
 *   adhérent se retrouverait sur fond noir. On passe alors par WebP, et par
 *   PNG si le navigateur ne sait pas encoder le WebP.
 * - **Une image déjà dans le budget n'est pas touchée** : un réencodage JPEG
 *   dégrade toujours un peu, même à qualité élevée.
 */

import {
  FIELD_MAX_BYTES,
  MAX_SIDE,
  base64Bytes,
  compressionSteps,
  needsCompression,
  scaleToFit,
} from "./image-compress";

export type PreparedImage = {
  /** Image prête à partir, toujours en data-URI (jamais une URL : cf. SSRF). */
  dataUri: string;
  width: number;
  height: number;
  bytes: number;
  originalBytes: number;
  recompressed: boolean;
  /** Nom du fichier d'origine, repris comme légende par défaut. */
  name: string;
};

export type PrepareOptions = {
  maxBytes?: number;
  maxSide?: number;
};

/** Formats que le serveur accepte tels quels (`asImageDataUri`). */
const PASSTHROUGH = /^image\/(png|jpeg|jpg|webp|gif)$/i;

function readDataUri(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Fichier illisible."));
    reader.readAsDataURL(file);
  });
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Navigateur sans `imageOrientation` (ou format non décodable) : on tente
      // la voie classique avant d'abandonner.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("decode"));
      element.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(
      "Ce format d'image n'est pas lisible par le navigateur (HEIC d'iPhone, par exemple). " +
        "Exportez la photo en JPEG avant de la déposer.",
    );
  }
}

/** Une image sans transparence peut partir en JPEG, la plus économe des trois. */
function hasAlpha(context: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const { data } = context.getImageData(0, 0, width, height);
    // Un pixel sur quatre suffit à repérer une transparence : un fond
    // transparent n'est jamais un pixel isolé.
    for (let index = 3; index < data.length; index += 16) {
      if (data[index] < 255) return true;
    }
    return false;
  } catch {
    // Canvas « sali » (impossible ici : tout vient d'un fichier local) : dans le
    // doute on garde la transparence.
    return true;
  }
}

function draw(decoded: Decoded, size: { width: number; height: number }): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Le navigateur n'a pas pu préparer l'image.");
  context.drawImage(decoded.source, 0, 0, size.width, size.height);
  return canvas;
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): string | null {
  const dataUri = canvas.toDataURL(type, quality);
  // Un type non géré fait retomber `toDataURL` sur le PNG sans prévenir.
  return dataUri.startsWith(`data:${type}`) ? dataUri : null;
}

/**
 * Prépare un fichier déposé : orientation redressée, définition ramenée à
 * `maxSide`, poids ramené sous `maxBytes` en descendant les paliers de qualité
 * seulement autant qu'il le faut.
 *
 * Lève une erreur porteuse d'un message affichable (fichier non image, format
 * non décodable). Ne lève jamais pour cause de poids : c'est précisément ce que
 * la fonction est là pour régler.
 */
export async function prepareImageFile(file: File, options: PrepareOptions = {}): Promise<PreparedImage> {
  const maxBytes = options.maxBytes ?? FIELD_MAX_BYTES;
  const maxSide = options.maxSide ?? MAX_SIDE;
  if (file.type && !file.type.startsWith("image/")) throw new Error("Ce fichier n'est pas une image.");

  const decoded = await decode(file);
  try {
    const original = { bytes: file.size, width: decoded.width, height: decoded.height };

    if (PASSTHROUGH.test(file.type) && !needsCompression(original, { maxBytes, maxSide })) {
      const dataUri = await readDataUri(file);
      return { ...original, dataUri, originalBytes: file.size, recompressed: false, name: file.name };
    }

    // Premier tirage à définition pleine : il sert aussi à repérer une
    // transparence, donc à choisir le format de sortie.
    const full = scaleToFit(decoded.width, decoded.height, maxSide);
    const probe = draw(decoded, full);
    const context = probe.getContext("2d");
    const transparent = context ? hasAlpha(context, probe.width, probe.height) : false;
    const types = transparent ? ["image/webp", "image/png"] : ["image/jpeg"];

    let best: { dataUri: string; bytes: number; size: { width: number; height: number } } | null = null;
    for (const step of compressionSteps(maxSide)) {
      const size = scaleToFit(decoded.width, decoded.height, step.maxSide);
      const canvas = size.width === probe.width && size.height === probe.height ? probe : draw(decoded, size);
      for (const type of types) {
        const dataUri = encode(canvas, type, step.quality);
        if (!dataUri) continue;
        const bytes = base64Bytes(dataUri);
        if (!best || bytes < best.bytes) best = { dataUri, bytes, size };
        if (bytes <= maxBytes) {
          return {
            dataUri,
            width: size.width,
            height: size.height,
            bytes,
            originalBytes: file.size,
            recompressed: true,
            name: file.name,
          };
        }
        // Le PNG ignore la qualité : inutile de redescendre l'échelle sur lui,
        // seule une définition plus petite le fera maigrir.
        if (type === "image/png") break;
      }
    }

    if (!best) throw new Error("Le navigateur n'a pas pu compresser cette image.");
    return {
      dataUri: best.dataUri,
      width: best.size.width,
      height: best.size.height,
      bytes: best.bytes,
      originalBytes: file.size,
      recompressed: true,
      name: file.name,
    };
  } finally {
    decoded.release();
  }
}
