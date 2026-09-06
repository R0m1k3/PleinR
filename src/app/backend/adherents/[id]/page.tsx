import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { categories, members, users } from "@/db/schema";
import { can } from "@/lib/rbac";
import { ImageField } from "@/components/ImageField";
import { HoursEditor } from "@/components/HoursEditor";
import { TagsField } from "@/components/TagsField";
import { communeOptions } from "@/lib/communes";
import { deleteMember, updateMember } from "../../actions";
import { ResetPasswordButton } from "../ResetPasswordButton";

export const dynamic = "force-dynamic";

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!can(session?.user.role, "manageMembers")) {
    redirect("/backend");
  }

  const { id } = await params;
  const memberId = Number(id);
  if (!memberId) notFound();

  const [member] = await db.select().from(members).where(eq(members.id, memberId));
  if (!member) notFound();

  const cats = await db
    .select({ id: categories.id, slug: categories.slug, label: categories.label })
    .from(categories)
    .orderBy(asc(categories.sort));

  const [account] = await db
    .select({ email: users.email, mustChange: users.mustChangePassword })
    .from(users)
    .where(eq(users.memberId, memberId));

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
            <label className="field-label">E-mail du compte (identifiant, échanges avec l&apos;association)</label>
            <input name="email" type="email" defaultValue={member.email} className="field" />
          </div>
          <div>
            <label className="field-label">E-mail de contact (affiché sur la fiche)</label>
            <input name="contactEmail" type="email" defaultValue={member.contactEmail ?? ""} className="field" placeholder={member.email} />
            <p className="field-hint">Laissé vide, la fiche publique affiche l&apos;e-mail du compte.</p>
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
            <select name="city" className="field" defaultValue={member.city ?? ""}>
              <option value="">—</option>
              {communeOptions(member.city).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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

        <div className="grid grid-2" style={{ gap: 16, marginTop: 16 }}>
          <ImageField name="coverUrl" label="Image d'entête (bannière)" defaultValue={member.coverUrl ?? ""} height={130} />
          <ImageField name="logoUrl" label="Logo" defaultValue={member.logoUrl ?? ""} height={130} fit="contain" />
        </div>

        <div style={{ marginTop: 16 }}>
          <label className="field-label">Description (une ligne vide sépare les paragraphes)</label>
          <textarea name="description" rows={4} defaultValue={member.description ?? ""} className="field" style={{ resize: "vertical" }} />
          <p className="field-hint">
            Ce texte est lu par Google : indiquez votre métier, votre commune et vos spécialités en trois à cinq
            phrases (ex. « Boulangerie artisanale à Frouard : pain au levain, viennoiseries, pâtisseries maison »).
          </p>
        </div>

        <div style={{ marginTop: 16 }}>
          <label className="field-label">Tags / spécialités (séparés par des virgules)</label>
          <TagsField defaultValue={member.tags} categories={cats} />
        </div>

        <div style={{ marginTop: 16 }}>
          <HoursEditor defaultValue={member.hours} />
        </div>

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

      <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, padding: 22, marginTop: 16 }}>
        <h3 className="font-display" style={{ fontWeight: 700, fontSize: 16, margin: "0 0 12px", color: "#26201a" }}>
          Compte de connexion
        </h3>
        {account ? (
          <>
            <div style={{ fontSize: 13.5, color: "#5a5040", marginBottom: 10 }}>
              Identifiant : <strong>{account.email}</strong>
            </div>
            {account.mustChange ? (
              <div style={{ background: "#fbeede", border: "1px solid #ecd8b8", borderRadius: 10, padding: "11px 14px", fontSize: 13.5, color: "#9a6638" }}>
                En attente de première connexion : l&apos;adhérent devra changer son mot de passe temporaire.
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Mot de passe égaré ? Réinitialisez-le : un nouveau vous sera montré une seule fois.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#1f8a5b", fontWeight: 600 }}>
                ✓ L&apos;adhérent a défini son propre mot de passe.
              </div>
            )}
            <ResetPasswordButton memberId={memberId} />
          </>
        ) : (
          <div style={{ fontSize: 13.5, color: "#a99c82" }}>
            Aucun compte de connexion lié à cet adhérent.
          </div>
        )}
      </div>

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
