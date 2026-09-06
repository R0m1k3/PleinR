import Link from "next/link";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { categories, imageConsents, meetingRegistrations, meetings, members, promotions } from "@/db/schema";
import type { Member } from "@/db/schema";
import { memberPath } from "@/lib/seo";
import { ImageField } from "@/components/ImageField";
import { ImageConsentForm } from "@/components/ImageConsentForm";
import { HoursEditor } from "@/components/HoursEditor";
import { TagsField } from "@/components/TagsField";
import { communeOptions } from "@/lib/communes";
import { saveImageConsent, updateOwnProfile } from "../actions";
import { EspaceHeader } from "./EspaceHeader";

export const dynamic = "force-dynamic";

/** Espace adhérent, onglet Profil : fiche publique, inscriptions, droit à l'image. */
export default async function EspacePage() {
  const session = await getSession();
  const memberId = session?.user.memberId ?? null;
  const fallbackName = session?.user.name ?? "Adhérent";

  let memberName = fallbackName;
  let subtitle = "Espace adhérent";
  let profile: Member | null = null;
  let livePromoCount = 0;
  let myRegistrations: { meetingId: number; title: string; startsAt: Date; location: string | null; participants: number; confirmed: boolean }[] = [];
  let latestConsent: { decision: string; createdAt: Date } | null = null;
  let profileCategory: { slug: string; label: string } | null = null;

  if (memberId) {
    const [m] = await db.select().from(members).where(eq(members.id, memberId));
    if (m) {
      profile = m;
      memberName = m.name;
      const [cat] = m.categoryId
        ? await db.select({ slug: categories.slug, label: categories.label }).from(categories).where(eq(categories.id, m.categoryId))
        : [];
      profileCategory = cat ?? null;
      subtitle = ["Espace adhérent", cat?.label, m.city].filter(Boolean).join(" · ");
    }
    const [live] = await db
      .select({ total: sql<number>`count(*)` })
      .from(promotions)
      .where(and(eq(promotions.memberId, memberId), eq(promotions.status, "live")));
    livePromoCount = Number(live?.total ?? 0);
    myRegistrations = await db
      .select({
        meetingId: meetings.id,
        title: meetings.title,
        startsAt: meetings.startsAt,
        location: meetings.location,
        participants: sql<number>`count(${meetingRegistrations.id})`,
        confirmed: sql<boolean>`bool_and(${meetingRegistrations.status} = 'confirmed')`,
      })
      .from(meetingRegistrations)
      .innerJoin(meetings, eq(meetings.id, meetingRegistrations.meetingId))
      .where(and(eq(meetingRegistrations.memberId, memberId), gte(meetings.startsAt, new Date())))
      .groupBy(meetings.id)
      .orderBy(asc(meetings.startsAt));
    const [consent] = await db
      .select({ decision: imageConsents.decision, createdAt: imageConsents.createdAt })
      .from(imageConsents)
      .where(eq(imageConsents.memberId, memberId))
      .orderBy(desc(imageConsents.createdAt))
      .limit(1);
    latestConsent = consent ?? null;
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

      <EspaceHeader
        memberName={memberName}
        subtitle={subtitle}
        active="profil"
        publicPath={profile && profile.status === "active" ? memberPath(profile) : null}
        promoBadge={livePromoCount}
      />

      {memberId && (
        <section style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 8, padding: 24, marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", marginBottom: 15, flexWrap: "wrap" }}>
            <div>
              <h3 className="font-display" style={{ fontWeight: 700, fontSize: 18, margin: 0, color: "#26201a" }}>Mes inscriptions</h3>
              <div style={{ color: "#8c8068", fontSize: 13, marginTop: 4 }}>Participants inscrits aux prochaines rencontres.</div>
            </div>
            <Link href="/association" style={{ color: "#9a6638", fontSize: 13, fontWeight: 800, textDecoration: "none" }}>Voir les rencontres</Link>
          </div>
          {myRegistrations.length === 0 && <div style={{ color: "#a99c82", fontSize: 13.5 }}>Aucune inscription à venir.</div>}
          <div style={{ display: "grid", gap: 10 }}>
            {myRegistrations.map((registration) => (
              <div key={registration.meetingId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, borderTop: "1px solid #f0e8d6", paddingTop: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ color: "#26201a", fontSize: 14, fontWeight: 800 }}>{registration.title}</div>
                  <div style={{ color: "#8c8068", fontSize: 12.5, marginTop: 3 }}>
                    {fmtDate(registration.startsAt)} · {registration.participants} participant{registration.participants > 1 ? "s" : ""}{registration.location ? ` · ${registration.location}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: registration.confirmed ? "#e6f4ec" : "#fbeede", color: registration.confirmed ? "#1f8a5b" : "#9a6638", borderRadius: 999, padding: "5px 10px", fontSize: 11.5, fontWeight: 800 }}>
                    {registration.confirmed ? "Confirmée" : "En attente"}
                  </span>
                  <Link href={`/inscription/${registration.meetingId}`} style={{ color: "#9a6638", fontSize: 12.5, fontWeight: 800, textDecoration: "none" }}>Modifier</Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
              <label className="field-label">E-mail de contact (affiché sur la fiche)</label>
              <input name="contactEmail" type="email" defaultValue={profile.contactEmail ?? ""} className="field" placeholder={profile.email} />
              <p className="field-hint">
                Indépendant de votre identifiant de connexion. Laissé vide, la fiche affiche l&apos;e-mail de votre compte.
              </p>
            </div>
            <div>
              <label className="field-label">Commune</label>
              <select name="city" className="field" defaultValue={profile.city ?? ""}>
                <option value="">—</option>
                {communeOptions(profile.city).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
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
            <ImageField name="logoUrl" label="Logo" defaultValue={profile.logoUrl ?? ""} height={130} fit="contain" />
          </div>

          <div style={{ marginTop: 16 }}>
            <label className="field-label">Description (une ligne vide sépare les paragraphes)</label>
            <textarea name="description" rows={4} defaultValue={profile.description ?? ""} className="field" style={{ resize: "vertical" }} />
            <p className="field-hint">
              Ce texte est lu par Google : indiquez votre métier, votre commune et vos spécialités en trois à cinq
              phrases (ex. « Boulangerie artisanale à Frouard : pain au levain, viennoiseries, pâtisseries maison »).
            </p>
          </div>

          <div style={{ marginTop: 16 }}>
            <label className="field-label">Tags / spécialités (séparés par des virgules)</label>
            <TagsField defaultValue={profile.tags} fixedCategory={profileCategory} />
          </div>

          <div style={{ marginTop: 16 }}>
            <HoursEditor defaultValue={profile.hours} />
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

      {memberId && (
        <section style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, padding: 24, marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap", marginBottom: 14 }}>
            <div>
              <h3 className="font-display" style={{ fontWeight: 700, fontSize: 18, margin: 0, color: "#26201a" }}>
                Droit à l'image
              </h3>
              <div style={{ color: "#8c8068", fontSize: 13, marginTop: 4 }}>
                {latestConsent?.decision === "accepted"
                  ? "Autorisation signée et enregistrée. Vous pouvez la retirer à tout moment."
                  : "Vous pouvez autoriser l'utilisation de votre image à tout moment."}
              </div>
            </div>
            {latestConsent && (
              <span style={{ background: latestConsent.decision === "accepted" ? "#e6f4ec" : "#fbe9e6", color: latestConsent.decision === "accepted" ? "#1f8a5b" : "#d8472b", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 800 }}>
                {latestConsent.decision === "accepted" ? "Autorisé" : "Refusé"} · {fmtDate(latestConsent.createdAt)}
              </span>
            )}
          </div>
          <ImageConsentForm
            saveAction={saveImageConsent}
            defaultName={memberName}
            compact
            currentDecision={latestConsent?.decision === "accepted" ? "accepted" : latestConsent?.decision === "refused" ? "refused" : null}
          />
        </section>
      )}

    </div>
  );
}
