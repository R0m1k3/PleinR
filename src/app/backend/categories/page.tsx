import { redirect } from "next/navigation";
import { asc, count, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { categories, members } from "@/db/schema";
import { can } from "@/lib/rbac";
import { addCategory, deleteCategory, renameCategory } from "../actions";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const session = await auth();
  if (!can(session?.user.role, "manageCategories")) {
    redirect("/backend");
  }

  const rows = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      label: categories.label,
      accent: categories.accent,
      tint: categories.tint,
      memberCount: count(members.id),
    })
    .from(categories)
    .leftJoin(members, eq(members.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sort));

  return (
    <div className="grid admins-split">
      {/* list */}
      <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, overflow: "hidden" }}>
        <div className="font-display" style={{ padding: "16px 22px", borderBottom: "1px solid #f0e8d6", fontWeight: 700, fontSize: 16, color: "#26201a" }}>
          Catégories ({rows.length})
        </div>

        {rows.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 22px", borderBottom: "1px solid #f4eede", flexWrap: "wrap" }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: c.tint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span className="sparkle" style={{ width: 12, height: 12, background: c.accent }} />
            </span>

            <form action={renameCategory} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 220 }}>
              <input type="hidden" name="id" value={c.id} />
              <input name="label" defaultValue={c.label} className="field" style={{ padding: "8px 11px", flex: 1 }} />
              <button type="submit" style={{ border: "1px solid #d8cdb4", background: "#faf7ef", color: "#3c3322", fontWeight: 700, fontSize: 12.5, padding: "8px 12px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap" }}>
                Renommer
              </button>
            </form>

            <span style={{ fontSize: 12, color: "#a99c82", whiteSpace: "nowrap" }}>
              {c.memberCount} adhérent{c.memberCount > 1 ? "s" : ""}
            </span>

            <form action={deleteCategory}>
              <input type="hidden" name="id" value={c.id} />
              <button type="submit" style={{ border: "none", background: "transparent", color: "#d8472b", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                Supprimer
              </button>
            </form>
          </div>
        ))}
      </div>

      {/* add */}
      <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, padding: 22 }}>
        <h3 className="font-display" style={{ fontWeight: 700, fontSize: 16, margin: "0 0 16px", color: "#26201a" }}>
          Ajouter une catégorie
        </h3>
        <form action={addCategory}>
          <label className="field-label">Nom de la catégorie</label>
          <input name="label" required placeholder="ex : Cordonnerie" className="field" style={{ marginBottom: 16 }} />
          <button
            type="submit"
            className="font-display"
            style={{ width: "100%", border: "none", background: "#13324F", color: "#fff", fontWeight: 700, fontSize: 14.5, padding: 13, borderRadius: 11, cursor: "pointer" }}
          >
            Ajouter
          </button>
        </form>
        <p style={{ fontSize: 11.5, color: "#a99c82", marginTop: 12, lineHeight: 1.5 }}>
          Une couleur est attribuée automatiquement. Supprimer une catégorie détache
          les adhérents concernés (ils restent, sans catégorie).
        </p>
      </div>
    </div>
  );
}
