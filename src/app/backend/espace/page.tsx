import { asc, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { categories, members, promotions, type Member } from "@/db/schema";
import { ImageField } from "@/components/ImageField";
import { updateOwnProfile } from "../actions";
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
  let profile: Member | null = null;
  let myPromos: { id: number; title: string; status: string; createdAt: Date; imageUrl: string | null }[] = [];

  if (memberId) {
    const [m] = await db.select().from(members).where(eq(members.id, memberId));
    if (m) {
      profile = m;
      memberName = m.name;
      const [cat] = m.categoryId
        ? await db.select({ label: categories.label }).from(categories).where(eq(categories.id, m.categoryId))
        : [];
      subtitle = ["Espace adhérent", cat?.label, m.city].filter(Boolean).join(" · ");
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

  const catRows = await db
    .select({ label: categories.label })
    .from(categories)
    .orderBy(asc(categories.sort));
  const categoryLabels = catRows.map((c) => c.label);

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

      {profile && (
        <form action={updateOwnProfile} style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, padding: 24, marginBottom: 28 }}>
          <h3 className="font-display" style={{ fontWeight: 700, fontSize: 18, margin: "0 0 18px", color: "#26201a" }}>
            Mon profil
          </h3>

          <div className="grid grid-2" style={{ gap: 16 }}>
            <div>
              <label className="field-label">Nom</label>
              <input name="name" required defaultValue={profile.name} className="field" />
            </div>
            <div>
              <label className="field-label">Commune</label>
              <input name="city" defaultValue={profile.city ?? ""} className="field" />
            </div>
            <div>
              <label className="field-label">Adresse</label>
              <input name="address" defaultValue={profile.address ?? ""} className="field" />
            </div>
            <div>
              <label className="field-label">Code postal</label>
              <input name="postalCode" defaultValue={profile.postalCode ?? ""} className="field" />
            </div>
            <div>
              <label className="field-label">Téléphone</label>
              <input name="phone" defaultValue={profile.phone ?? ""} className="field" />
            </div>
            <div>
              <label className="field-label">Site web</label>
              <input name="website" defaultValue={profile.website ?? ""} className="field" placeholder="https://..." />
            </div>
          </div>

          <div className="grid grid-2" style={{ gap: 16, marginTop: 16 }}>
            <ImageField name="coverUrl" label="Image d'entête (bannière)" defaultValue={profile.coverUrl ?? ""} height={130} />
            <ImageField name="logoUrl" label="Logo" defaultValue={profile.logoUrl ?? ""} height={130} />
          </div>

          <div style={{ marginTop: 16 }}>
            <label className="field-label">Description (une ligne vide sépare les paragraphes)</label>
            <textarea name="description" rows={4} defaultValue={profile.description ?? ""} className="field" style={{ resize: "vertical" }} />
          </div>

          <div style={{ marginTop: 16 }}>
            <label className="field-label">Tags / spécialités (séparés par des virgules)</label>
            <input name="tags" defaultValue={profile.tags ?? ""} className="field" />
          </div>

          <div style={{ marginTop: 16 }}>
            <label className="field-label">Horaires (une ligne par jour : « Jour|plage »)</label>
            <textarea name="hours" rows={4} defaultValue={profile.hours ?? ""} className="field" style={{ resize: "vertical" }} placeholder={"Mardi – Vendredi|7h – 19h30\nSamedi|7h – 19h"} />
          </div>

          <button
            type="submit"
            className="font-display"
            style={{ marginTop: 20, border: "none", background: "#13324F", color: "#fff", fontWeight: 700, fontSize: 14.5, padding: "13px 24px", borderRadius: 11, cursor: "pointer" }}
          >
            Enregistrer mon profil
          </button>
        </form>
      )}

      <MemberSpaceForm memberName={memberName} categories={categoryLabels} />

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
