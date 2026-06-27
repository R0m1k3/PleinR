import Link from "next/link";
import { Sparkle } from "@/components/Sparkle";
import { Reveal } from "@/components/Reveal";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MembershipModalButton } from "@/components/MembershipModalButton";
import { MembersCarousel } from "@/components/MembersCarousel";
import { StarField } from "@/components/StarField";
import { PromoImage } from "@/components/PromoImage";
import { getLivePromotions, getRotatingActiveMembers } from "@/lib/queries";

export const dynamic = "force-dynamic";

const STRIPE_WARM =
  "repeating-linear-gradient(45deg,#efe9da,#efe9da 12px,#e6ddc9 12px,#e6ddc9 24px)";

function badgeColor(badge: string | null) {
  if (!badge) return "#1f8a5b";
  return badge.includes("%") ? "#d8472b" : "#1f8a5b";
}

export default async function AccueilPage() {
  const [promos, rotatingMembers] = await Promise.all([
    getLivePromotions(6),
    getRotatingActiveMembers(),
  ]);

  return (
    <div
      style={{
        background: "#F6F2E8",
        minHeight: "100vh",
        fontFamily: "'Public Sans',sans-serif",
        color: "#33291D",
      }}
    >
      <SiteHeader active="accueil" />

      <div className="container">
        {/* hero */}
        <section
          className="grid hero-grid"
          style={{ position: "relative", padding: "30px 0 50px", overflow: "hidden", alignItems: "center" }}
        >
          <StarField />

          <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/logo.png"
              alt="Plein R — Association des commerçants et entreprises du Bassin de Pompey"
              className="floatlogo"
              style={{
                width: "100%",
                maxWidth: 380,
                height: "auto",
                display: "block",
                filter: "drop-shadow(0 18px 34px rgba(40,30,15,0.16))",
              }}
            />
          </div>

          <Reveal className="reveal" style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                background: "#fff",
                border: "1px solid #e6dcc6",
                color: "#9a6638",
                fontSize: 12.5,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 700,
                padding: "8px 16px",
                borderRadius: 999,
                marginBottom: 20,
              }}
            >
              Réseau · Rencontre · Réussite
            </div>
            <h1
              className="font-display"
              style={{
                fontWeight: 800,
                fontSize: "clamp(30px, 7vw, 52px)",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                margin: "0 0 8px",
                color: "#26201a",
              }}
            >
              Le cœur commerçant du <span style={{ color: "#2C6FB3" }}>Bassin de Pompey</span>
            </h1>
            <div
              className="font-display"
              style={{ fontWeight: 600, fontSize: 17, color: "#9a6638", margin: "0 0 16px" }}
            >
              Association des commerçants &amp; entreprises du Bassin de Pompey
            </div>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: "#6c6150", margin: "0 0 24px", maxWidth: 520 }}>
              Boulangers, artisans, restaurateurs, entreprises… retrouvez tous nos adhérents, profitez de
              leurs bons plans et faites vivre le commerce de proximité.
            </p>
            <form
              action="/annuaire"
              method="get"
              style={{
                display: "flex",
                width: "100%",
                gap: 10,
                background: "#fff",
                border: "1px solid #e6dcc6",
                borderRadius: 14,
                padding: "9px 9px 9px 18px",
                boxShadow: "0 16px 36px -24px rgba(40,30,15,0.4)",
              }}
            >
              <input
                name="q"
                placeholder="Que cherchez-vous ?"
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 15,
                  fontFamily: "'Public Sans'",
                  flex: 1,
                  minWidth: 0,
                  color: "#3c3322",
                }}
              />
              <button
                type="submit"
                className="font-display"
                style={{
                  border: "none",
                  background: "#2C6FB3",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                  padding: "12px 24px",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                Rechercher
              </button>
            </form>
          </Reveal>
        </section>

        {/* promotions */}
        <section
          id="promotions"
          style={{
            position: "relative",
            margin: "46px 0 10px",
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
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 20,
              marginBottom: 6,
              flexWrap: "wrap",
            }}
          >
            <div>
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
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E0A63C" }} />
                Bons plans
              </div>
              <h2
                className="font-display"
                style={{ fontWeight: 800, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em", margin: 0, color: "#26201a" }}
              >
                Les promotions de nos adhérents
              </h2>
              <p style={{ margin: "7px 0 0", color: "#8c8068", fontSize: 15 }}>
                Offres, réductions et nouveautés publiées par les commerçants du réseau.
              </p>
            </div>
            <a href="#promotions" className="link-arrow" style={{ textDecoration: "none", color: "#9a6638", fontWeight: 700, fontSize: 14.5, whiteSpace: "nowrap" }}>
              Toutes les promos →
            </a>
          </div>

          <Reveal className="grid grid-3 reveal-stagger" style={{ marginTop: 26 }}>
            {promos.map((p) => (
              <Link
                key={p.id}
                href={p.memberId ? `/adherents/${p.memberId}` : "#"}
                className="lift-card"
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  background: "#fff",
                  border: "1px solid #ece3d0",
                  borderRadius: 18,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "1 / 1",
                    background: STRIPE_WARM,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {p.imageUrl && <PromoImage src={p.imageUrl} alt={p.title ?? ""} />}
                  {!p.imageUrl && (
                    <span style={{ fontSize: 10.5, letterSpacing: "0.12em", color: "#a99c82", textTransform: "uppercase" }}>
                      photo de l&apos;offre
                    </span>
                  )}
                  {p.badge && (
                    <span
                      className="font-display"
                      style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        background: badgeColor(p.badge),
                        color: "#fff",
                        fontWeight: 800,
                        fontSize: 18,
                        padding: "8px 16px",
                        borderRadius: "0 0 0 16px",
                      }}
                    >
                      {p.badge}
                    </span>
                  )}
                  {p.category && (
                    <span
                      style={{
                        position: "absolute",
                        top: 12,
                        left: 12,
                        background: "#9a6638",
                        color: "#fff",
                        borderRadius: 999,
                        padding: "5px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {p.category}
                    </span>
                  )}
                </div>
                <div style={{ padding: "17px 18px 18px", display: "flex", flexDirection: "column", flex: 1 }}>
                  <h3 className="font-display" style={{ fontWeight: 700, fontSize: 18, margin: "0 0 5px", color: "#26201a" }}>
                    {p.title}
                  </h3>
                  <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "#8c8068", lineHeight: 1.5, flex: 1 }}>
                    {p.text}
                  </p>
                  <div
                    style={{
                      borderTop: "1px solid #f0e8d6",
                      paddingTop: 12,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#3c3322" }}>{p.memberName}</div>
                    <div style={{ fontSize: 11.5, color: "#a99c82" }}>{p.validUntil}</div>
                  </div>
                </div>
              </Link>
            ))}
          </Reveal>
        </section>

        {/* à l'honneur — carrousel auto */}
        <section style={{ padding: "40px 0 44px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 className="font-display" style={{ fontWeight: 800, fontSize: 26, margin: 0, color: "#26201a" }}>
              À l&apos;honneur
            </h2>
            <a href="/annuaire" className="link-arrow" style={{ textDecoration: "none", color: "#9a6638", fontWeight: 700, fontSize: 14.5 }}>
              Tout l&apos;annuaire →
            </a>
          </div>
          <MembersCarousel members={rotatingMembers} />
        </section>

        {/* warm CTA */}
        <section
          style={{
            margin: "0 0 50px",
            position: "relative",
            background: "linear-gradient(120deg,#9a6638,#b97f48)",
            borderRadius: 20,
            padding: 44,
            textAlign: "center",
            overflow: "hidden",
          }}
        >
          <Sparkle color="#E0A63C" size={18} style={{ top: 24, left: 60 }} duration={3.4} />
          <Sparkle color="#6FB0C6" size={22} style={{ bottom: 26, right: 80 }} duration={2.8} delay={0.7} />
          <Reveal className="reveal">
            <h2 className="font-display" style={{ fontWeight: 800, fontSize: "clamp(22px, 5vw, 30px)", margin: "0 0 10px", color: "#fff" }}>
              Faites partie de l&apos;aventure Plein R
            </h2>
            <p style={{ margin: "0 auto 22px", fontSize: 15.5, color: "#f4e6d3", maxWidth: 480 }}>
              Rejoignez plus de 120 commerçants et entreprises qui font réseau, se rencontrent et réussissent
              ensemble.
            </p>
            <MembershipModalButton
              label="Devenir adhérent"
              className="font-display lift-cta"
              style={{
                border: "none",
                background: "#fff",
                color: "#9a6638",
                fontWeight: 700,
                fontSize: 16,
                padding: "15px 30px",
                borderRadius: 12,
                display: "inline-block",
              }}
            />
          </Reveal>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
