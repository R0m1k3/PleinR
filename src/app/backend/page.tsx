import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { activityLog, contactMessages, members, membershipRequests, promotions } from "@/db/schema";
import { activityNodes } from "@/lib/activity";
import { can, isStaff } from "@/lib/rbac";
import { expiryStatus, getSocialAccounts, SOCIAL_LABELS } from "@/lib/social-accounts";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  hint,
  valueColor = "#13324F",
  hintColor = "#9a8d72",
}: {
  label: string;
  value: number | string;
  hint: string;
  valueColor?: string;
  hintColor?: string;
}) {
  return (
    <div className="stat-card" style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16 }}>
      <div className="stat-card__label">{label}</div>
      <div className="font-display stat-card__value" style={{ color: valueColor }}>
        {value}
      </div>
      <div className="stat-card__hint" style={{ color: hintColor }}>{hint}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!isStaff(session?.user.role)) {
    redirect("/backend/espace");
  }

  const [activeMembers, livePromos, pendingPromos, requests, newMessages, activity] = await Promise.all([
    db.select({ id: members.id }).from(members).where(eq(members.status, "active")),
    db.select({ id: promotions.id }).from(promotions).where(eq(promotions.status, "live")),
    db.select({ id: promotions.id }).from(promotions).where(eq(promotions.status, "pending")),
    db.select({ id: membershipRequests.id }).from(membershipRequests).where(eq(membershipRequests.status, "new")),
    db.select({ id: contactMessages.id }).from(contactMessages).where(eq(contactMessages.status, "new")),
    db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(6),
  ]);

  const pendingCount = pendingPromos.length;

  // Jetons réseaux à renouveler : sans alerte, on ne découvre l'expiration
  // qu'au moment où une publication échoue.
  const expiringNetworks = can(session?.user.role, "manageSettings")
    ? (await getSocialAccounts())
        .filter((a) => a.accessToken && a.targetId)
        .map((a) => ({ network: a.network, status: expiryStatus(a.expiresAt) }))
        .filter((a) => a.status === "soon" || a.status === "expired")
    : [];

  function timeAgo(date: Date) {
    const diff = Date.now() - new Date(date).getTime();
    const h = Math.floor(diff / 3_600_000);
    if (h < 1) return "à l'instant";
    if (h < 24) return `il y a ${h} h`;
    const d = Math.floor(h / 24);
    return d === 1 ? "hier" : `il y a ${d} j`;
  }

  return (
    <div>
      {expiringNetworks.length > 0 && (
        <Link
          href="/backend/reseaux"
          style={{
            display: "block",
            textDecoration: "none",
            background: "#fbeede",
            border: "1px solid #ecd8b8",
            color: "#9a6638",
            borderRadius: 12,
            padding: "13px 16px",
            marginBottom: 20,
            fontSize: 13.5,
            lineHeight: 1.6,
          }}
        >
          {expiringNetworks.map((n) => (
            <div key={n.network}>
              <strong>{SOCIAL_LABELS[n.network]}</strong>{" "}
              {n.status === "expired"
                ? "— le jeton a expiré, les publications échoueront."
                : "— le jeton expire dans moins de 7 jours."}{" "}
              Reconnecter le compte →
            </div>
          ))}
        </Link>
      )}

      <div className="grid grid-4" style={{ marginBottom: 26 }}>
        <StatCard label="Adhérents actifs" value={activeMembers.length} hint="sur le réseau" valueColor="#13324F" hintColor="#1f8a5b" />
        <StatCard label="Promotions en ligne" value={livePromos.length} hint="visibles sur le site" />
        <StatCard label="À modérer" value={pendingCount} hint="en attente de validation" valueColor="#9a6638" hintColor="#9a6638" />
        <Link href="/backend/demandes" style={{ textDecoration: "none" }}>
          <StatCard
            label="Demandes & messages"
            value={requests.length + newMessages.length}
            hint={`${requests.length} adhésion · ${newMessages.length} contact`}
            valueColor="#13324F"
            hintColor="#9a6638"
          />
        </Link>
      </div>

      <div className="grid dash-split">
        <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, padding: 22 }}>
          <h3 className="font-display" style={{ fontWeight: 700, fontSize: 17, margin: "0 0 16px", color: "#26201a" }}>
            Activité récente
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {activity.length === 0 && (
              <div style={{ fontSize: 13.5, color: "#a99c82" }}>Aucune activité récente.</div>
            )}
            {activity.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: a.dot, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 13.5, color: "#3c3322" }}>
                  {activityNodes(a.message)}
                </div>
                <span style={{ fontSize: 12, color: "#a99c82", whiteSpace: "nowrap" }}>
                  {timeAgo(a.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "#13324F", borderRadius: 16, padding: 22, color: "#cfe0ee" }}>
          <h3 className="font-display" style={{ fontWeight: 700, fontSize: 17, margin: "0 0 6px", color: "#fff" }}>
            Promotions à modérer
          </h3>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#9bb6cd" }}>
            {pendingCount} en attente de validation.
          </p>
          <Link
            href="/backend/promotions"
            className="font-display"
            style={{
              display: "block",
              textAlign: "center",
              width: "100%",
              border: "none",
              background: "#E0A63C",
              color: "#33291D",
              fontWeight: 700,
              fontSize: 14.5,
              padding: 13,
              borderRadius: 11,
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Ouvrir la modération
          </Link>
          <Link
            href="/backend/espace"
            className="font-display"
            style={{
              display: "block",
              textAlign: "center",
              width: "100%",
              marginTop: 10,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "transparent",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14.5,
              padding: 13,
              borderRadius: 11,
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Espace adhérent
          </Link>
        </div>
      </div>
    </div>
  );
}
