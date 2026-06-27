import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { contactMessages, membershipRequests } from "@/db/schema";
import { can } from "@/lib/rbac";
import { setContactStatus, setRequestStatus } from "../actions";

export const dynamic = "force-dynamic";

const REQ_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  new: { label: "Nouvelle", bg: "#fbeede", color: "#9a6638" },
  approved: { label: "Approuvée", bg: "#e6f4ec", color: "#1f8a5b" },
  rejected: { label: "Rejetée", bg: "#fbe9e6", color: "#d8472b" },
};
const MSG_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  new: { label: "Nouveau", bg: "#fbeede", color: "#9a6638" },
  read: { label: "Lu", bg: "#e7eef6", color: "#2C6FB3" },
  archived: { label: "Archivé", bg: "#f1efe7", color: "#a99c82" },
};

function fmt(d: Date) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function StatusPill({ map, status }: { map: typeof REQ_STATUS; status: string }) {
  const s = map[status] ?? map.new;
  return (
    <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function ActionBtn({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <button type="submit" style={{ border: "1px solid #e3dac4", background: "#fff", color, fontWeight: 600, fontSize: 12.5, padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>
      {children}
    </button>
  );
}

export default async function DemandesPage() {
  const session = await auth();
  if (!can(session?.user.role, "manageMembers")) {
    redirect("/backend");
  }

  const [requests, messages] = await Promise.all([
    db.select().from(membershipRequests).orderBy(desc(membershipRequests.createdAt)),
    db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {/* ---- Demandes d'adhésion ---- */}
      <section style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, overflow: "hidden" }}>
        <div className="font-display" style={{ padding: "16px 22px", borderBottom: "1px solid #f0e8d6", fontWeight: 700, fontSize: 16, color: "#26201a" }}>
          Demandes d&apos;adhésion ({requests.length})
        </div>
        {requests.length === 0 && (
          <div style={{ padding: "18px 22px", fontSize: 13.5, color: "#a99c82" }}>Aucune demande.</div>
        )}
        {requests.map((r) => (
          <div key={r.id} style={{ padding: "15px 22px", borderBottom: "1px solid #f4eede" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "#26201a" }}>{r.name}</div>
                <div style={{ fontSize: 12.5, color: "#a99c82" }}>
                  {[r.email, fmt(r.createdAt)].filter(Boolean).join(" · ")}
                </div>
              </div>
              <StatusPill map={REQ_STATUS} status={r.status} />
              <div style={{ display: "flex", gap: 8 }}>
                <form action={setRequestStatus}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="status" value="approved" />
                  <ActionBtn color="#1f8a5b">Approuver</ActionBtn>
                </form>
                <form action={setRequestStatus}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="status" value="rejected" />
                  <ActionBtn color="#d8472b">Rejeter</ActionBtn>
                </form>
              </div>
            </div>
            {r.message && (
              <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "#5a5040", whiteSpace: "pre-wrap" }}>{r.message}</p>
            )}
          </div>
        ))}
      </section>

      {/* ---- Messages de contact ---- */}
      <section style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, overflow: "hidden" }}>
        <div className="font-display" style={{ padding: "16px 22px", borderBottom: "1px solid #f0e8d6", fontWeight: 700, fontSize: 16, color: "#26201a" }}>
          Messages de contact ({messages.length})
        </div>
        {messages.length === 0 && (
          <div style={{ padding: "18px 22px", fontSize: 13.5, color: "#a99c82" }}>Aucun message.</div>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ padding: "15px 22px", borderBottom: "1px solid #f4eede" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "#26201a" }}>
                  {m.name}
                  {m.subject ? <span style={{ fontWeight: 500, color: "#6c6150" }}> — {m.subject}</span> : null}
                </div>
                <div style={{ fontSize: 12.5, color: "#a99c82" }}>
                  <a href={`mailto:${m.email}`} style={{ color: "#9a6638" }}>{m.email}</a> · {fmt(m.createdAt)}
                </div>
              </div>
              <StatusPill map={MSG_STATUS} status={m.status} />
              <div style={{ display: "flex", gap: 8 }}>
                <form action={setContactStatus}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="status" value="read" />
                  <ActionBtn color="#2C6FB3">Marquer lu</ActionBtn>
                </form>
                <form action={setContactStatus}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="status" value="archived" />
                  <ActionBtn color="#a99c82">Archiver</ActionBtn>
                </form>
              </div>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "#5a5040", whiteSpace: "pre-wrap" }}>{m.message}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
