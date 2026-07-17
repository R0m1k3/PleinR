import type { ReactNode } from "react";
import Link from "next/link";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div style={{ background: "#F6F2E8", minHeight: "100vh", fontFamily: "'Public Sans',sans-serif", color: "#33291D" }}>
      <SiteHeader logo />
      <main className="container" style={{ paddingTop: 24, paddingBottom: 64 }}>
        <Link href="/" style={{ color: "#9a6638", fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}>
          ← Retour à l&apos;accueil
        </Link>
        <article
          className="legal-content"
          style={{ maxWidth: 860, marginTop: 22, background: "#fff", border: "1px solid #e6dcc6", borderRadius: 22, padding: "clamp(24px, 5vw, 48px)", boxShadow: "0 24px 55px -42px rgba(40,30,15,0.55)" }}
        >
          <div style={{ color: "#9a6638", fontSize: 11.5, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800, marginBottom: 10 }}>
            Informations du site
          </div>
          <h1 className="font-display" style={{ fontSize: "clamp(30px, 6vw, 44px)", letterSpacing: "-0.03em", color: "#26201a", margin: "0 0 12px" }}>
            {title}
          </h1>
          <p style={{ fontSize: 16, maxWidth: 680 }}>{intro}</p>
          {children}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
