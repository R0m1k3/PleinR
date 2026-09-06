import Link from "next/link";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { categories, imageConsents, meetingRegistrations, meetings, members, promotions, socialPosts, type Member } from "@/db/schema";
import { SOCIAL_BRAND, SocialIcon } from "@/components/SocialIcons";
import { configuredNetworks, SOCIAL_LABELS, type SocialNetwork } from "@/lib/social";
import { ImageField } from "@/components/ImageField";
import { ImageConsentForm } from "@/components/ImageConsentForm";
import { HoursEditor } from "@/components/HoursEditor";
import { TagsField } from "@/components/TagsField";
import { communeOptions } from "@/lib/communes";
import {
  saveImageConsent,
  setOwnPromoShareTargets,
  setOwnPromoSuspension,
  updateOwnProfile,
} from "../actions";
import { MemberSpaceForm } from "./MemberSpaceForm";

export const dynamic = "force-dynamic";

const PROMO_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  live: { label: "En ligne", bg: "#e6f4ec", color: "#1f8a5b" },
  pending: { label: "En attente", bg: "#fbeede", color: "#9a6638" },
  rejected: { label: "Refusée", bg: "#fbe9e6", color: "#d8472b" },
  suspended: { label: "Suspendue", bg: "#fbe9e6", color: "#d8472b" },
  expired: { label: "Expirée", bg: "#f1efe7", color: "#a99c82" },
};

function initialsOf(name: string) {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default async function EspacePage() {
  const session = await getSession();
  const memberId = session?.user.memberId ?? null;
  const fallbackName = session?.user.name ?? "Adhérent";

  let memberName = fallbackName;
  let subtitle = "Espace adhérent";
  let profile: Member | null = null;
  let myPromos: {
    id: number;
    title: string;
    status: string;
    createdAt: Date;
    imageUrl: string | null;
    suspendedBy: "member" | "staff" | null;
    shareFacebook: boolean;
    shareLinkedin: boolean;
  }[] = [];
  // Dernière tentative de publication par (promo, réseau).
  let lastShare = new Map<string, { status: string; url: string | null; error: string | null }>();
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
    myPromos = await db
      .select({
        id: promotions.id,
        title: promotions.title,
        status: promotions.status,
        createdAt: promotions.createdAt,
        imageUrl: promotions.imageUrl,
        suspendedBy: promotions.suspendedBy,
        shareFacebook: promotions.shareFacebook,
        shareLinkedin: promotions.shareLinkedin,
      })
      .from(promotions)
      .where(eq(promotions.memberId, memberId))
      .orderBy(desc(promotions.createdAt));
    if (myPromos.length > 0) {
      const rows = await db
        .select({
          promotionId: socialPosts.promotionId,
          network: socialPosts.network,
          status: socialPosts.status,
          url: socialPosts.url,
          error: socialPosts.error,
        })
        .from(socialPosts)
        .where(inArray(socialPosts.promotionId, myPromos.map((p) => p.id)))
        .orderBy(desc(socialPosts.createdAt));
      // Trié du plus récent au plus ancien : la première occurrence gagne.
      lastShare = new Map();
      for (const row of rows) {
        const key = `${row.promotionId}:${row.network}`;
        if (!lastShare.has(key)) lastShare.set(key, row);
      }
    }
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

  const catRows = await db
    .select({ label: categories.label })
    .from(categories)
    .orderBy(asc(categories.sort));
  const categoryLabels = catRows.map((c) => c.label);
  const networks = await configuredNetworks();

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

      <MemberSpaceForm memberName={memberName} categories={categoryLabels} networks={networks} />

      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 12.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9a8d72", fontWeight: 700, marginBottom: 4 }}>
          Mes promotions
        </div>
        <div style={{ fontSize: 13, color: "#8c8068", marginBottom: 12 }}>
          Vous pouvez suspendre une promotion en ligne à tout moment : elle disparaît du site et
          vous la remettez en ligne quand vous voulez.
        </div>
        {myPromos.length === 0 && (
          <div style={{ fontSize: 13.5, color: "#a99c82" }}>Vous n&apos;avez pas encore publié de promotion.</div>
        )}
        {myPromos.map((mp) => {
          const st = PROMO_STATUS[mp.status] ?? PROMO_STATUS.expired;
          const suspendedByStaff = mp.status === "suspended" && mp.suspendedBy === "staff";
          return (
            <div key={mp.id} style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
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
                    opacity: mp.status === "suspended" ? 0.5 : 1,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#26201a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {mp.title}
                  </div>
                  <div style={{ fontSize: 12, color: "#a99c82" }}>Publié le {fmtDate(mp.createdAt)}</div>
                </div>
                <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, background: st.bg, color: st.color, flexShrink: 0 }}>
                  {st.label}
                </span>
                {mp.status === "live" && (
                  <form action={setOwnPromoSuspension}>
                    <input type="hidden" name="id" value={mp.id} />
                    <input type="hidden" name="action" value="suspend" />
                    <button type="submit" style={{ border: "1px solid #e0c3bb", background: "#fff", color: "#d8472b", fontWeight: 700, fontSize: 12.5, padding: "7px 13px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap" }}>
                      Suspendre
                    </button>
                  </form>
                )}
                {mp.status === "suspended" && !suspendedByStaff && (
                  <form action={setOwnPromoSuspension}>
                    <input type="hidden" name="id" value={mp.id} />
                    <input type="hidden" name="action" value="restore" />
                    <button type="submit" style={{ border: "none", background: "#1f8a5b", color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "8px 14px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap" }}>
                      Remettre en ligne
                    </button>
                  </form>
                )}
              </div>
              {suspendedByStaff && (
                <div style={{ marginTop: 10, background: "#fbe9e6", border: "1px solid #f2d5cf", color: "#a8503c", borderRadius: 9, padding: "9px 11px", fontSize: 12.5, lineHeight: 1.5 }}>
                  Cette promotion a été suspendue par l&apos;association. Contactez-la pour la
                  remettre en ligne.
                </div>
              )}
              {networks.length > 0 && (
                <PromoShareState
                  promo={mp}
                  networks={networks}
                  lastShare={lastShare}
                  editable={mp.status === "pending"}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * État de diffusion d'une promo côté adhérent : modifiable tant qu'elle est en
 * attente, purement informatif dès qu'elle est validée.
 */
function PromoShareState({
  promo,
  networks,
  lastShare,
  editable,
}: {
  promo: { id: number; shareFacebook: boolean; shareLinkedin: boolean };
  networks: SocialNetwork[];
  lastShare: Map<string, { status: string; url: string | null; error: string | null }>;
  editable: boolean;
}) {
  const wanted = (n: SocialNetwork) => (n === "facebook" ? promo.shareFacebook : promo.shareLinkedin);
  const chosen = networks.filter(wanted);

  if (editable) {
    return (
      <form action={setOwnPromoShareTargets} style={{ marginTop: 11, borderTop: "1px solid #f0e8d6", paddingTop: 11 }}>
        <input type="hidden" name="id" value={promo.id} />
        <div style={{ fontSize: 11.5, color: "#8c8068", marginBottom: 8, lineHeight: 1.5 }}>
          Diffusion prévue après validation — modifiable tant que la promotion est en attente.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {networks.map((network) => (
            <label key={network} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: SOCIAL_BRAND[network], cursor: "pointer" }}>
              <input
                type="checkbox"
                name={network === "facebook" ? "shareFacebook" : "shareLinkedin"}
                defaultChecked={wanted(network)}
                style={{ accentColor: SOCIAL_BRAND[network], margin: 0 }}
              />
              <SocialIcon network={network} size={15} />
              {SOCIAL_LABELS[network]}
            </label>
          ))}
          <button type="submit" style={{ border: "1px solid #d8cdb4", background: "#fff", color: "#6c6150", fontWeight: 700, fontSize: 12, padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>
            Mettre à jour
          </button>
        </div>
      </form>
    );
  }

  if (chosen.length === 0) return null;

  return (
    <div style={{ marginTop: 11, borderTop: "1px solid #f0e8d6", paddingTop: 11, display: "flex", gap: 8, flexWrap: "wrap" }}>
      {chosen.map((network) => {
        const last = lastShare.get(`${promo.id}:${network}`);
        const posted = last?.status === "posted";
        const failed = last?.status === "failed";
        const detail = posted ? "publié" : failed ? "échec de publication" : "en attente";
        const color = posted ? "#1f8a5b" : failed ? "#d8472b" : "#9a6638";
        const chip = (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#faf7ef", border: "1px solid #f0e8d6", borderRadius: 999, padding: "5px 12px", fontSize: 11.5, fontWeight: 700, color }}>
            <SocialIcon network={network} size={13} />
            {SOCIAL_LABELS[network]} · {detail}
          </span>
        );
        return posted && last?.url ? (
          <a key={network} href={last.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            {chip}
          </a>
        ) : (
          <span key={network}>{chip}</span>
        );
      })}
    </div>
  );
}
