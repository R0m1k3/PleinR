import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { categories, members } from "@/db/schema";
import { can } from "@/lib/rbac";
import { deleteMember, updateMember } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!can(session?.user.role, "manageMembers")) {
    redirect("/backend");
  }

  const { id } = await params;
  const memberId = Number(id);
  if (!memberId) notFound();

  const [member] = await db.select().from(members).where(eq(members.id, memberId));
  if (!member) notFound();

  const cats = await db
    .select({ id: categories.id, label: categories.label })
    .from(categories)
    .orderBy(asc(categories.sort));

  async function handleDelete() {
    "use server";
    const fd = new FormData();
    fd.set("id", String(memberId));
    await deleteMember(fd);
    redirect("/backend/adherents");
  }

  async function handleUpdate(fd: FormData) {
    "use server";
    await updateMember(fd);
    redirect("/backend/adherents");
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <Link href="/backend/adherents" style={{ textDecoration: "none", color: "#6f6450", fontSize: 13.5, fontWeight: 600 }}>
        ← Retour aux adhérents
      </Link>

      <form action={handleUpdate} style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, padding: 24, marginTop: 14 }}>
        <input type="hidden" name="id" value={member.id} />
        <h3 className="font-display" style={{ fontWeight: 700, fontSize: 18, margin: "0 0 18px", color: "#26201a" }}>
          Modifier l&apos;adhérent
        </h3>

        <div className="grid grid-2" style={{ gap: 16 }}>
          <div>
            <label className="field-label">Nom</label>
            <input name="name" required defaultValue={member.name} className="field" />
          </div>
          <div>
            <label className="field-label">E-mail</label>
            <input name="email" type="email" defaultValue={member.email} className="field" />
          </div>
          <div>
            <label className="field-label">Catégorie</label>
            <select name="categoryId" className="field" defaultValue={member.categoryId ?? ""}>
              <option value="">—</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Commune</label>
            <input name="city" defaultValue={member.city ?? ""} className="field" />
          </div>
          <div>
            <label className="field-label">Adresse</label>
            <input name="address" defaultValue={member.address ?? ""} className="field" />
          </div>
          <div>
            <label className="field-label">Code postal</label>
            <input name="postalCode" defaultValue={member.postalCode ?? ""} className="field" />
          </div>
          <div>
            <label className="field-label">Téléphone</label>
            <input name="phone" defaultValue={member.phone ?? ""} className="field" placeholder="03 83 ..." />
          </div>
          <div>
            <label className="field-label">Site web</label>
            <input name="website" defaultValue={member.website ?? ""} className="field" placeholder="https://..." />
          </div>
          <div>
            <label className="field-label">Adhérent depuis (année)</label>
            <input name="memberSince" type="number" defaultValue={member.memberSince ?? ""} className="field" placeholder="2021" />
          </div>
          <div>
            <label className="field-label">Statut</label>
            <select name="status" className="field" defaultValue={member.status}>
              <option value="pending">En attente</option>
              <option value="active">Actif</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label className="field-label">Description (une ligne vide sépare les paragraphes)</label>
          <textarea name="description" rows={4} defaultValue={member.description ?? ""} className="field" style={{ resize: "vertical" }} />
        </div>

        <div style={{ marginTop: 16 }}>
          <label className="field-label">Tags / spécialités (séparés par des virgules)</label>
          <input name="tags" defaultValue={member.tags ?? ""} className="field" placeholder="Levain naturel, Produits locaux, Fait maison" />
        </div>

        <div style={{ marginTop: 16 }}>
          <label className="field-label">Horaires (une ligne par jour : « Jour|plage », ex : Mardi – Vendredi|7h – 19h30)</label>
          <textarea name="hours" rows={4} defaultValue={member.hours ?? ""} className="field" style={{ resize: "vertical" }} placeholder={"Mardi – Vendredi|7h – 19h30\nSamedi|7h – 19h\nDimanche|7h – 13h\nLundi|Fermé"} />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 16, fontSize: 14, color: "#3c3322", cursor: "pointer" }}>
          <input type="checkbox" name="highlighted" defaultChecked={member.highlighted} />
          Mettre à l&apos;honneur sur la page d&apos;accueil
        </label>

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button
            type="submit"
            className="font-display"
            style={{ border: "none", background: "#13324F", color: "#fff", fontWeight: 700, fontSize: 14.5, padding: "13px 24px", borderRadius: 11, cursor: "pointer" }}
          >
            Enregistrer
          </button>
        </div>
      </form>

      <form action={handleDelete} style={{ marginTop: 16 }}>
        <button
          type="submit"
          style={{ border: "1px solid #e0c3bb", background: "#fff", color: "#d8472b", fontWeight: 700, fontSize: 13.5, padding: "11px 18px", borderRadius: 10, cursor: "pointer" }}
        >
          Supprimer cet adhérent
        </button>
      </form>
    </div>
  );
}
