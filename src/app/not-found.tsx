import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { NOINDEX } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Page introuvable",
  robots: NOINDEX,
};

/** 404 publique : renvoie vers l'annuaire plutôt que vers une page blanche. */
export default function NotFound() {
  return (
    <div style={{ background: "#F6F2E8", minHeight: "100vh", fontFamily: "'Public Sans',sans-serif", color: "#33291D" }}>
      <SiteHeader logo />
      <main className="container" style={{ paddingTop: 48, paddingBottom: 72, maxWidth: 720 }}>
        <div style={{ color: "#9a6638", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800, marginBottom: 12 }}>
          Erreur 404
        </div>
        <h1 className="font-display" style={{ margin: "0 0 14px", color: "#26201a", fontSize: "clamp(30px, 6vw, 48px)", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
          Cette page n&apos;existe pas ou plus
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.6, color: "#6c6150", margin: "0 0 26px" }}>
          La fiche ou la page demandée a peut-être été retirée. Retrouvez tous les commerçants et
          entreprises du Bassin de Pompey dans l&apos;annuaire.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link
            href="/annuaire"
            className="font-display"
            style={{ textDecoration: "none", background: "#E0A63C", color: "#33291D", fontWeight: 700, fontSize: 15.5, padding: "13px 24px", borderRadius: 12 }}
          >
            Voir l&apos;annuaire
          </Link>
          <Link
            href="/"
            className="font-display"
            style={{ textDecoration: "none", background: "#fff", border: "1px solid #e6dcc6", color: "#33291D", fontWeight: 700, fontSize: 15.5, padding: "13px 24px", borderRadius: 12 }}
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
