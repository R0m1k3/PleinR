import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq, ilike } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { categories, members, users } from "@/db/schema";
import { can } from "@/lib/rbac";
import { AddMemberPanel } from "./AddMemberPanel";
import { BackfillAccountsForm } from "./BackfillAccountsForm";

export const dynamic = "force-dynamic";

function initialsOf(name: string) {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default async function AdherentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!can(session?.user.role, "manageMembers")) {
    redirect("/backend");
  }

  const { q } = await searchParams;
  const search = (q ?? "").trim();

  const cats = await db
    .select({ id: categories.id, label: categories.label })
    .from(categories)
    .orderBy(asc(categories.sort));

  const rows = await db
    .select({
      id: members.id,
      name: members.name,
      email: members.email,
      city: members.city,
      status: members.status,
      categoryLabel: categories.label,
    })
    .from(members)
    .leftJoin(categories, eq(members.categoryId, categories.id))
    .where(search ? ilike(members.name, `%${search}%`) : undefined)
    .orderBy(asc(members.name));

  // Adhérents sans compte de connexion (créés avant l'arrivée des comptes).
  const accountRows = await db
    .select({ email: users.email, memberId: users.memberId })
    .from(users);
  const linkedMemberIds = new Set(accountRows.map((u) => u.memberId).filter((x): x is number => x != null));
  const takenEmails = new Set(accountRows.map((u) => u.email.toLowerCase()));
  const allForCount = await db.select({ id: members.id, email: members.email }).from(members);
  const missingAccounts = allForCount.filter((m) => {
    if (linkedMemberIds.has(m.id)) return false;
    const e = (m.email ?? "").trim().toLowerCase();
    return !!e && !takenEmails.has(e);
  }).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {missingAccounts > 0 && <BackfillAccountsForm missingAccounts={missingAccounts} />}

      <AddMemberPanel categories={cats} />

      <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid #f0e8d6", gap: 12, flexWrap: "wrap" }}>
          <form style={{ display: "flex", alignItems: "center", gap: 10, background: "#faf7ef", border: "1px solid #e6dcc6", borderRadius: 10, padding: "8px 14px" }}>
            <span style={{ width: 9, height: 9, border: "2px solid #9a8d72", borderRadius: "50%" }} />
            <input
              name="q"
              defaultValue={search}
              placeholder="Rechercher un adhérent…"
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, width: 240, color: "#3c3322" }}
            />
          </form>
        </div>

        <div
          className="member-row member-head"
          style={{
            padding: "13px 22px",
            background: "#faf7ef",
            borderBottom: "1px solid #f0e8d6",
            fontSize: 12,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#9a8d72",
            fontWeight: 700,
          }}
        >
          <div>Adhérent</div>
          <div>Catégorie</div>
          <div>Commune</div>
          <div>Statut</div>
          <div style={{ textAlign: "right" }}>Action</div>
        </div>

        {rows.length === 0 && (
          <div style={{ padding: "22px", fontSize: 14, color: "#a99c82" }}>Aucun adhérent trouvé.</div>
        )}

        {rows.map((m) => {
          const active = m.status === "active";
          return (
            <div key={m.id} className="member-row" style={{ padding: "15px 22px", borderBottom: "1px solid #f4eede" }}>
              <div className="member-row__identity">
                <span className="font-display" style={{ width: 38, height: 38, borderRadius: 10, background: "#f0e8d6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#9a8d72", fontSize: 14, flexShrink: 0 }}>
                  {initialsOf(m.name)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "#26201a" }}>{m.name}</div>
                  <div className="member-row__mail" style={{ fontSize: 12, color: "#a99c82" }}>{m.email}</div>
                </div>
              </div>
              <div className="member-row__meta" style={{ fontSize: 13.5, color: "#6c6150" }}>
                {m.categoryLabel ?? "—"}
              </div>
              <div className="member-row__meta" style={{ fontSize: 13.5, color: "#6c6150" }}>
                {m.city ?? "—"}
              </div>
              <div>
                <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, background: active ? "#e6f4ec" : "#fbeede", color: active ? "#1f8a5b" : "#9a6638" }}>
                  {active ? "Actif" : "En attente"}
                </span>
              </div>
              <div className="member-row__action">
                <Link href={`/backend/adherents/${m.id}`} style={{ textDecoration: "none", color: "#2C6FB3", fontWeight: 700, fontSize: 13 }}>
                  Modifier
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
