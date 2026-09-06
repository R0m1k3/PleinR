import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { categories, members, promotions, socialPosts } from "@/db/schema";
import { SOCIAL_BRAND, SocialIcon } from "@/components/SocialIcons";
import { configuredNetworks, SOCIAL_LABELS, type SocialNetwork } from "@/lib/social";
import { PROMO_CATEGORY_GROUPS, defaultPromoCategory } from "@/lib/promo-categories";
import { memberPath } from "@/lib/seo";
import { formatValidityShort, visibilityNote } from "@/lib/promo-validity";
import { scheduleLabel } from "@/lib/promo-schedule";
import { setOwnPromoShareTargets, setOwnPromoSuspension } from "../../actions";
import { EspaceHeader } from "../EspaceHeader";
import { MemberSpaceForm } from "../MemberSpaceForm";

export const dynamic = "force-dynamic";

const PROMO_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  live: { label: "En ligne", bg: "#e6f4ec", color: "#1f8a5b" },
  pending: { label: "En attente de validation", bg: "#fbeede", color: "#9a6638" },
  rejected: { label: "Refusée", bg: "#fbe9e6", color: "#d8472b" },
  suspended: { label: "Suspendue", bg: "#fbe9e6", color: "#d8472b" },
  expired: { label: "Expirée", bg: "#f1efe7", color: "#a99c82" },
  scheduled: { label: "Programmée", bg: "#eaf0f6", color: "#2C6FB3" },
};

type MyPromo = {
  id: number;
  title: string;
  status: string;
  category: string | null;
  badge: string | null;
  validUntil: string | null;
  publishAt: Date | null;
  startsOn: string | null;
  endsOn: string | null;
  createdAt: Date;
  imageUrl: string | null;
  suspendedBy: "member" | "staff" | null;
  shareFacebook: boolean;
  shareLinkedin: boolean;
};

type ShareState = Map<string, { status: string; url: string | null; error: string | null }>;

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/** Espace adhérent, onglet Promotions : proposer une offre et suivre les siennes. */
export default async function EspacePromotionsPage() {
  const session = await getSession();
  const memberId = session?.user.memberId ?? null;
  let memberName = session?.user.name ?? "Adhérent";
  let memberLogoUrl: string | null = null;
  let subtitle = "Espace adhérent · Promotions";
  let publicPath: string | null = null;
  let categorySlug: string | null = null;
  let myPromos: MyPromo[] = [];
  let lastShare: ShareState = new Map();

  if (memberId) {
    const [m] = await db
      .select({
        id: members.id,
        name: members.name,
        city: members.city,
        status: members.status,
        logoUrl: members.logoUrl,
        categorySlug: categories.slug,
        categoryLabel: categories.label,
      })
      .from(members)
      .leftJoin(categories, eq(members.categoryId, categories.id))
      .where(eq(members.id, memberId));
    if (m) {
      memberName = m.name;
      memberLogoUrl = m.logoUrl;
      categorySlug = m.categorySlug;
      subtitle = ["Espace adhérent", m.categoryLabel, m.city].filter(Boolean).join(" · ");
      publicPath = m.status === "active" ? memberPath(m) : null;
    }
    myPromos = await db
      .select({
        id: promotions.id,
        title: promotions.title,
        status: promotions.status,
        category: promotions.category,
        badge: promotions.badge,
        validUntil: promotions.validUntil,
        publishAt: promotions.publishAt,
        startsOn: promotions.startsOn,
        endsOn: promotions.endsOn,
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
      for (const row of rows) {
        const key = `${row.promotionId}:${row.network}`;
        if (!lastShare.has(key)) lastShare.set(key, row);
      }
    }
  }

  const networks = await configuredNetworks();
  const live = myPromos.filter((p) => p.status === "live");
  const pending = myPromos.filter((p) => p.status === "pending");
  // Validées mais pas encore à leur date : elles n'ont rien à faire dans
  // l'historique des offres terminées.
  const scheduled = myPromos.filter((p) => p.status === "scheduled");
  const others = myPromos.filter(
    (p) => p.status !== "live" && p.status !== "pending" && p.status !== "scheduled"
  );

  return (
    <div>
      {!memberId && (
        <div style={{ background: "#fbeede", border: "1px solid #ecd8b8", color: "#9a6638", borderRadius: 12, padding: "12px 16px", marginBottom: 18, fontSize: 13.5 }}>
          Votre compte n&apos;est pas encore relié à une fiche adhérent. Les promotions publiées ne
          seront pas rattachées à un commerce.
        </div>
      )}

      <EspaceHeader memberName={memberName} subtitle={subtitle} active="promotions" publicPath={publicPath} promoBadge={live.length} />

      {/* Résumé : ce qui est visible par le public aujourd'hui */}
      <div className="grid grid-3" style={{ gap: 12, marginBottom: 24 }}>
        <StatCard label="En ligne sur le site" value={live.length} color="#1f8a5b" bg="#e6f4ec" />
        <StatCard label="En attente de validation" value={pending.length} color="#9a6638" bg="#fbeede" />
        <StatCard label="Terminées ou suspendues" value={others.length} color="#8c8068" bg="#f1efe7" />
      </div>

      <PromoSection
        title="Mes promotions en cours"
        intro={
          live.length > 0
            ? "Ces offres sont visibles sur le site et sur votre fiche. Vous pouvez en suspendre une à tout moment : elle disparaît aussitôt, et vous la remettez en ligne quand vous voulez."
            : "Aucune promotion en ligne pour le moment. Proposez une offre ci-dessous : elle apparaîtra ici dès sa validation par l'association."
        }
        promos={live}
        networks={networks}
        lastShare={lastShare}
        highlight
      />

      <MemberSpaceForm
        memberName={memberName}
        memberLogoUrl={memberLogoUrl}
        categoryGroups={PROMO_CATEGORY_GROUPS}
        defaultCategory={defaultPromoCategory(categorySlug)}
        networks={networks}
      />

      {scheduled.length > 0 && (
        <PromoSection
          title="Publications programmées"
          intro="Validées par l'association : elles apparaîtront sur le site et sur les réseaux à la date prévue."
          promos={scheduled}
          networks={networks}
          lastShare={lastShare}
        />
      )}

      {pending.length > 0 && (
        <PromoSection
          title="En attente de validation"
          intro="L'association relit chaque offre avant sa mise en ligne. Vous pouvez encore ajuster la diffusion sur les réseaux sociaux."
          promos={pending}
          networks={networks}
          lastShare={lastShare}
        />
      )}

      {others.length > 0 && (
        <PromoSection
          title="Suspendues, refusées ou expirées"
          intro="Historique de vos offres. Une promotion suspendue par vous peut être remise en ligne."
          promos={others}
          networks={networks}
          lastShare={lastShare}
        />
      )}

      {myPromos.length > 0 && (
        <p style={{ fontSize: 13, color: "#8c8068", marginTop: 18 }}>
          Les offres en ligne apparaissent sur <Link href="/promotions" style={{ color: "#9a6638", fontWeight: 700 }}>la page des promotions</Link>
          {publicPath ? (
            <>
              {" "}et sur <Link href={publicPath} style={{ color: "#9a6638", fontWeight: 700 }}>votre fiche</Link>
            </>
          ) : null}
          .
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
      <span className="font-display" style={{ width: 44, height: 44, borderRadius: 12, background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 20, flexShrink: 0 }}>
        {value}
      </span>
      <span style={{ fontSize: 13, color: "#6c6150", fontWeight: 600, lineHeight: 1.35 }}>{label}</span>
    </div>
  );
}

function PromoSection({
  title,
  intro,
  promos,
  networks,
  lastShare,
  highlight = false,
}: {
  title: string;
  intro: string;
  promos: MyPromo[];
  networks: SocialNetwork[];
  lastShare: ShareState;
  highlight?: boolean;
}) {
  return (
    <section
      style={{
        background: highlight ? "#fff" : "transparent",
        border: highlight ? "1px solid #e6dcc6" : "none",
        borderRadius: 16,
        padding: highlight ? 22 : "0",
        marginBottom: 28,
      }}
    >
      <h3 className="font-display" style={{ fontWeight: 700, fontSize: 18, margin: 0, color: "#26201a" }}>
        {title}
        <span style={{ marginLeft: 8, fontSize: 13, color: "#a99c82", fontWeight: 600 }}>{promos.length}</span>
      </h3>
      <p style={{ fontSize: 13, color: "#8c8068", margin: "4px 0 14px", lineHeight: 1.5 }}>{intro}</p>
      {promos.map((mp) => (
        <PromoRow key={mp.id} promo={mp} networks={networks} lastShare={lastShare} />
      ))}
    </section>
  );
}

function PromoRow({ promo: mp, networks, lastShare }: { promo: MyPromo; networks: SocialNetwork[]; lastShare: ShareState }) {
  const st = PROMO_STATUS[mp.status] ?? PROMO_STATUS.expired;
  const suspendedByStaff = mp.status === "suspended" && mp.suspendedBy === "staff";
  const meta = [mp.category, mp.badge, formatValidityShort(mp)].filter(Boolean).join(" · ");
  return (
    <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13, flexWrap: "wrap" }}>
        <span
          style={{
            width: 54,
            height: 54,
            borderRadius: 10,
            background: mp.imageUrl ? `url(${mp.imageUrl})` : "repeating-linear-gradient(45deg,#efe9da,#efe9da 7px,#e6ddc9 7px,#e6ddc9 14px)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            flexShrink: 0,
            opacity: mp.status === "suspended" ? 0.5 : 1,
          }}
        />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "#26201a" }}>{mp.title}</div>
          <div style={{ fontSize: 12, color: "#a99c82", marginTop: 2 }}>
            {meta ? `${meta} · ` : ""}Déposée le {fmtDate(mp.createdAt)}
          </div>
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
      {mp.status === "live" && visibilityNote(mp) && (
        <div style={{ marginTop: 10, background: "#faf7ef", border: "1px solid #f0e8d6", color: "#9a8d72", borderRadius: 9, padding: "9px 11px", fontSize: 12.5, lineHeight: 1.5 }}>
          {visibilityNote(mp)}
        </div>
      )}
      {mp.status === "scheduled" && (
        <div style={{ marginTop: 10, background: "#eaf0f6", border: "1px solid #d3e0ee", color: "#2C6FB3", borderRadius: 9, padding: "9px 11px", fontSize: 12.5, lineHeight: 1.5, fontWeight: 600 }}>
          Validée par l&apos;association. {scheduleLabel(mp.publishAt)} — site et réseaux en même temps.
        </div>
      )}
      {suspendedByStaff && (
        <div style={{ marginTop: 10, background: "#fbe9e6", border: "1px solid #f2d5cf", color: "#a8503c", borderRadius: 9, padding: "9px 11px", fontSize: 12.5, lineHeight: 1.5 }}>
          Cette promotion a été suspendue par l&apos;association. Contactez-la pour la remettre en ligne.
        </div>
      )}
      {networks.length > 0 && <PromoShareState promo={mp} networks={networks} lastShare={lastShare} editable={mp.status === "pending"} />}
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
  lastShare: ShareState;
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
