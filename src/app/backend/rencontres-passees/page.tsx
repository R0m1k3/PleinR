import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { asc, desc, eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { meetingRegistrations, meetings, pastMeetingPhotos, pastMeetings } from "@/db/schema";
import { can } from "@/lib/rbac";
import { splitLines } from "@/lib/site-settings";
import { PastMeetingDialogButton } from "./PastMeetingDialog";
import { emptyDraft, type ArchiveDraft, type MeetingOption } from "./draft";

export const dynamic = "force-dynamic";

function dateValue(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(date);
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

  const meetingOptions: MeetingOption[] = meetingRows.map((meeting) => ({
    id: meeting.id,
    registered: Number(meeting.registered),
    label: `${meeting.title} — ${formatDate(meeting.startsAt)} (${Number(meeting.registered)} inscrit${Number(meeting.registered) > 1 ? "s" : ""})`,
  }));

  const drafts: ArchiveDraft[] = archives.map((archive) => ({
    id: archive.id,
    title: archive.title,
    eventDate: dateValue(archive.eventDate),
    location: archive.location ?? "",
    description: archive.description ?? "",
    participants: archive.participants ?? "",
    meetingId: archive.meetingId ? String(archive.meetingId) : "",
    // `bytes` ne sert qu'aux photos à envoyer : celles déjà en base ne repartent pas.
    photos: (photosByPast.get(archive.id) ?? []).map((photo) => ({
      key: `photo-${photo.id}`,
      id: photo.id,
      imageUrl: photo.imageUrl,
      caption: photo.caption ?? "",
      bytes: 0,
    })),
    refused: archive.meetingId ? refusalsByMeeting.get(archive.meetingId) ?? [] : [],
  }));

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 className="font-display" style={{ margin: "0 0 6px", fontSize: 20, color: "#26201a" }}>Rencontres passées</h2>
            <p style={{ color: "#8c8068", fontSize: 13, margin: 0, maxWidth: 620, lineHeight: 1.6 }}>
              Une fenêtre par rencontre : récit, participants et photos au même endroit. Les trois plus récentes
              apparaissent sur « L&apos;association », toutes sur la page des rencontres passées.
            </p>
          </div>
          <PastMeetingDialogButton draft={emptyDraft()} meetings={meetingOptions} style={primaryButton}>
            Nouvelle rencontre passée
          </PastMeetingDialogButton>
        </div>
      </section>

      <section>
        <div style={sectionTitle}>Archives publiées</div>
        {archives.length === 0 ? (
          <div style={emptyStyle}>Aucune rencontre passée publiée.</div>
        ) : (
          <div className="grid grid-3" style={{ gap: 18 }}>
            {archives.map((archive, index) => {
              const draft = drafts[index];
              const archivePhotos = photosByPast.get(archive.id) ?? [];
              const participantCount = archive.meetingId
                ? meetingOptions.find((option) => option.id === archive.meetingId)?.registered ?? 0
                : splitLines(archive.participants ?? "").length;
              const cover = archivePhotos[0]?.imageUrl;
              return (
                <PastMeetingDialogButton key={archive.id} draft={draft} meetings={meetingOptions} style={cardButton}>
                  <span
                    className={cover ? "pm-card__cover" : "pm-card__cover pm-card__cover--empty"}
                    style={{ display: "block", borderRadius: "10px 10px 0 0", ...(cover ? { backgroundImage: `url(${cover})` } : {}) }}
                  >
                    {archivePhotos.length > 0 && (
                      <span className="pm-card__count">{archivePhotos.length} photo{archivePhotos.length > 1 ? "s" : ""}</span>
                    )}
                  </span>
                  <span className="pm-card__body" style={{ display: "flex" }}>
                    <span style={{ color: "#9a6638", fontSize: 12.5, fontWeight: 800 }}>{formatDate(archive.eventDate)}</span>
                    <span className="font-display pm-card__title" style={{ display: "-webkit-box" }}>{archive.title}</span>
                    {archive.location && <span className="pm-line" style={{ color: "#6c6150", fontSize: 13, fontWeight: 700 }}>{archive.location}</span>}
                    {archive.description && <span className="pm-card__text" style={{ display: "-webkit-box" }}>{archive.description}</span>}
                    <span className="pm-card__meta">
                      <span>{participantCount} participant{participantCount > 1 ? "s" : ""}</span>
                      <span className="pm-card__more">Modifier →</span>
                    </span>
                  </span>
                  {draft.refused.length > 0 && (
                    <span style={{ display: "block", background: "#fbe9e6", color: "#b53a25", fontSize: 12, fontWeight: 700, padding: "8px 14px" }}>
                      Droit à l&apos;image refusé par {draft.refused.length} participant{draft.refused.length > 1 ? "s" : ""}
                    </span>
                  )}
                </PastMeetingDialogButton>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

const panelStyle: CSSProperties = { background: "#fff", border: "1px solid #e6dcc6", borderRadius: 8, padding: 22 };
const sectionTitle: CSSProperties = { fontSize: 12.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9a8d72", fontWeight: 800, marginBottom: 12 };
const primaryButton: CSSProperties = { border: "none", background: "#13324F", color: "#fff", fontWeight: 800, fontSize: 13.5, padding: "11px 16px", borderRadius: 8, cursor: "pointer" };
const cardButton: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: 424,
  textAlign: "left",
  background: "#fff",
  border: "1px solid #e6dcc6",
  borderRadius: 10,
  overflow: "hidden",
  padding: 0,
  cursor: "pointer",
  font: "inherit",
};
const emptyStyle: CSSProperties = { background: "#fff", border: "1px solid #e6dcc6", borderRadius: 8, padding: 24, color: "#8c8068" };
