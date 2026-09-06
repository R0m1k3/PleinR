import type { CSSProperties, ReactNode } from "react";

const STRIPE_WARM =
  "repeating-linear-gradient(45deg,#efe9da,#efe9da 12px,#e6ddc9 12px,#e6ddc9 24px)";

/**
 * Zone d'image "vitrine" d'un adhérent.
 * - Photo de couverture présente -> affichée en plein cadre (cover).
 * - Sinon, le logo est affiché centré et réduit (contain, ~60 % du cadre) sur
 *   un fond fait du logo lui-même flouté : le cadre prend les couleurs de la
 *   marque sans que le logo soit étiré ni ne déborde.
 * - Sinon, fond rayé + texte placeholder.
 */
export function VitrineImage({
  coverUrl,
  logoUrl,
  height,
  stripe = STRIPE_WARM,
  placeholder = "photo vitrine",
  children,
}: {
  coverUrl?: string | null;
  logoUrl?: string | null;
  height: number;
  stripe?: string;
  placeholder?: string;
  children?: ReactNode;
}) {
  const cover = coverUrl || null;
  const logoOnly = !cover && logoUrl ? logoUrl : null;

  const base: CSSProperties = {
    position: "relative",
    height,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };

  if (cover) {
    return (
      <div style={{ ...base, background: `center/cover no-repeat url(${cover})` }}>{children}</div>
    );
  }

  if (logoOnly) {
    // `height` est fixe sur le cadre : les max-height en % du logo sont donc
    // résolus, là où un conteneur intermédiaire sans hauteur les laissait sans
    // effet et le logo débordait.
    return (
      <div style={{ ...base, background: "linear-gradient(160deg,#fffdf8 0%,#f3ecdc 100%)" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${logoOnly})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(28px) saturate(1.25)",
            transform: "scale(1.25)",
            opacity: 0.32,
          }}
        />
        <div
          aria-hidden
          style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,253,248,0.35) 0%, rgba(246,242,232,0.6) 100%)" }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoOnly}
          alt=""
          style={{
            position: "relative",
            maxWidth: "62%",
            maxHeight: "62%",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            display: "block",
            filter: "drop-shadow(0 12px 24px rgba(40,30,15,0.18))",
          }}
        />
        {children}
      </div>
    );
  }

  return (
    <div style={{ ...base, background: stripe }}>
      <span style={{ fontSize: 10.5, letterSpacing: "0.12em", color: "#a99c82", textTransform: "uppercase" }}>
        {placeholder}
      </span>
      {children}
    </div>
  );
}
