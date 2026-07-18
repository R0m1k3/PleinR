import { asc, desc, inArray } from "drizzle-orm";
import { PastMeetingGallery } from "@/components/PastMeetingGallery";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { db } from "@/db";
import { meetingRegistrations, pastMeetingPhotos, pastMeetings } from "@/db/schema";
import { splitLines } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export default async function PastMeetingsPage() {
  const [archives, photos] = await Promise.all([
    db.select().from(pastMeetings).orderBy(desc(pastMeetings.eventDate)),
    db.select().from(pastMeetingPhotos).orderBy(asc(pastMeetingPhotos.position), asc(pastMeetingPhotos.id)),
  ]);
  const linkedIds = archives.map((archive) => archive.meetingId).filter((id): id is number => id !== null);
  const linkedRegistrations = linkedIds.length > 0
    ? await db
        .select({ meetingId: meetingRegistrations.meetingId, id: meetingRegistrations.id })
        .from(meetingRegistrations)
        .where(inArray(meetingRegistrations.meetingId, linkedIds))
    : [];

  const photosByPast = new Map<number, typeof photos>();
  for (const photo of photos) {
    photosByPast.set(photo.pastMeetingId, [...(photosByPast.get(photo.pastMeetingId) ?? []), photo]);
  }
  const registrationCounts = new Map<number, number>();
  for (const registration of linkedRegistrations) {
    registrationCounts.set(registration.meetingId, (registrationCounts.get(registration.meetingId) ?? 0) + 1);
  }

  return (
    <div style={{ background: "#F6F2E8", minHeight: "100vh", fontFamily: "'Public Sans',sans-serif", color: "#33291D" }}>
      <SiteHeader active="association" logo />
      <main>
        <section style={{ background: "#13324F", color: "#fff" }}>
          <div className="container" style={{ paddingTop: 58, paddingBottom: 54 }}>
            <div style={{ color: "#E0A63C", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800 }}>Ils y étaient</div>
            <h1 className="font-display" style={{ margin: "10px 0 14px", fontSize: "clamp(38px, 7vw, 62px)", lineHeight: 1 }}>Toutes nos rencontres passées</h1>
            <p style={{ maxWidth: 680, color: "#cfe0ee", fontSize: 17, lineHeight: 1.7, margin: 0 }}>
              Revivez en images les temps forts de Plein R et les moments partagés par les acteurs économiques du Bassin de Pompey.
            </p>
          </div>
        </section>

        <section className="container" style={{ paddingTop: 54, paddingBottom: 80 }}>
          {archives.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 8, padding: 34, color: "#8c8068", textAlign: "center" }}>Aucune rencontre passée publiée pour le moment.</div>
          ) : (
            <div className="grid grid-3" style={{ gap: 20 }}>
              {archives.map((archive) => {
                const archivePhotos = photosByPast.get(archive.id) ?? [];
                const participantCount = archive.meetingId
                  ? registrationCounts.get(archive.meetingId) ?? 0
                  : splitLines(archive.participants ?? "").length;
                return (
                  <article key={archive.id} style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 8, padding: 18 }}>
                    <div style={{ color: "#9a6638", fontSize: 12.5, fontWeight: 800 }}>{formatDate(archive.eventDate)}</div>
                    <h2 className="font-display" style={{ color: "#26201a", fontSize: 23, margin: "7px 0" }}>{archive.title}</h2>
                    {archive.location && <div style={{ color: "#6c6150", fontSize: 13, fontWeight: 700 }}>{archive.location}</div>}
                    {archive.description && <p style={{ color: "#8c8068", fontSize: 13.5, lineHeight: 1.65 }}>{archive.description}</p>}
                    <div style={{ color: "#6c6150", fontSize: 12.5, fontWeight: 800, marginBottom: 12 }}>
                      {participantCount} participant{participantCount > 1 ? "s" : ""} · {archivePhotos.length} photo{archivePhotos.length > 1 ? "s" : ""}
                    </div>
                    <PastMeetingGallery title={archive.title} photos={archivePhotos} />
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
