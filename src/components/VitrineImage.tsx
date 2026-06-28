import type { CSSProperties, ReactNode } from "react";

const STRIPE_WARM =
  "repeating-linear-gradient(45deg,#efe9da,#efe9da 12px,#e6ddc9 12px,#e6ddc9 24px)";

/**
 * Zone d'image "vitrine" d'un adhérent.
 * - Photo de couverture présente -> affichée en plein cadre (cover).
 * - Sinon, le logo est affiché centré et réduit (contain ~80%), pas étiré.
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
    return (
      <div style={{ ...base, background: "linear-gradient(160deg,#fffdf8 0%,#f3ecdc 100%)", padding: "min(8%, 22px)" }}>
        {/* Cadre thème autour du logo (évite le bloc blanc nu) */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e6dcc6",
            borderRadius: 14,
            boxShadow: "0 14px 30px -20px rgba(40,30,15,0.35)",
            padding: "min(6%, 18px) min(9%, 28px)",
            maxWidth: "84%",
            maxHeight: "84%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoOnly}
            alt=""
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
          />
        </div>
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
