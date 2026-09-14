import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { categories, members, promotions } from "@/db/schema";
import { memberPath } from "@/lib/seo";
import { getMemberFeed } from "@/lib/informations";
import { InformationCard } from "@/components/InformationCard";
import { MarkInformationsRead } from "@/components/MarkInformationsRead";
import { EspaceHeader } from "../EspaceHeader";

export const dynamic = "force-dynamic";

/**
 * Espace adhérent, onglet Informations : ce que publie l'association.
 *
 * Les non-lues sont calculées **avant** le marquage, qui a lieu après le rendu
 * (`MarkInformationsRead`) : les pastilles « Nouveau » sont donc visibles sur
 * la visite où elles disparaissent.
 */
export default async function EspaceInformationsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const userId = Number(session.user.id);
  const memberId = session.user.memberId ?? null;

  let memberName = session.user.name ?? "Adhérent";
  let subtitle = "Espace adhérent";
  let publicPath: string | null = null;
  let livePromoCount = 0;

  if (memberId) {
    const [profile] = await db.select().from(members).where(eq(members.id, memberId));
    if (profile) {
      memberName = profile.name;
      const [category] = profile.categoryId
        ? await db.select({ label: categories.label }).from(categories).where(eq(categories.id, profile.categoryId))
        : [];
      subtitle = ["Espace adhérent", category?.label, profile.city].filter(Boolean).join(" · ");
      if (profile.status === "active") publicPath = memberPath(profile);
    }
    const [live] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(promotions)
      .where(and(eq(promotions.memberId, memberId), eq(promotions.status, "live")));
    livePromoCount = live?.total ?? 0;
  }

  const feed = await getMemberFeed(userId);
  const unreadIds = feed.filter((item) => item.unread).map((item) => item.id);

  return (
    <div>
      <EspaceHeader
        memberName={memberName}
        subtitle={subtitle}
        active="informations"
        publicPath={publicPath}
        promoBadge={livePromoCount}
        infoBadge={unreadIds.length}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h2 className="font-display" style={{ margin: 0, fontWeight: 700, fontSize: 19, color: "#26201a" }}>
            Informations de l&apos;association
          </h2>
          <div style={{ color: "#8c8068", fontSize: 13, marginTop: 4 }}>
            Annonces, convocations et rappels publiés par le bureau.
          </div>
        </div>
        {unreadIds.length > 0 && (
          <span style={{ background: "#e6f4ec", color: "#1f8a5b", borderRadius: 999, padding: "6px 13px", fontSize: 12.5, fontWeight: 800 }}>
            {unreadIds.length} non lue{unreadIds.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {feed.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 14, padding: 28, color: "#a99c82", fontSize: 13.5 }}>
          L&apos;association n&apos;a encore rien publié. Les annonces du bureau apparaîtront ici.
        </div>
      ) : (
        feed.map((item) => (
          <InformationCard
            key={item.id}
            title={item.title}
            body={item.body}
            imageUrl={item.imageUrl}
            publishedAt={item.publishedAt}
            authorName={item.authorName}
            pinned={item.pinned}
            unread={item.unread}
          />
        ))
      )}

      <MarkInformationsRead ids={unreadIds} />
    </div>
  );
}
