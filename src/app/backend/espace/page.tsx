import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { categories, members, promotions } from "@/db/schema";
import { MemberSpaceForm } from "./MemberSpaceForm";

export const dynamic = "force-dynamic";

const PROMO_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  live: { label: "En ligne", bg: "#e6f4ec", color: "#1f8a5b" },
  pending: { label: "En attente", bg: "#fbeede", color: "#9a6638" },
  rejected: { label: "Refusée", bg: "#fbe9e6", color: "#d8472b" },
  expired: { label: "Expirée", bg: "#f1efe7", color: "#a99c82" },
};

function initialsOf(name: string) {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default async function EspacePage() {
  const session = await auth();
  const memberId = session?.user.memberId ?? null;
  const fallbackName = session?.user.name ?? "Adhérent";

  let memberName = fallbackName;
  let subtitle = "Espace adhérent";
  let myPromos: { id: number; title: string; status: string; createdAt: Date; imageUrl: string | null }[] = [];

  if (memberId) {
    const [m] = await db
      .select({ name: members.name, city: members.city, categoryLabel: categories.label })
      .from(members)
      .leftJoin(categories, eq(members.categoryId, categories.id))
      .where(eq(members.id, memberId));
    if (m) {
      memberName = m.name;
      subtitle = ["Espace adhérent", m.categoryLabel, m.city].filter(Boolean).join(" · ");
    }
    myPromos = await db
      .select({
        id: promotions.id,
        title: promotions.title,
        status: promotions.status,
        createdAt: promotions.createdAt,
        imageUrl: promotions.imageUrl,
      })
      .from(promotions)
      .where(eq(promotions.memberId, memberId))
      .orderBy(desc(promotions.createdAt));
  }

  function fmtDate(d: Date) {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  }

  return (
    <div>
      {!memberId && (
        <div style={{ background: "#fbeede", border: "1px solid #ecd8b8", color: "#9a6638", borderRadius: 12, padding: "12px 16px", marginBottom: 18, fontSize: 13.5 }}>
          Votre compte n&apos;est pas encore relié à une fiche adhérent. Les promotions publiées ne
          seront pas rattachées à un commerce.
        </div>
      )}

      <div style={{ background: "#13324F", borderRadius: 16, padding: "20px 24px", marginBottom: 22, display: "flex", alignItems: "center", gap: 15 }}>
        <span className="font-display" style={{ width: 46, height: 46, borderRadius: 12, background: "#E0A63C", color: "#33291D", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
          {initialsOf(memberName)}
        </span>
        <div>
          <div className="font-display" style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>
            {memberName}
          </div>
          <div style={{ fontSize: 13, color: "#9bb6cd" }}>{subtitle}</div>
        </div>
      </div>

      <MemberSpaceForm memberName={memberName} />

      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 12.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9a8d72", fontWeight: 700, marginBottom: 12 }}>
          Mes promotions
        </div>
        {myPromos.length === 0 && (
          <div style={{ fontSize: 13.5, color: "#a99c82" }}>Vous n&apos;avez pas encore publié de promotion.</div>
        )}
        {myPromos.map((mp) => {
          const st = PROMO_STATUS[mp.status] ?? PROMO_STATUS.expired;
          return (
            <div key={mp.id} style={{ display: "flex", alignItems: "center", gap: 13, background: "#fff", border: "1px solid #e6dcc6", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
              <span
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 9,
                  background: mp.imageUrl
                    ? `url(${mp.imageUrl})`
                    : "repeating-linear-gradient(45deg,#efe9da,#efe9da 7px,#e6ddc9 7px,#e6ddc9 14px)",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#26201a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {mp.title}
                </div>
                <div style={{ fontSize: 12, color: "#a99c82" }}>Publié le {fmtDate(mp.createdAt)}</div>
              </div>
              <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, background: st.bg, color: st.color }}>
                {st.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
