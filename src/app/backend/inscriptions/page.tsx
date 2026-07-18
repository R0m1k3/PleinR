import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { meetingRegistrations, meetings } from "@/db/schema";
import { can } from "@/lib/rbac";
import {
  confirmMeetingRegistration,
  deleteMeetingRegistration,
  updateMeetingRegistration,
} from "../actions";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default async function InscriptionsPage({ searchParams }: { searchParams: Promise<{ meeting?: string }> }) {
  const session = await auth();
  if (!can(session?.user.role, "manageMeetings")) redirect("/backend");
  const { meeting: meetingParam } = await searchParams;
  const selectedMeetingId = Number(meetingParam) || null;

  const [meetingRows, registrationRows] = await Promise.all([
    db.select({ id: meetings.id, title: meetings.title, startsAt: meetings.startsAt }).from(meetings).orderBy(desc(meetings.startsAt)),
    db
      .select({
        id: meetingRegistrations.id,
        meetingId: meetingRegistrations.meetingId,
        meetingTitle: meetings.title,
        meetingStartsAt: meetings.startsAt,
        attendeeName: meetingRegistrations.attendeeName,
        attendeeCompany: meetingRegistrations.attendeeCompany,
        attendeeEmail: meetingRegistrations.attendeeEmail,
        attendeePhone: meetingRegistrations.attendeePhone,
        status: meetingRegistrations.status,
        imageConsent: meetingRegistrations.imageConsent,
        createdAt: meetingRegistrations.createdAt,
      })
      .from(meetingRegistrations)
      .innerJoin(meetings, eq(meetings.id, meetingRegistrations.meetingId))
      .where(selectedMeetingId ? and(eq(meetingRegistrations.meetingId, selectedMeetingId)) : undefined)
      .orderBy(desc(meetings.startsAt), desc(meetingRegistrations.createdAt)),
  ]);

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <section style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={sectionLabel}>Participants</div>
          <div style={{ color: "#6c6150", fontSize: 13.5, marginTop: 5 }}>{registrationRows.length} inscription{registrationRows.length > 1 ? "s" : ""} affichée{registrationRows.length > 1 ? "s" : ""}</div>
        </div>
        <form method="get" style={{ display: "flex", gap: 9, alignItems: "end", flexWrap: "wrap" }}>
          <div>
            <label className="field-label" htmlFor="meeting-filter">Rencontre</label>
            <select id="meeting-filter" name="meeting" className="field" defaultValue={selectedMeetingId ?? ""} style={{ minWidth: 260 }}>
              <option value="">Toutes les rencontres</option>
              {meetingRows.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.title}</option>)}
            </select>
          </div>
          <button type="submit" style={secondaryButton}>Filtrer</button>
        </form>
      </section>

      {registrationRows.map((registration) => (
        <article key={registration.id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "start", flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <div className="font-display" style={{ color: "#26201a", fontSize: 19, fontWeight: 800 }}>{registration.attendeeName}</div>
              <div style={{ color: "#8c8068", fontSize: 12.5, marginTop: 3 }}>{registration.meetingTitle} · {formatDate(registration.meetingStartsAt)}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={registration.status === "confirmed" ? confirmedBadge : pendingBadge}>{registration.status === "confirmed" ? "Confirmée" : "En attente"}</span>
              <span style={registration.imageConsent ? consentBadge : refusalBadge}>{registration.imageConsent ? "Image autorisée" : "Image refusée"}</span>
            </div>
          </div>

          <form action={updateMeetingRegistration} className="grid grid-2" style={{ gap: 12 }}>
            <input type="hidden" name="id" value={registration.id} />
            <div>
              <label className="field-label">Participant</label>
              <input name="attendeeName" className="field" defaultValue={registration.attendeeName} required />
            </div>
            <div>
              <label className="field-label">Entreprise</label>
              <input name="attendeeCompany" className="field" defaultValue={registration.attendeeCompany} />
            </div>
            <div>
              <label className="field-label">E-mail</label>
              <input name="attendeeEmail" type="email" className="field" defaultValue={registration.attendeeEmail ?? ""} />
            </div>
            <div>
              <label className="field-label">Téléphone</label>
              <input name="attendeePhone" className="field" defaultValue={registration.attendeePhone ?? ""} />
            </div>
            <div>
              <label className="field-label">Statut</label>
              <select name="status" className="field" defaultValue={registration.status}>
                <option value="pending">En attente</option>
                <option value="confirmed">Confirmée</option>
              </select>
            </div>
            <label style={{ display: "flex", gap: 9, alignItems: "center", color: "#6c6150", fontSize: 13, paddingTop: 22 }}>
              <input type="checkbox" name="imageConsent" defaultChecked={registration.imageConsent} />
              Publication de l'image autorisée
            </label>
            <button type="submit" style={primaryButton}>Enregistrer</button>
          </form>

          <div style={{ display: "flex", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0e8d6", flexWrap: "wrap" }}>
            {registration.status !== "confirmed" && (
              <form action={confirmMeetingRegistration}>
                <input type="hidden" name="id" value={registration.id} />
                <button type="submit" style={confirmButton}>Confirmer</button>
              </form>
            )}
            <form action={deleteMeetingRegistration}>
              <input type="hidden" name="id" value={registration.id} />
              <button type="submit" style={dangerButton}>Annuler l'inscription</button>
            </form>
          </div>
        </article>
      ))}

      {registrationRows.length === 0 && <div style={emptyStyle}>Aucune inscription pour cette sélection.</div>}
    </div>
  );
}

const sectionLabel: CSSProperties = { fontSize: 12.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9a8d72", fontWeight: 800 };
const cardStyle: CSSProperties = { background: "#fff", border: "1px solid #e6dcc6", borderRadius: 8, padding: 20 };
const badgeBase: CSSProperties = { display: "inline-block", borderRadius: 999, padding: "5px 10px", fontSize: 11.5, fontWeight: 800 };
const confirmedBadge: CSSProperties = { ...badgeBase, background: "#e6f4ec", color: "#1f8a5b" };
const pendingBadge: CSSProperties = { ...badgeBase, background: "#fbeede", color: "#9a6638" };
const consentBadge: CSSProperties = { ...badgeBase, background: "#eaf0f6", color: "#2C6FB3" };
const refusalBadge: CSSProperties = { ...badgeBase, background: "#fbe9e6", color: "#d8472b" };
const primaryButton: CSSProperties = { border: "none", background: "#13324F", color: "#fff", borderRadius: 8, padding: "11px 16px", fontWeight: 800, cursor: "pointer" };
const secondaryButton: CSSProperties = { border: "1px solid #d8cdb4", background: "#fff", color: "#6f6450", borderRadius: 8, padding: "11px 16px", fontWeight: 800, cursor: "pointer" };
const confirmButton: CSSProperties = { border: "none", background: "#1f8a5b", color: "#fff", borderRadius: 8, padding: "9px 14px", fontWeight: 800, cursor: "pointer" };
const dangerButton: CSSProperties = { border: "1px solid #e0c3bb", background: "#fff", color: "#d8472b", borderRadius: 8, padding: "8px 13px", fontWeight: 800, cursor: "pointer" };
const emptyStyle: CSSProperties = { background: "#fff", border: "1px solid #e6dcc6", borderRadius: 8, padding: 28, color: "#8c8068", textAlign: "center" };
