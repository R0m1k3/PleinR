import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { asc, desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { meetingRegistrations, meetings, pastMeetingPhotos, pastMeetings } from "@/db/schema";
import { ImageField } from "@/components/ImageField";
import { can } from "@/lib/rbac";
import {
  addPastMeetingPhoto,
  createMeeting,
  createPastMeeting,
  deleteMeeting,
  deletePastMeeting,
  deletePastMeetingPhoto,
  updateMeeting,
  updatePastMeeting,
} from "../actions";

export const dynamic = "force-dynamic";

function dateTimeValue(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

function dateValue(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
}

export default async function RencontresAdminPage() {
  const session = await auth();
  if (!can(session?.user.role, "manageMeetings")) redirect("/backend");

  const rows = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      startsAt: meetings.startsAt,
      location: meetings.location,
      description: meetings.description,
      capacity: meetings.capacity,
      imageUrl: meetings.imageUrl,
      registered: sql<number>`count(${meetingRegistrations.id})`,
    })
    .from(meetings)
    .leftJoin(meetingRegistrations, eq(meetingRegistrations.meetingId, meetings.id))
    .groupBy(meetings.id)
    .orderBy(desc(meetings.startsAt));

  const archives = await db.select().from(pastMeetings).orderBy(desc(pastMeetings.eventDate));
  const photos = await db
    .select()
    .from(pastMeetingPhotos)
    .orderBy(asc(pastMeetingPhotos.position), asc(pastMeetingPhotos.id));

  const photosByPast = new Map<number, typeof photos>();
  for (const photo of photos) {
    photosByPast.set(photo.pastMeetingId, [...(photosByPast.get(photo.pastMeetingId) ?? []), photo]);
  }

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <section style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, padding: 22 }}>
        <h2 className="font-display" style={{ margin: "0 0 16px", fontSize: 20, color: "#26201a" }}>
          Nouvelle rencontre
        </h2>
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
          <div>
            <label className="field-label">Places</label>
            <input name="capacity" type="number" min="1" defaultValue={30} className="field" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Description</label>
            <textarea name="description" rows={3} className="field" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <ImageField name="imageUrl" label="Image" height={160} />
          </div>
          <button type="submit" style={primaryButton}>
            Ajouter la rencontre
          </button>
        </form>
      </section>

      <section>
        <div style={sectionTitle}>Rencontres à venir / publiées</div>
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
                <div>
                  <label className="field-label">Places</label>
                  <input name="capacity" type="number" min="1" defaultValue={meeting.capacity} className="field" />
                </div>
                <div>
                  <label className="field-label">Description</label>
                  <textarea name="description" rows={3} defaultValue={meeting.description ?? ""} className="field" />
                </div>
                <div style={{ fontSize: 12.5, color: "#6c6150", fontWeight: 800 }}>
                  {Number(meeting.registered)} inscrit(s)
                </div>
                <button type="submit" style={primaryButton}>Enregistrer</button>
              </form>
              <form action={deleteMeeting} style={{ marginTop: 8 }}>
                <input type="hidden" name="id" value={meeting.id} />
                <button type="submit" style={dangerButton}>Supprimer</button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 16, padding: 22 }}>
        <h2 className="font-display" style={{ margin: "0 0 16px", fontSize: 20, color: "#26201a" }}>
          Nouvelle rencontre passée
        </h2>
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
            <label className="field-label">Lier une rencontre</label>
            <select name="meetingId" className="field" defaultValue="">
              <option value="">Aucune</option>
              {rows.map((meeting) => (
                <option key={meeting.id} value={meeting.id}>
                  {meeting.title}
                </option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Description</label>
            <textarea name="description" rows={3} className="field" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Participants manuels (un par ligne, si non liée)</label>
            <textarea name="participants" rows={3} className="field" />
          </div>
          <button type="submit" style={primaryButton}>Publier l'archive</button>
        </form>
      </section>

      <section>
        <div style={sectionTitle}>Rencontres passées</div>
        <div className="grid grid-3" style={{ gap: 18 }}>
          {archives.map((archive) => (
            <article key={archive.id} style={cardStyle}>
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
                    {rows.map((meeting) => (
                      <option key={meeting.id} value={meeting.id}>
                        {meeting.title}
                      </option>
                    ))}
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
                      <button type="submit" title="Supprimer" style={{ width: "100%", aspectRatio: "1 / 1", border: "1px solid #e6dcc6", borderRadius: 8, cursor: "pointer", background: `center/cover no-repeat url(${photo.imageUrl})` }} />
                    </form>
                  ))}
                </div>
              </div>

              <form action={deletePastMeeting} style={{ marginTop: 12 }}>
                <input type="hidden" name="id" value={archive.id} />
                <button type="submit" style={dangerButton}>Supprimer l'archive</button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e6dcc6",
  borderRadius: 12,
  padding: 16,
};

const sectionTitle: CSSProperties = {
  fontSize: 12.5,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "#9a8d72",
  fontWeight: 800,
  marginBottom: 12,
};

const primaryButton: CSSProperties = {
  border: "none",
  background: "#13324F",
  color: "#fff",
  fontWeight: 800,
  fontSize: 13.5,
  padding: "11px 16px",
  borderRadius: 10,
  cursor: "pointer",
};

const dangerButton: CSSProperties = {
  width: "100%",
  border: "1px solid #e0c3bb",
  background: "#fff",
  color: "#d8472b",
  fontWeight: 800,
  fontSize: 13,
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
};
