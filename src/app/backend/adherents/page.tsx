import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq, ilike } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { categories, members } from "@/db/schema";
import { can } from "@/lib/rbac";
import { AddMemberPanel } from "./AddMemberPanel";

export const dynamic = "force-dynamic";

function initialsOf(name: string) {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default async function AdherentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
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

  const COLS = "1.6fr 1fr 1.2fr 0.9fr 0.8fr";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
          style={{
            display: "grid",
            gridTemplateColumns: COLS,
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
            <div key={m.id} style={{ display: "grid", gridTemplateColumns: COLS, alignItems: "center", padding: "15px 22px", borderBottom: "1px solid #f4eede" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="font-display" style={{ width: 38, height: 38, borderRadius: 10, background: "#f0e8d6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#9a8d72", fontSize: 14, flexShrink: 0 }}>
                  {initialsOf(m.name)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "#26201a" }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: "#a99c82" }}>{m.email}</div>
                </div>
              </div>
              <div style={{ fontSize: 13.5, color: "#6c6150" }}>{m.categoryLabel ?? "—"}</div>
              <div style={{ fontSize: 13.5, color: "#6c6150" }}>{m.city ?? "—"}</div>
              <div>
                <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, background: active ? "#e6f4ec" : "#fbeede", color: active ? "#1f8a5b" : "#9a6638" }}>
                  {active ? "Actif" : "En attente"}
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
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
