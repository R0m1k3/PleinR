import { headers } from "next/headers";
import { serializeJsonLd } from "@/lib/seo";

/**
 * Bloc de données structurées `application/ld+json`.
 *
 * Le contenu est sérialisé par `serializeJsonLd`, qui échappe `<`, `>` et `&` :
 * les descriptions saisies par les adhérents ne peuvent pas fermer la balise.
 * Le nonce de la CSP est recopié par cohérence, même si un bloc JSON-LD n'est
 * jamais exécuté par le navigateur.
 */
export async function JsonLd({ data }: { data: unknown | unknown[] }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, index) => (
        <script
          key={index}
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(item) }}
        />
      ))}
    </>
  );
}
