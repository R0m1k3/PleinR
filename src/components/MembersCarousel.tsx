"use client";

import Link from "next/link";

export type CarouselMember = {
  id: number;
  name: string;
  description: string | null;
  city: string | null;
  address: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  categoryLabel: string | null;
  accent: string | null;
};

const STRIPE_WARM =
  "repeating-linear-gradient(45deg,#efe9da,#efe9da 12px,#e6ddc9 12px,#e6ddc9 24px)";

function Card({ m }: { m: CarouselMember }) {
  const image = m.coverUrl || m.logoUrl;
  return (
    <Link
      href={`/adherents/${m.id}`}
      className="lift-card"
      style={{
        flex: "0 0 300px",
        width: 300,
        background: "#fff",
        border: "1px solid #e6dcc6",
        borderRadius: 18,
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
    >
      <div
        style={{
          position: "relative",
          height: 150,
          background: image ? `center/cover no-repeat url(${image})` : STRIPE_WARM,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!image && (
          <span style={{ fontSize: 10.5, letterSpacing: "0.12em", color: "#a99c82", textTransform: "uppercase" }}>
            photo vitrine
          </span>
        )}
        {m.categoryLabel && (
          <span style={{ position: "absolute", top: 12, left: 12, background: "#9a6638", color: "#fff", borderRadius: 999, padding: "5px 12px", fontSize: 11, fontWeight: 700 }}>
            {m.categoryLabel}
          </span>
        )}
      </div>
      <div style={{ padding: "16px 18px 18px" }}>
        <h3 className="font-display" style={{ fontWeight: 700, fontSize: 18, margin: "0 0 5px", color: "#26201a" }}>
          {m.name}
        </h3>
        <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "#8c8068", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {m.description}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#6c6150" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: m.accent ?? "#E0A63C" }} />
          {[m.address, m.city].filter(Boolean).join(" · ")}
        </div>
      </div>
    </Link>
  );
}

export function MembersCarousel({ members }: { members: CarouselMember[] }) {
  if (members.length === 0) return null;

  // Vitesse proportionnelle au nombre de cartes (≈ 6 s par carte).
  const duration = Math.max(20, members.length * 6);
  // Doublé pour un défilement en boucle sans couture.
  const loop = [...members, ...members];

  return (
    <div className="pleinr-marquee" aria-label="Adhérents à l'honneur">
      <div className="pleinr-marquee-track" style={{ animationDuration: `${duration}s` }}>
        {loop.map((m, i) => (
          <Card key={`${m.id}-${i}`} m={m} />
        ))}
      </div>
    </div>
  );
}
