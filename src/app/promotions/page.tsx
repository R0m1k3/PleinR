import type { Metadata } from "next";
import Link from "next/link";
import { Sparkle } from "@/components/Sparkle";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MembershipModalButton } from "@/components/MembershipModalButton";
import { PromoCard } from "@/components/PromoCard";
import { JsonLd } from "@/components/JsonLd";
import { getLivePromotions } from "@/lib/queries";
import { breadcrumbJsonLd, memberListJsonLd, pageMetadata } from "@/lib/seo";
import { publicBaseUrl } from "@/lib/seo-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Bons plans et promotions du Bassin de Pompey",
  description:
    "Toutes les offres en cours chez les commerçants, artisans et entreprises adhérents Plein R : " +
    "réductions, nouveautés et bons plans à Pompey, Frouard, Liverdun, Champigneulles…",
  path: "/promotions",
});

export default async function PromotionsPage() {
  // `null` : toutes les offres en cours, là où l'accueil n'en montre que six.
  const [promos, baseUrl] = await Promise.all([getLivePromotions(null), publicBaseUrl()]);

  // Une offre pointe vers la fiche de son commerçant : la liste structurée
  // renvoie donc vers les adhérents, pas vers des URLs de promotion.
  const listed = promos
    .filter((p) => p.memberId != null)
    .map((p) => ({ id: p.memberId as number, name: p.memberName ?? "", city: p.memberCity }));

  return (
    <div style={{ background: "#F6F2E8", minHeight: "100vh", fontFamily: "'Public Sans',sans-serif", color: "#33291D" }}>
      <SiteHeader active="promotions" logo />
      <JsonLd
        data={[
          breadcrumbJsonLd(baseUrl, [
            { name: "Accueil", path: "/" },
            { name: "Promotions", path: "/promotions" },
          ]),
          memberListJsonLd(baseUrl, "Promotions en cours chez les adhérents Plein R", listed),
        ]}
      />

      <main className="container" style={{ paddingBottom: 56 }}>
        {/* title block */}
        <section style={{ position: "relative", padding: "14px 0 22px", overflow: "hidden" }}>
          <Sparkle color="#E0A63C" size={18} style={{ top: 22, right: 30 }} duration={3.2} />
          <Sparkle color="#6FB0C6" size={12} style={{ top: 60, right: 90 }} duration={2.7} delay={0.5} />
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              background: "#fff",
              border: "1px solid #e6dcc6",
              color: "#9a6638",
              fontSize: 12,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 800,
              padding: "6px 13px",
              borderRadius: 999,
              marginBottom: 14,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#E0A63C" }} />
            {promos.length} offre{promos.length > 1 ? "s" : ""} en cours
          </div>
          <h1 className="font-display" style={{ fontWeight: 800, fontSize: "clamp(26px, 6vw, 40px)", letterSpacing: "-0.02em", margin: "0 0 8px", color: "#26201a" }}>
            Les bons plans de nos adhérents
          </h1>
          <p style={{ margin: 0, fontSize: 16.5, color: "#6c6150", maxWidth: 560 }}>
            Toutes les offres en cours chez les commerçants, artisans et entreprises du réseau.
            Chaque promotion renvoie vers la fiche de son commerce.
          </p>
        </section>

        {promos.length === 0 ? (
          <section
            style={{
              background: "#fff",
              border: "1px solid #e6dcc6",
              borderRadius: 18,
              padding: "38px 24px",
              textAlign: "center",
              color: "#8c8068",
              fontSize: 15,
              lineHeight: 1.7,
            }}
          >
            Aucune promotion en cours pour le moment.
            <br />
            <Link href="/annuaire" style={{ color: "#9a6638", fontWeight: 700 }}>
              Parcourir l&apos;annuaire des adhérents →
            </Link>
          </section>
        ) : (
          <div className="grid grid-3" style={{ gap: 20 }}>
            {promos.map((p) => (
              <PromoCard key={p.id} promo={p} />
            ))}
          </div>
        )}

        {/* join CTA */}
        <section
          style={{
            marginTop: 34,
            position: "relative",
            background: "linear-gradient(120deg,#13324F,#1d4a72)",
            borderRadius: 20,
            padding: "34px 40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 28,
            overflow: "hidden",
            flexWrap: "wrap",
          }}
        >
          <Sparkle color="#E0A63C" size={18} style={{ top: 20, right: 40 }} duration={3.2} />
          <div>
            <div style={{ fontSize: 12.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9fc6e6", fontWeight: 700, marginBottom: 8 }}>
              Vous êtes commerçant du Bassin de Pompey ?
            </div>
            <h2 className="font-display" style={{ fontWeight: 800, fontSize: 26, margin: 0, color: "#fff" }}>
              Publiez vos offres sur Plein R
            </h2>
          </div>
          <MembershipModalButton
            label="Adhérer à l'association"
            className="font-display"
            style={{ border: "none", background: "#E0A63C", color: "#33291D", fontWeight: 700, fontSize: 15.5, padding: "14px 26px", borderRadius: 12, whiteSpace: "nowrap" }}
          />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
