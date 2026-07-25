import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { asc, desc, eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { meetingRegistrations, meetings, pastMeetingPhotos, pastMeetings } from "@/db/schema";
import { ImageField } from "@/components/ImageField";
import { can } from "@/lib/rbac";
import {
  addPastMeetingPhoto,
  createPastMeeting,
  deletePastMeeting,
  deletePastMeetingPhoto,
  updatePastMeeting,
} from "../actions";

export const dynamic = "force-dynamic";

function dateValue(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
}

export default async function PastMeetingsAdminPage() {
  const session = await getSession();
  if (!can(session?.user.role, "manageMeetings")) redirect("/backend");

  const [meetingRows, archives, photos, refusals] = await Promise.all([
    db
      .select({
        id: meetings.id,
        title: meetings.title,
        startsAt: meetings.startsAt,
        registered: sql<number>`count(${meetingRegistrations.id})`,
      })
      .from(meetings)
      .leftJoin(meetingRegistrations, eq(meetingRegistrations.meetingId, meetings.id))
      .groupBy(meetings.id)
      .orderBy(desc(meetings.startsAt)),
    db.select().from(pastMeetings).orderBy(desc(pastMeetings.eventDate)),
    db.select().from(pastMeetingPhotos).orderBy(asc(pastMeetingPhotos.position), asc(pastMeetingPhotos.id)),
    db
      .select({ meetingId: meetingRegistrations.meetingId, attendeeName: meetingRegistrations.attendeeName })
      .from(meetingRegistrations)
      .where(eq(meetingRegistrations.imageConsent, false))
      .orderBy(asc(meetingRegistrations.attendeeName)),
  ]);

  const photosByPast = new Map<number, typeof photos>();
  for (const photo of photos) photosByPast.set(photo.pastMeetingId, [...(photosByPast.get(photo.pastMeetingId) ?? []), photo]);
  const refusalsByMeeting = new Map<number, string[]>();
  for (const refusal of refusals) refusalsByMeeting.set(refusal.meetingId, [...(refusalsByMeeting.get(refusal.meetingId) ?? []), refusal.attendeeName]);

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <section style={panelStyle}>
        <h2 className="font-display" style={{ margin: "0 0 6px", fontSize: 20, color: "#26201a" }}>Nouvelle rencontre passée</h2>
        <p style={{ color: "#8c8068", fontSize: 13, margin: "0 0 18px" }}>Les trois archives les plus récentes apparaissent sur « L'association » et la page complète rassemble toutes les rencontres passées.</p>
        <form action={createPastMeeting} className="grid grid-2" style={{ gap: 16 }}>
          <div>
            <label className="field-label">Titre</label>
            <input name="title" className="field" required />
          </div>
          <div>
            <label className="field-label">Date</label>
            <input name="eventDate" type="date" className="field" required />
          </div>
          <div>
            <label className="field-label">Lieu</label>
            <input name="location" className="field" />
          </div>
          <div>
            <label className="field-label">Rencontre liée</label>
            <select name="meetingId" className="field" defaultValue="">
              <option value="">Aucune</option>
              {meetingRows.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.title} ({Number(meeting.registered)} participants)</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Description</label>
            <textarea name="description" rows={3} className="field" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Participants manuels (un par ligne, uniquement sans rencontre liée)</label>
            <textarea name="participants" rows={3} className="field" />
          </div>
          <button type="submit" style={primaryButton}>Publier l'archive</button>
        </form>
      </section>

      <section>
        <div style={sectionTitle}>Archives publiées</div>
        <div className="grid grid-3" style={{ gap: 18 }}>
          {archives.map((archive) => {
            const refused = archive.meetingId ? refusalsByMeeting.get(archive.meetingId) ?? [] : [];
            return (
              <article key={archive.id} style={cardStyle}>
                {refused.length > 0 && (
                  <div style={{ background: "#fbe9e6", border: "1px solid #f0c4bb", color: "#b53a25", borderRadius: 8, padding: "11px 13px", fontSize: 12.5, lineHeight: 1.5, marginBottom: 13 }}>
                    <strong>Droit à l'image refusé :</strong> {refused.join(", ")}. Vérifiez que ces personnes ne figurent pas sur les photos publiées.
                  </div>
                )}
                <form action={updatePastMeeting} style={{ display: "grid", gap: 12 }}>
                  <input type="hidden" name="id" value={archive.id} />
                  <div>
                    <label className="field-label">Titre</label>
                    <input name="title" defaultValue={archive.title} className="field" required />
                  </div>
                  <div>
                    <label className="field-label">Date</label>
                    <input name="eventDate" type="date" defaultValue={dateValue(archive.eventDate)} className="field" required />
                  </div>
                  <div>
                    <label className="field-label">Lieu</label>
                    <input name="location" defaultValue={archive.location ?? ""} className="field" />
                  </div>
                  <div>
                    <label className="field-label">Rencontre liée</label>
                    <select name="meetingId" className="field" defaultValue={archive.meetingId ?? ""}>
                      <option value="">Aucune</option>
                      {meetingRows.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.title} ({Number(meeting.registered)})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Description</label>
                    <textarea name="description" rows={3} defaultValue={archive.description ?? ""} className="field" />
                  </div>
                  <div>
                    <label className="field-label">Participants manuels</label>
                    <textarea name="participants" rows={3} defaultValue={archive.participants ?? ""} className="field" />
                  </div>
                  <button type="submit" style={primaryButton}>Enregistrer</button>
                </form>

                <div style={{ marginTop: 14, borderTop: "1px solid #f0e8d6", paddingTop: 14 }}>
                  <form action={addPastMeetingPhoto} style={{ display: "grid", gap: 10 }}>
                    <input type="hidden" name="pastMeetingId" value={archive.id} />
                    <ImageField name="imageUrl" label="Ajouter une photo" height={100} />
                    <input name="caption" className="field" placeholder="Légende" />
                    <button type="submit" style={primaryButton}>Ajouter la photo</button>
                  </form>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 12 }}>
                    {(photosByPast.get(archive.id) ?? []).map((photo) => (
                      <form key={photo.id} action={deletePastMeetingPhoto}>
                        <input type="hidden" name="id" value={photo.id} />
                        <button type="submit" title="Supprimer" aria-label={`Supprimer la photo ${photo.caption ?? ""}`} style={{ width: "100%", aspectRatio: "1 / 1", border: "1px solid #e6dcc6", borderRadius: 8, cursor: "pointer", background: `center/cover no-repeat url(${photo.imageUrl})` }} />
                      </form>
                    ))}
                  </div>
                </div>

                <form action={deletePastMeeting} style={{ marginTop: 12 }}>
                  <input type="hidden" name="id" value={archive.id} />
                  <button type="submit" style={dangerButton}>Supprimer l'archive</button>
                </form>
              </article>
            );
          })}
        </div>
        {archives.length === 0 && <div style={emptyStyle}>Aucune rencontre passée publiée.</div>}
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
