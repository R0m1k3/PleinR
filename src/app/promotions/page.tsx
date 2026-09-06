import type { Metadata } from "next";
import Link from "next/link";
import { Sparkle } from "@/components/Sparkle";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
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
      <SiteHeader active="promotions" />
      <JsonLd
        data={[
          breadcrumbJsonLd(baseUrl, [
            { name: "Accueil", path: "/" },
            { name: "Promotions", path: "/promotions" },
          ]),
          memberListJsonLd(baseUrl, "Promotions en cours chez les adhérents Plein R", listed),
        ]}
      />

      <main className="container">
        <section
          style={{
            position: "relative",
            margin: "30px 0 10px",
            background: "#fff",
            border: "1px solid #e6dcc6",
            borderRadius: 24,
            padding: "38px 36px 42px",
            overflow: "hidden",
            boxShadow: "0 26px 60px -40px rgba(40,30,15,0.5)",
          }}
        >
          <Sparkle color="#E0A63C" size={20} style={{ top: 28, right: 44 }} duration={3.4} />
          <Sparkle color="#6FB0C6" size={13} style={{ top: 64, right: 96 }} duration={2.7} delay={0.5} />

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#fdeccd",
              color: "#9a6638",
              fontSize: 12,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 800,
              padding: "6px 13px",
              borderRadius: 999,
              marginBottom: 12,
            }}
          >
            Bons plans
          </div>
          <h1
            className="font-display"
            style={{ fontWeight: 800, fontSize: "clamp(24px, 5vw, 34px)", letterSpacing: "-0.02em", margin: 0, color: "#26201a" }}
          >
            Les promotions de nos adhérents
          </h1>
          <p style={{ margin: "8px 0 0", color: "#8c8068", fontSize: 15, maxWidth: 640, lineHeight: 1.6 }}>
            Toutes les offres en cours chez les commerçants, artisans et entreprises du réseau.
            Chaque promotion renvoie vers la fiche de son commerce.
          </p>

          {promos.length === 0 ? (
            <div
              style={{
                marginTop: 26,
                border: "1px dashed #d8cdb4",
                borderRadius: 16,
                padding: "34px 20px",
                textAlign: "center",
                color: "#8c8068",
                fontSize: 14.5,
                lineHeight: 1.6,
              }}
            >
              Aucune promotion en cours pour le moment.
              <br />
              <Link href="/annuaire" style={{ color: "#9a6638", fontWeight: 700 }}>
                Parcourir l&apos;annuaire des adhérents →
              </Link>
            </div>
          ) : (
            <>
              <div style={{ marginTop: 22, fontSize: 13, color: "#a99c82", fontWeight: 600 }}>
                {promos.length} offre{promos.length > 1 ? "s" : ""} en cours
              </div>
              <div className="grid grid-3" style={{ marginTop: 14 }}>
                {promos.map((p) => (
                  <PromoCard key={p.id} promo={p} />
                ))}
              </div>
            </>
          )}
        </section>

        <p style={{ margin: "22px 0 40px", fontSize: 14, color: "#8c8068" }}>
          Vous êtes commerçant du Bassin de Pompey ?{" "}
          <Link href="/association" style={{ color: "#9a6638", fontWeight: 700 }}>
            Rejoignez Plein R
          </Link>{" "}
          pour publier vos offres ici.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
