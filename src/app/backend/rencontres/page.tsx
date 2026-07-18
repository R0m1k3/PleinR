import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { meetingRegistrations, meetings } from "@/db/schema";
import { ImageField } from "@/components/ImageField";
import { MeetingEmailComposer } from "@/components/MeetingEmailComposer";
import { can } from "@/lib/rbac";
import { getSiteSettings } from "@/lib/site-settings";
import { createMeeting, deleteMeeting, updateMeeting } from "../actions";

export const dynamic = "force-dynamic";

function dateTimeValue(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

export default async function RencontresAdminPage() {
  const session = await auth();
  if (!can(session?.user.role, "manageMeetings")) redirect("/backend");

  const [rows, settings] = await Promise.all([
    db
      .select({
        id: meetings.id,
        title: meetings.title,
        startsAt: meetings.startsAt,
        location: meetings.location,
        description: meetings.description,
        capacity: meetings.capacity,
        participantsPerAccount: meetings.participantsPerAccount,
        imageUrl: meetings.imageUrl,
        registered: sql<number>`count(${meetingRegistrations.id})`,
      })
      .from(meetings)
      .leftJoin(meetingRegistrations, eq(meetingRegistrations.meetingId, meetings.id))
      .groupBy(meetings.id)
      .orderBy(desc(meetings.startsAt)),
    getSiteSettings(),
  ]);
  const emailBrand = {
    associationName: settings.association_name,
    address: settings.association_address,
    email: settings.association_email,
    phone: settings.association_phone,
    siret: settings.association_siret,
  };

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <section style={panelStyle}>
        <h2 className="font-display" style={{ margin: "0 0 16px", fontSize: 20, color: "#26201a" }}>Nouvelle rencontre</h2>
        <form action={createMeeting} className="grid grid-2" style={{ gap: 16 }}>
          <div>
            <label className="field-label">Titre</label>
            <input name="title" className="field" required />
          </div>
          <div>
            <label className="field-label">Date et heure</label>
            <input name="startsAt" type="datetime-local" className="field" required />
          </div>
          <div>
            <label className="field-label">Lieu</label>
            <input name="location" className="field" />
          </div>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div>
              <label className="field-label">Places</label>
              <input name="capacity" type="number" min="1" defaultValue={30} className="field" />
            </div>
            <div>
              <label className="field-label">Max. par compte</label>
              <input name="participantsPerAccount" type="number" min="1" max="100" defaultValue={1} className="field" />
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Description</label>
            <textarea name="description" rows={3} className="field" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <ImageField name="imageUrl" label="Image" height={160} />
          </div>
          <button type="submit" style={primaryButton}>Ajouter la rencontre</button>
        </form>
      </section>

      <section>
        <div style={sectionTitle}>Rencontres publiées</div>
        <div className="grid grid-3" style={{ gap: 18 }}>
          {rows.map((meeting) => (
            <article key={meeting.id} style={cardStyle}>
              <form action={updateMeeting} style={{ display: "grid", gap: 12 }}>
                <input type="hidden" name="id" value={meeting.id} />
                <ImageField name="imageUrl" label="Image" defaultValue={meeting.imageUrl ?? ""} height={120} />
                <div>
                  <label className="field-label">Titre</label>
                  <input name="title" defaultValue={meeting.title} className="field" required />
                </div>
                <div>
                  <label className="field-label">Date et heure</label>
                  <input name="startsAt" type="datetime-local" defaultValue={dateTimeValue(meeting.startsAt)} className="field" required />
                </div>
                <div>
                  <label className="field-label">Lieu</label>
                  <input name="location" defaultValue={meeting.location ?? ""} className="field" />
                </div>
                <div className="grid grid-2" style={{ gap: 10 }}>
                  <div>
                    <label className="field-label">Places</label>
                    <input name="capacity" type="number" min="1" defaultValue={meeting.capacity} className="field" />
                  </div>
                  <div>
                    <label className="field-label">Max. / compte</label>
                    <input name="participantsPerAccount" type="number" min="1" max="100" defaultValue={meeting.participantsPerAccount} className="field" />
                  </div>
                </div>
                <div>
                  <label className="field-label">Description</label>
                  <textarea name="description" rows={3} defaultValue={meeting.description ?? ""} className="field" />
                </div>
                <button type="submit" style={primaryButton}>Enregistrer</button>
              </form>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 14, paddingTop: 14, borderTop: "1px solid #f0e8d6" }}>
                <div style={{ fontSize: 12.5, color: "#6c6150", fontWeight: 800 }}>{Number(meeting.registered)} participant(s)</div>
                <Link href={`/backend/inscriptions?meeting=${meeting.id}`} style={{ color: "#9a6638", fontSize: 12.5, fontWeight: 800, textDecoration: "none" }}>Voir les inscrits</Link>
              </div>
              <MeetingEmailComposer
                meeting={{
                  id: meeting.id,
                  title: meeting.title,
                  startsAt: meeting.startsAt.toISOString(),
                  location: meeting.location,
                  description: meeting.description,
                  capacity: meeting.capacity,
                  registered: Number(meeting.registered),
                }}
                brand={emailBrand}
              />
              <form action={deleteMeeting} style={{ marginTop: 8 }}>
                <input type="hidden" name="id" value={meeting.id} />
                <button type="submit" style={dangerButton}>Supprimer</button>
              </form>
            </article>
          ))}
        </div>
        {rows.length === 0 && <div style={emptyStyle}>Aucune rencontre programmée.</div>}
      </section>
    </div>
  );
}

const panelStyle: CSSProperties = { background: "#fff", border: "1px solid #e6dcc6", borderRadius: 8, padding: 22 };
const cardStyle: CSSProperties = { background: "#fff", border: "1px solid #e6dcc6", borderRadius: 8, padding: 16 };
const sectionTitle: CSSProperties = { fontSize: 12.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9a8d72", fontWeight: 800, marginBottom: 12 };
const primaryButton: CSSProperties = { border: "none", background: "#13324F", color: "#fff", fontWeight: 800, fontSize: 13.5, padding: "11px 16px", borderRadius: 8, cursor: "pointer" };
const dangerButton: CSSProperties = { width: "100%", border: "1px solid #e0c3bb", background: "#fff", color: "#d8472b", fontWeight: 800, fontSize: 13, padding: "10px 14px", borderRadius: 8, cursor: "pointer" };
const emptyStyle: CSSProperties = { background: "#fff", border: "1px solid #e6dcc6", borderRadius: 8, padding: 24, color: "#8c8068" };
