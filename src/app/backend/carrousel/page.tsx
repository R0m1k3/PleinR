import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { getSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getSpotlightSlots } from "@/lib/queries";
import { HomeSpotlightForm } from "./HomeSpotlightForm";

export const dynamic = "force-dynamic";

/** Les 4 entreprises du carrousel « Entreprises à découvrir » de l'accueil. */
export default async function CarrouselPage() {
  const session = await getSession();
  if (!can(session?.user.role, "manageSettings")) redirect("/backend");

  const spotlights = await getSpotlightSlots();

  return (
    <div style={{ display: "grid", gap: 22, maxWidth: 1080 }}>
      {/* Chaque emplacement s'enregistre seul : quatre photos dans un seul envoi
          dépasseraient la limite de 4 Mo. */}
      <section style={panel}>
        <h2 className="font-display" style={title}>Entreprises à découvrir</h2>
        <div style={{ margin: "-6px 0 16px", color: "#9a6638", fontSize: 13, lineHeight: 1.6 }}>
          4 entreprises maximum, présentées une à une sous le haut de la page d&apos;accueil. Seules les
          entreprises publiées avec un nom et un texte apparaissent ; sans aucune, le carrousel est masqué.
          Chaque entreprise s&apos;enregistre avec son propre bouton.
        </div>
        <div className="grid grid-2" style={{ gap: 16 }}>
          {spotlights.map((s) => (
            <HomeSpotlightForm key={s.slot} spotlight={s} />
          ))}
        </div>
      </section>
    </div>
  );
}

const panel: CSSProperties = {
  background: "#fff",
  border: "1px solid #e6dcc6",
  borderRadius: 16,
  padding: 22,
};

const title: CSSProperties = {
  margin: "0 0 16px",
  fontSize: 20,
  color: "#26201a",
};
