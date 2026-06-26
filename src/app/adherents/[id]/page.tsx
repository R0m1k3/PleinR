import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sparkle } from "@/components/Sparkle";
import { getMemberLivePromotions, getPublicMember } from "@/lib/queries";

export const dynamic = "force-dynamic";

const STRIPE_WARM =
  "repeating-linear-gradient(45deg,#efe9da,#efe9da 12px,#e6ddc9 12px,#e6ddc9 24px)";

function badgeColor(badge: string | null) {
  if (!badge) return "#1f8a5b";
  return badge.includes("%") ? "#d8472b" : "#1f8a5b";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const member = await getPublicMember(Number(id));
  if (!member) return { title: "Adhérent — Plein R" };
  return {
    title: `${member.name} — Plein R`,
    description: member.description ?? undefined,
  };
}

export default async function FicheAdherentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const memberId = Number(id);
  if (!memberId) notFound();

  const member = await getPublicMember(memberId);
  if (!member || member.status !== "active") notFound();

  const promos = await getMemberLivePromotions(memberId);
  const accent = member.accent ?? "#E0A63C";
  const location = [member.address, member.city].filter(Boolean).join(" · ");

  return (
    <div
      style={{
        background: "#F6F2E8",
        minHeight: "100vh",
        fontFamily: "'Public Sans',sans-serif",
        color: "#33291D",
      }}
    >
      {/* header */}
      <header
        className="container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 56px",
          gap: 20,
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo.png" alt="Plein R" style={{ height: 44, width: "auto" }} />
          <span className="font-display" style={{ fontWeight: 800, fontSize: 20, color: "#13324F" }}>
            Plein R
          </span>
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 30, flexWrap: "wrap" }}>
          <Link href="/annuaire" style={{ textDecoration: "none", color: "#3c3322", fontWeight: 600, fontSize: 15 }}>
            Annuaire
          </Link>
          <Link href="/#promotions" style={{ textDecoration: "none", color: "#6f6450", fontWeight: 500, fontSize: 15 }}>
            Promotions
          </Link>
          <Link
            href="/backend"
            style={{
              textDecoration: "none",
              color: "#fff",
              background: "#9a6638",
              fontWeight: 600,
              fontSize: 14.5,
              padding: "10px 18px",
              borderRadius: 999,
            }}
          >
            Espace adhérent
          </Link>
        </nav>
      </header>

      <div className="container" style={{ paddingBottom: 50 }}>
        <div style={{ padding: "10px 0 18px" }}>
          <Link href="/annuaire" className="link-arrow" style={{ textDecoration: "none", color: "#9a6638", fontWeight: 700, fontSize: 14.5 }}>
            ← Retour à l&apos;annuaire
          </Link>
        </div>

        {/* hero card */}
        <section
          className="grid hero-grid"
          style={{
            position: "relative",
            background: "#fff",
            border: "1px solid #e6dcc6",
            borderRadius: 24,
            padding: 28,
            overflow: "hidden",
            boxShadow: "0 26px 60px -40px rgba(40,30,15,0.5)",
            gap: 32,
          }}
        >
          <Sparkle color={accent} size={18} style={{ top: 20, right: 24 }} duration={3.4} />
          <Sparkle color="#6FB0C6" size={12} style={{ top: 52, right: 70 }} duration={2.7} delay={0.5} />

          {/* vitrine photo */}
          <div
            style={{
              position: "relative",
              minHeight: 240,
              borderRadius: 18,
              background: member.logoUrl ? `url(${member.logoUrl})` : STRIPE_WARM,
              backgroundSize: "cover",
              backgroundPosition: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {!member.logoUrl && (
              <span style={{ fontSize: 11, letterSpacing: "0.12em", color: "#a99c82", textTransform: "uppercase" }}>
                photo vitrine
              </span>
            )}
          </div>

          {/* info */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {member.categoryLabel && (
              <span
                style={{
                  alignSelf: "flex-start",
                  background: "#9a6638",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "5px 13px",
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 14,
                }}
              >
                {member.categoryLabel}
              </span>
            )}
            <h1 className="font-display" style={{ fontWeight: 800, fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 10px", color: "#26201a" }}>
              {member.name}
            </h1>
            {location && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#6c6150", marginBottom: 14 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent }} />
                {location}
              </div>
            )}
            {member.description && (
              <p style={{ fontSize: 16, lineHeight: 1.6, color: "#6c6150", margin: "0 0 22px", maxWidth: 520 }}>
                {member.description}
              </p>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {member.email && (
                <a
                  href={`mailto:${member.email}`}
                  className="font-display"
                  style={{
                    textDecoration: "none",
                    background: "#2C6FB3",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 15,
                    padding: "12px 22px",
                    borderRadius: 11,
                  }}
                >
                  Contacter
                </a>
              )}
              {promos.length > 0 && (
                <a
                  href="#promotions"
                  className="font-display"
                  style={{
                    textDecoration: "none",
                    background: "#fff",
                    color: "#9a6638",
                    border: "1px solid #d8cdb4",
                    fontWeight: 700,
                    fontSize: 15,
                    padding: "12px 22px",
                    borderRadius: 11,
                  }}
                >
                  Voir les promotions
                </a>
              )}
            </div>
          </div>
        </section>

        {/* promotions */}
        <section id="promotions" style={{ paddingTop: 44 }}>
          <h2 className="font-display" style={{ fontWeight: 800, fontSize: 26, margin: "0 0 20px", color: "#26201a" }}>
            Promotions en cours
          </h2>

          {promos.length === 0 ? (
            <div
              style={{
                background: "#fff",
                border: "1px dashed #d8cdb4",
                borderRadius: 16,
                padding: "28px 24px",
                color: "#8c8068",
                fontSize: 14.5,
              }}
            >
              Cet adhérent n&apos;a pas de promotion en cours pour le moment.
            </div>
          ) : (
            <div className="grid grid-3">
              {promos.map((p) => (
                <article
                  key={p.id}
                  className="lift-card"
                  style={{
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
                      height: 168,
                      background: p.imageUrl ? `url(${p.imageUrl})` : STRIPE_WARM,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
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
                      <span style={{ position: "absolute", top: 12, left: 12, background: "#9a6638", color: "#fff", borderRadius: 999, padding: "5px 12px", fontSize: 11, fontWeight: 700 }}>
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
                    {p.validUntil && (
                      <div style={{ fontSize: 11.5, color: "#a99c82", borderTop: "1px solid #f0e8d6", paddingTop: 12 }}>
                        {p.validUntil}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* footer */}
      <footer style={{ background: "#EFE9DA", borderTop: "1px solid #e2d6bd", padding: "28px 56px" }}>
        <div
          className="container"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo.png" alt="Plein R" style={{ height: 36, width: "auto" }} />
            <span className="font-display" style={{ fontWeight: 800, fontSize: 16, color: "#13324F" }}>
              Plein R
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#8c8068", textAlign: "right", lineHeight: 1.7 }}>
            contact@plein-r.fr · Bassin de Pompey
            <br />
            Réseau · Rencontre · Réussite
          </div>
        </div>
      </footer>
    </div>
  );
}
