import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { members, promotions, socialPosts, users } from "@/db/schema";
import { can } from "@/lib/rbac";
import { configuredNetworks, SOCIAL_LABELS, type SocialNetwork } from "@/lib/social";
import { moderatePromo, sharePromoToSocial } from "../actions";
import { PromoImage } from "@/components/PromoImage";

export const dynamic = "force-dynamic";

const STRIPE_WARM =
  "repeating-linear-gradient(45deg,#efe9da,#efe9da 11px,#e6ddc9 11px,#e6ddc9 22px)";
const STRIPE_COOL =
  "repeating-linear-gradient(45deg,#eef0ec,#eef0ec 11px,#e2e8e6 11px,#e2e8e6 22px)";

const STATUS_CHIP: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: "En attente", bg: "#fbeede", color: "#9a6638" },
  live: { label: "En ligne", bg: "#e6f4ec", color: "#1f8a5b" },
  suspended: { label: "Suspendue", bg: "#fbe9e6", color: "#d8472b" },
};

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default async function PromotionsPage() {
  const session = await auth();
  if (!can(session?.user.role, "moderatePromos")) {
    redirect("/backend");
  }
  const canShare = can(session?.user.role, "publishSocial");
  const networks = canShare ? configuredNetworks() : [];

  const rows = await db
    .select({
      id: promotions.id,
      title: promotions.title,
      text: promotions.text,
      category: promotions.category,
      status: promotions.status,
      imageUrl: promotions.imageUrl,
      suspendedBy: promotions.suspendedBy,
      suspendedAt: promotions.suspendedAt,
      memberName: members.name,
    })
    .from(promotions)
    .leftJoin(members, eq(promotions.memberId, members.id))
    .where(inArray(promotions.status, ["pending", "live", "suspended"]))
    .orderBy(desc(promotions.createdAt));

  const pending = rows.filter((r) => r.status === "pending");
  const live = rows.filter((r) => r.status === "live");
  const suspended = rows.filter((r) => r.status === "suspended");
  // En attente d'abord, puis en ligne, puis suspendues.
  const ordered = [...pending, ...live, ...suspended];

  const shares = ordered.length
    ? await db
        .select({
          promotionId: socialPosts.promotionId,
          network: socialPosts.network,
          status: socialPosts.status,
          url: socialPosts.url,
          error: socialPosts.error,
          createdAt: socialPosts.createdAt,
          authorName: users.name,
        })
        .from(socialPosts)
        .leftJoin(users, eq(socialPosts.postedById, users.id))
        .where(inArray(socialPosts.promotionId, ordered.map((r) => r.id)))
        .orderBy(desc(socialPosts.createdAt))
    : [];

  // La liste est triée du plus récent au plus ancien : la première occurrence
  // rencontrée pour un couple (promo, réseau) est donc la plus récente.
  const lastShare = new Map<string, (typeof shares)[number]>();
  for (const s of shares) {
    const key = `${s.promotionId}:${s.network}`;
    if (!lastShare.has(key)) lastShare.set(key, s);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <span style={{ background: "#13324F", color: "#fff", fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 999 }}>
          En attente · {pending.length}
        </span>
        <span style={{ background: "#fff", border: "1px solid #e6dcc6", color: "#6c6150", fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 999 }}>
          En ligne · {live.length}
        </span>
        <span style={{ background: "#fff", border: "1px solid #e6dcc6", color: "#6c6150", fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 999 }}>
          Suspendues · {suspended.length}
        </span>
      </div>

      {canShare && networks.length === 0 && (
        <div style={{ background: "#fbeede", border: "1px solid #ecd8b8", color: "#9a6638", borderRadius: 12, padding: "12px 16px", marginBottom: 18, fontSize: 13.5, lineHeight: 1.55 }}>
          Publication sur les réseaux indisponible : aucun jeton d&apos;accès Facebook ou LinkedIn
          n&apos;est configuré sur le serveur (voir <code>.env.example</code>).
        </div>
      )}

      {ordered.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, padding: 28, color: "#a99c82", fontSize: 14 }}>
          Aucune promotion pour le moment.
        </div>
      )}

      <div className="grid grid-3" style={{ gap: 16, width: "100%", maxWidth: 960 }}>
        {ordered.map((p) => {
          const isPending = p.status === "pending";
          const isSuspended = p.status === "suspended";
          const chip = STATUS_CHIP[p.status] ?? STATUS_CHIP.pending;
          return (
            <article
              key={p.id}
              style={{
                background: "#fff",
                border: "1px solid #e6dcc6",
                borderRadius: 16,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  position: "relative",
                  aspectRatio: "4 / 3",
                  background: isPending ? STRIPE_COOL : STRIPE_WARM,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isSuspended ? 0.55 : 1,
                }}
              >
                {p.imageUrl && <PromoImage src={p.imageUrl} alt={p.title ?? ""} />}
                {p.category && (
                  <span style={{ position: "absolute", top: 10, left: 10, background: "#9a6638", color: "#fff", borderRadius: 999, padding: "4px 11px", fontSize: 11, fontWeight: 700 }}>
                    {p.category}
                  </span>
                )}
                <span
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    borderRadius: 999,
                    padding: "4px 11px",
                    fontSize: 11,
                    fontWeight: 800,
                    background: chip.bg,
                    color: chip.color,
                  }}
                >
                  {chip.label}
                </span>
              </div>
              <div style={{ padding: "13px 14px 14px", display: "flex", flexDirection: "column", flex: 1 }}>
                <h3 className="font-display" style={{ fontWeight: 700, fontSize: 15.5, margin: "0 0 4px", color: "#26201a" }}>
                  {p.title}
                </h3>
                <div style={{ fontSize: 12.5, color: "#9a6638", fontWeight: 600, marginBottom: 8 }}>
                  {p.memberName}
                </div>
                <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#8c8068", lineHeight: 1.45, flex: 1 }}>
                  {p.text}
                </p>

                {isSuspended && (
                  <div style={{ background: "#fbe9e6", border: "1px solid #f2d5cf", color: "#a8503c", borderRadius: 10, padding: "9px 11px", fontSize: 12, lineHeight: 1.45, marginBottom: 11 }}>
                    Suspendue par {p.suspendedBy === "member" ? "l'adhérent" : "l'association"}
                    {p.suspendedAt ? ` le ${fmtDate(p.suspendedAt)}` : ""}.
                  </div>
                )}

                {isPending && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <form action={moderatePromo} style={{ flex: 1 }}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="action" value="approve" />
                      <button type="submit" style={{ width: "100%", border: "none", background: "#1f8a5b", color: "#fff", fontWeight: 700, fontSize: 13, padding: 10, borderRadius: 9, cursor: "pointer" }}>
                        Valider
                      </button>
                    </form>
                    <form action={moderatePromo} style={{ flex: 1 }}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="action" value="reject" />
                      <button type="submit" style={{ width: "100%", border: "1px solid #e0c3bb", background: "#fff", color: "#d8472b", fontWeight: 700, fontSize: 13, padding: 10, borderRadius: 9, cursor: "pointer" }}>
                        Refuser
                      </button>
                    </form>
                  </div>
                )}

                {!isPending && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <form action={moderatePromo} style={{ flex: 1 }}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="action" value={isSuspended ? "restore" : "suspend"} />
                      <button
                        type="submit"
                        style={{
                          width: "100%",
                          border: isSuspended ? "none" : "1px solid #e0c3bb",
                          background: isSuspended ? "#1f8a5b" : "#fff",
                          color: isSuspended ? "#fff" : "#d8472b",
                          fontWeight: 700,
                          fontSize: 13,
                          padding: 10,
                          borderRadius: 9,
                          cursor: "pointer",
                        }}
                      >
                        {isSuspended ? "Remettre en ligne" : "Suspendre"}
                      </button>
                    </form>
                    <form action={moderatePromo}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="action" value="remove" />
                      <button type="submit" style={{ border: "1px solid #e6dcc6", background: "#fff", color: "#a99c82", fontWeight: 700, fontSize: 13, padding: "10px 12px", borderRadius: 9, cursor: "pointer" }}>
                        Supprimer
                      </button>
                    </form>
                  </div>
                )}

                {networks.length > 0 && (
                  <div style={{ borderTop: "1px solid #f0e8d6", marginTop: 12, paddingTop: 11 }}>
                    <div style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a8d72", fontWeight: 800, marginBottom: 8 }}>
                      Partager sur les réseaux
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {networks.map((network) => (
                        <ShareButton
                          key={network}
                          network={network}
                          promoId={p.id}
                          disabled={p.status !== "live"}
                          last={lastShare.get(`${p.id}:${network}`)}
                        />
                      ))}
                    </div>
                    {networks.map((network) => {
                      const last = lastShare.get(`${p.id}:${network}`);
                      if (!last) return null;
                      return (
                        <div key={network} style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.45, color: last.status === "posted" ? "#6c6150" : "#d8472b" }}>
                          {last.status === "posted" ? (
                            <>
                              ✓ {SOCIAL_LABELS[network]} · {fmtDate(last.createdAt)}
                              {last.authorName ? ` · ${last.authorName}` : ""}
                              {last.url && (
                                <>
                                  {" "}
                                  <a href={last.url} target="_blank" rel="noopener noreferrer" style={{ color: "#2C6FB3", fontWeight: 700 }}>
                                    voir
                                  </a>
                                </>
                              )}
                            </>
                          ) : (
                            <>✕ {SOCIAL_LABELS[network]} — échec : {last.error?.slice(0, 160)}</>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ShareButton({
  network,
  promoId,
  disabled,
  last,
}: {
  network: SocialNetwork;
  promoId: number;
  disabled: boolean;
  last?: { status: string };
}) {
  const alreadyPosted = last?.status === "posted";
  const brand = network === "facebook" ? "#1877F2" : "#0A66C2";
  return (
    <form action={sharePromoToSocial} style={{ flex: "1 1 120px" }}>
      <input type="hidden" name="id" value={promoId} />
      <input type="hidden" name="network" value={network} />
      <button
        type="submit"
        disabled={disabled}
        title={disabled ? "Seule une promotion en ligne peut être publiée." : undefined}
        style={{
          width: "100%",
          border: `1px solid ${brand}`,
          background: alreadyPosted ? "#fff" : brand,
          color: alreadyPosted ? brand : "#fff",
          fontWeight: 700,
          fontSize: 12.5,
          padding: "9px 10px",
          borderRadius: 9,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.45 : 1,
        }}
      >
        {alreadyPosted ? `Republier sur ${SOCIAL_LABELS[network]}` : `Publier sur ${SOCIAL_LABELS[network]}`}
      </button>
    </form>
  );
}
