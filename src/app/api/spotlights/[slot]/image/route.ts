import { NextResponse } from "next/server";
import { decodeImageDataUri } from "@/lib/data-uri";
import { getSpotlightImage } from "@/lib/queries";
import { isDisplayable, parseSlot } from "@/lib/spotlights";

export const dynamic = "force-dynamic";

/**
 * Photo d'une entreprise du carrousel de l'accueil, en octets.
 *
 * Passer les data-URIs au composant client du carrousel les enverrait deux
 * fois (HTML + payload RSC), sans cache. L'accueil appelle cette route avec
 * `?v=<updated_at>` : l'URL change à chaque enregistrement.
 *
 * Seul un emplacement affiché sur l'accueil répond : un brouillon ne fuit pas
 * par une URL devinable.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slot: string }> }) {
  const { slot: raw } = await params;
  const slot = parseSlot(raw);
  if (slot === null) return new NextResponse("Introuvable", { status: 404 });

  const row = await getSpotlightImage(slot);
  if (!row || !isDisplayable(row) || !row.imageUrl) return new NextResponse("Introuvable", { status: 404 });

  const decoded = decodeImageDataUri(row.imageUrl);
  if (!decoded) return new NextResponse("Introuvable", { status: 404 });

  return new NextResponse(decoded.bytes, {
    headers: {
      "Content-Type": decoded.mime,
      "Content-Length": String(decoded.bytes.length),
      "Cache-Control": "public, max-age=86400",
    },
  });
}
