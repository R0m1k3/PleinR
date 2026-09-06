/**
 * Carte d'une promotion sur le site public.
 *
 * Un seul rendu pour l'accueil (les 6 dernières) et la page `/promotions`
 * (toutes les offres en cours) : les deux listes doivent rester identiques.
 */

import Link from "next/link";
import { PromoImage } from "@/components/PromoImage";
import { MemberAvatar } from "@/components/MemberAvatar";
import { formatValidity } from "@/lib/promo-validity";
import { memberPath } from "@/lib/seo";

const STRIPE_WARM =
  "repeating-linear-gradient(45deg,#efe9da,#efe9da 12px,#e6ddc9 12px,#e6ddc9 24px)";

/** Rouge pour une remise chiffrée, vert pour une offre en nature. */
function badgeColor(badge: string | null) {
  if (!badge) return "#1f8a5b";
  return badge.includes("%") ? "#d8472b" : "#1f8a5b";
}

export type PublicPromo = {
  id: number;
  title: string;
  text: string | null;
  category: string | null;
  badge: string | null;
  imageUrl: string | null;
  validUntil: string | null;
  startsOn: string | null;
  endsOn: string | null;
  memberId: number | null;
  memberName: string | null;
  memberCity: string | null;
  memberLogoUrl: string | null;
};

export function PromoCard({ promo: p }: { promo: PublicPromo }) {
  const validity = formatValidity(p);
  return (
    <Link
      href={p.memberId ? memberPath({ id: p.memberId, name: p.memberName ?? "", city: p.memberCity }) : "#"}
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
        <div style={{ borderTop: "1px solid #f0e8d6", paddingTop: 12 }}>
          {/* Le logo du commerce juste à gauche de son nom. */}
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <MemberAvatar name={p.memberName ?? ""} logoUrl={p.memberLogoUrl} size={28} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#3c3322" }}>{p.memberName}</div>
              {validity && <div style={{ fontSize: 11.5, color: "#a99c82" }}>{validity}</div>}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
