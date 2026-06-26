import Link from "next/link";
import type { Metadata } from "next";
import { Sparkle } from "@/components/Sparkle";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  getActiveMembersWithCategory,
  getAllCategories,
  getLiveBadgesByMember,
} from "@/lib/queries";
import { AnnuaireClient, type DirectoryMember } from "./AnnuaireClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Annuaire — Plein R",
  description:
    "L'annuaire des commerçants et entreprises du Bassin de Pompey. Trouvez un professionnel et ses bons plans.",
};

export default async function AnnuairePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [rawMembers, categories, badges] = await Promise.all([
    getActiveMembersWithCategory(),
    getAllCategories(),
    getLiveBadgesByMember(),
  ]);

  const badgeByMember = new Map<number, string | null>();
  for (const b of badges) {
    if (b.memberId != null && !badgeByMember.has(b.memberId)) {
      badgeByMember.set(b.memberId, b.badge);
    }
  }

  const members: DirectoryMember[] = rawMembers.map((m) => ({
    ...m,
    hasPromo: badgeByMember.has(m.id),
    promoBadge: badgeByMember.get(m.id) ?? null,
  }));

  return (
    <div style={{ background: "#F6F2E8", minHeight: "100vh", fontFamily: "'Public Sans',sans-serif", color: "#33291D" }}>
      <SiteHeader active="annuaire" />

      <div className="container" style={{ paddingBottom: 56 }}>
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
            {members.length} adhérents
          </div>
          <h1 className="font-display" style={{ fontWeight: 800, fontSize: 40, letterSpacing: "-0.02em", margin: "0 0 8px", color: "#26201a" }}>
            L&apos;annuaire des commerçants &amp; entreprises
          </h1>
          <p style={{ margin: 0, fontSize: 16.5, color: "#6c6150", maxWidth: 560 }}>
            Trouvez un professionnel du Bassin de Pompey, découvrez sa fiche et ses bons plans.
          </p>
        </section>

        <AnnuaireClient members={members} categories={categories} initialQuery={q ?? ""} />

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
              Vous n&apos;êtes pas encore référencé ?
            </div>
            <h2 className="font-display" style={{ fontWeight: 800, fontSize: 26, margin: 0, color: "#fff" }}>
              Rejoignez l&apos;annuaire Plein R
            </h2>
          </div>
          <Link
            href="/backend"
            className="font-display"
            style={{ textDecoration: "none", background: "#E0A63C", color: "#33291D", fontWeight: 700, fontSize: 15.5, padding: "14px 26px", borderRadius: 12, whiteSpace: "nowrap" }}
          >
            Adhérer à l&apos;association
          </Link>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
