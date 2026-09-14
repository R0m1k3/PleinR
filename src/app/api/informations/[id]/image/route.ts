import { NextResponse } from "next/server";
import { getInformation } from "@/lib/informations";

export const dynamic = "force-dynamic";

/**
 * Sert l'image de couverture d'une information **publiée**, en octets.
 *
 * Elle est stockée en data-URI, ce qui convient au site mais pas aux e-mails :
 * Gmail et Outlook suppriment les `<img src="data:">`. Cette route donne au
 * gabarit une URL ordinaire, et évite au passage de recopier plusieurs
 * méga-octets dans chaque ligne de la file d'attente.
 *
 * Seules les informations publiées répondent : un brouillon ne doit pas fuiter
 * par une URL devinable.
 */
const DATA_URI = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return new NextResponse("Introuvable", { status: 404 });

  const information = await getInformation(id);
  if (!information || information.status !== "published" || !information.imageUrl) {
    return new NextResponse("Introuvable", { status: 404 });
  }

  const match = DATA_URI.exec(information.imageUrl);
  if (!match) return new NextResponse("Introuvable", { status: 404 });

  const bytes = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": match[1],
      "Content-Length": String(bytes.length),
      // L'image d'une information ne change pas : les clients mail peuvent la
      // garder, et un message relu six mois plus tard l'affiche encore.
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
