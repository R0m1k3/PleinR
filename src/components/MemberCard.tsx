import Link from "next/link";
import { VitrineImage } from "@/components/VitrineImage";
import { memberPath } from "@/lib/seo";

export type MemberCardData = {
  id: number;
  name: string;
  description: string | null;
  city: string | null;
  address: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  categoryLabel: string | null;
  accent: string | null;
  hasPromo?: boolean;
  promoBadge?: string | null;
};

const STRIPE_WARM =
  "repeating-linear-gradient(45deg,#efe9da,#efe9da 12px,#e6ddc9 12px,#e6ddc9 24px)";
const STRIPE_COOL =
  "repeating-linear-gradient(45deg,#eef0ec,#eef0ec 12px,#e2e8e6 12px,#e2e8e6 24px)";

/**
 * Hauteurs figées des deux blocs de texte : une description longue ne doit pas
 * étirer la carte (donc toute la rangée de la grille). Titre et description
 * sont tronqués en fin de ligne et occupent toujours la même place, ce qui
 * aligne les cartes entre elles quel que soit le texte saisi par l'adhérent.
 */
const TITLE_LINE = 1.25;
const TITLE_LINES = 2;
const DESC_FONT = 13;
const DESC_LINE = 1.5;
const DESC_LINES = 4;

const clampLines = (lines: number) =>
  ({
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
  }) as const;

/**
 * Carte d'un adhérent dans une grille (annuaire, page métier). Composant sans
 * état : il se rend aussi bien côté serveur que dans le filtre client.
 */
export function MemberCard({ m, index = 0 }: { m: MemberCardData; index?: number }) {
  const location = [m.address, m.city].filter(Boolean).join(" · ");
  return (
    <Link
      href={memberPath(m)}
      className="lift-card"
      style={{ textDecoration: "none", color: "inherit", background: "#fff", border: "1px solid #e6dcc6", borderRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <VitrineImage
        coverUrl={m.coverUrl}
        logoUrl={m.logoUrl}
        height={150}
        stripe={index % 2 === 0 ? STRIPE_WARM : STRIPE_COOL}
      >
        {m.categoryLabel && (
          <span style={{ position: "absolute", top: 12, left: 12, background: m.accent ?? "#9a6638", color: "#fff", borderRadius: 999, padding: "5px 12px", fontSize: 11, fontWeight: 700 }}>
            {m.categoryLabel}
          </span>
        )}
        {m.hasPromo && m.promoBadge && (
          <span className="font-display" style={{ position: "absolute", top: 0, right: 0, background: "#d8472b", color: "#fff", fontWeight: 800, fontSize: 12.5, padding: "6px 12px", borderRadius: "0 0 0 14px" }}>
            {m.promoBadge}
          </span>
        )}
      </VitrineImage>
      <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", flex: 1 }}>
        <h3
          className="font-display"
          style={{ fontWeight: 700, fontSize: 18, lineHeight: TITLE_LINE, margin: 0, color: "#26201a", minHeight: 18 * TITLE_LINE * TITLE_LINES, ...clampLines(TITLE_LINES) }}
        >
          {m.name}
        </h3>
        <p
          style={{ margin: "6px 0 12px", fontSize: DESC_FONT, color: "#8c8068", lineHeight: DESC_LINE, height: DESC_FONT * DESC_LINE * DESC_LINES, ...clampLines(DESC_LINES) }}
        >
          {m.description}
        </p>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#6c6150", borderTop: "1px solid #f0e8d6", paddingTop: 11 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: m.accent ?? "#E0A63C", flex: "0 0 auto" }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{location}</span>
        </div>
      </div>
    </Link>
  );
}
