import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { activityLog, members, membershipRequests, promotions } from "@/db/schema";
import { isStaff } from "@/lib/rbac";

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
    <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, padding: 20 }}>
      <div style={{ fontSize: 13, color: "#9a8d72", marginBottom: 8 }}>{label}</div>
      <div className="font-display" style={{ fontWeight: 800, fontSize: 32, color: valueColor }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: hintColor, marginTop: 6, fontWeight: 600 }}>{hint}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!isStaff(session?.user.role)) {
    redirect("/backend/espace");
  }

  const [activeMembers, livePromos, pendingPromos, requests, activity] = await Promise.all([
    db.select({ id: members.id }).from(members).where(eq(members.status, "active")),
    db.select({ id: promotions.id }).from(promotions).where(eq(promotions.status, "live")),
    db.select({ id: promotions.id }).from(promotions).where(eq(promotions.status, "pending")),
    db.select({ id: membershipRequests.id }).from(membershipRequests).where(eq(membershipRequests.status, "new")),
    db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(6),
  ]);

  const pendingCount = pendingPromos.length;

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
      <div className="grid grid-4" style={{ marginBottom: 26 }}>
        <StatCard label="Adhérents actifs" value={activeMembers.length} hint="sur le réseau" valueColor="#13324F" hintColor="#1f8a5b" />
        <StatCard label="Promotions en ligne" value={livePromos.length} hint="visibles sur le site" />
        <StatCard label="À modérer" value={pendingCount} hint="en attente de validation" valueColor="#9a6638" hintColor="#9a6638" />
        <StatCard label="Demandes d'adhésion" value={requests.length} hint="à traiter" valueColor="#13324F" hintColor="#9a6638" />
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
                <div
                  style={{ flex: 1, fontSize: 13.5, color: "#3c3322" }}
                  dangerouslySetInnerHTML={{ __html: a.message }}
                />
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
