import { headers } from "next/headers";
import { gtagConfigScript, gtagSrc, isTrackedPath, normalizeMeasurementId } from "@/lib/analytics";

/**
 * Balises Google Analytics 4, posées uniquement si l'identifiant de mesure est
 * renseigné dans Backend › Paramètres et si la page est publique.
 *
 * Les deux scripts portent le nonce de la CSP (`src/middleware.ts`) ; le
 * chemin est lu dans l'en-tête `x-pathname` que le middleware recopie, un
 * layout n'ayant pas accès à l'URL demandée.
 */
export async function Analytics({ measurementId }: { measurementId: string }) {
  const id = normalizeMeasurementId(measurementId);
  if (!id) return null;

  const requestHeaders = await headers();
  if (!isTrackedPath(requestHeaders.get("x-pathname") ?? "/")) return null;
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  return (
    <>
      <script async src={gtagSrc(id)} nonce={nonce} />
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: gtagConfigScript(id) }} />
    </>
  );
}
