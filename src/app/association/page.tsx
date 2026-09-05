import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { meetingRegistrations, meetings, pastMeetingPhotos, pastMeetings } from "@/db/schema";
import { JsonLd } from "@/components/JsonLd";
import { PastMeetingGallery } from "@/components/PastMeetingGallery";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import {
  getSiteSettings,
  parseBoardMembers,
  parseParagraphs,
  parsePillars,
  splitLines,
} from "@/lib/site-settings";
import { breadcrumbJsonLd, eventJsonLd, pageMetadata } from "@/lib/seo";
import { publicBaseUrl } from "@/lib/seo-server";

export const dynamic = "force-dynamic";

const ASSOCIATION_TITLE = "Plein R, l'association des entreprises du Bassin de Pompey";

export const metadata: Metadata = {
  ...pageMetadata({
    title: ASSOCIATION_TITLE,
    ogTitle: ASSOCIATION_TITLE,
    description:
      "Plein R fédère commerçants, artisans et entreprises du Bassin de Pompey : mission, équipe, " +
      "prochaines rencontres. Rejoignez le réseau économique local.",
    path: "/association",
  }),
  // Le nom de l'association est déjà dans le titre : pas de suffixe « · Plein R ».
  title: { absolute: ASSOCIATION_TITLE },
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export default async function AssociationPage() {
  const [settings, session, baseUrl] = await Promise.all([getSiteSettings(), auth(), publicBaseUrl()]);
  const now = new Date();
  const memberId = session?.user.memberId ?? null;

  const upcoming = await db
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
    .where(gte(meetings.startsAt, now))
    .groupBy(meetings.id)
    .orderBy(asc(meetings.startsAt));

  const past = await db.select().from(pastMeetings).orderBy(desc(pastMeetings.eventDate)).limit(3);
  const pastIds = past.map((meeting) => meeting.id);
  const linkedMeetingIds = past.map((meeting) => meeting.meetingId).filter((id): id is number => id !== null);
  const [pastPhotos, linkedRegistrations] = await Promise.all([
    pastIds.length > 0
      ? db
          .select()
          .from(pastMeetingPhotos)
          .where(inArray(pastMeetingPhotos.pastMeetingId, pastIds))
          .orderBy(asc(pastMeetingPhotos.position), asc(pastMeetingPhotos.id))
      : [],
    linkedMeetingIds.length > 0
      ? db
          .select({ meetingId: meetingRegistrations.meetingId, id: meetingRegistrations.id })
          .from(meetingRegistrations)
          .where(inArray(meetingRegistrations.meetingId, linkedMeetingIds))
      : [],
  ]);

  const myRegistrations =
    memberId && upcoming.length > 0
      ? await db
          .select({ meetingId: meetingRegistrations.meetingId })
          .from(meetingRegistrations)
          .where(
            and(
              eq(meetingRegistrations.memberId, memberId),
              inArray(
                meetingRegistrations.meetingId,
                upcoming.map((meeting) => meeting.id)
              )
            )
          )
      : [];
  const myMeetingIds = new Set(myRegistrations.map((row) => row.meetingId));
  const photosByPast = new Map<number, typeof pastPhotos>();
  for (const photo of pastPhotos) {
    photosByPast.set(photo.pastMeetingId, [...(photosByPast.get(photo.pastMeetingId) ?? []), photo]);
  }
  const registrationCounts = new Map<number, number>();
  for (const registration of linkedRegistrations) {
    registrationCounts.set(registration.meetingId, (registrationCounts.get(registration.meetingId) ?? 0) + 1);
  }

  const officers = [
    ["Vice-présidence", settings.association_vice_president],
    ["Trésorerie", settings.association_treasurer],
    ["Secrétariat", settings.association_secretary],
  ].filter(([, name]) => name);
  const board = parseBoardMembers(settings.association_board_members);
  const missionParagraphs = parseParagraphs(settings.association_mission);
  const pillars = parsePillars(settings.association_pillars);

  return (
    <div style={{ background: "#F6F2E8", minHeight: "100vh", fontFamily: "'Public Sans',sans-serif", color: "#33291D" }}>
      <SiteHeader active="association" logo />
      <JsonLd
        data={[
          breadcrumbJsonLd(baseUrl, [
            { name: "Accueil", path: "/" },
            { name: "L'association", path: "/association" },
          ]),
          ...upcoming.map((meeting) => eventJsonLd(baseUrl, meeting)),
        ]}
      />

      <main>
        <section className="container" style={{ paddingTop: 34, paddingBottom: 52 }}>
          <div style={{ maxWidth: 900 }}>
            <div style={{ color: "#9a6638", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800, marginBottom: 12 }}>
              Association
            </div>
            <h1 className="font-display" style={{ margin: 0, color: "#26201a", fontSize: "clamp(42px, 8vw, 76px)", lineHeight: 0.94, letterSpacing: "-0.03em" }}>
              {settings.association_name}
            </h1>
            <p style={{ margin: "18px 0 0", maxWidth: 760, color: "#6c6150", fontSize: "clamp(17px, 2vw, 21px)", lineHeight: 1.65 }}>
              {settings.association_intro}
            </p>
          </div>
        </section>

        <section style={{ background: "#13324F", color: "#fff" }}>
          <div className="container" style={{ paddingTop: 44, paddingBottom: 48 }}>
            <div className="grid grid-2" style={{ alignItems: "start" }}>
              <div>
                <div style={{ color: "#E0A63C", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800, marginBottom: 10 }}>
                  Mission
                </div>
                <h2 className="font-display" style={{ margin: 0, fontSize: "clamp(28px, 4vw, 44px)" }}>
                  Réseau, rencontres, réussite locale.
                </h2>
              </div>
              <div>
                {missionParagraphs.map((paragraph, index) => (
                  <p
                    key={index}
                    style={{
                      margin: index === 0 ? 0 : "14px 0 0",
                      color: "#cfe0ee",
                      fontSize: 16,
                      lineHeight: 1.75,
                    }}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>

            {pillars.length > 0 && (
              <>
                <div style={{ color: "#E0A63C", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800, margin: "44px 0 16px" }}>
                  Ce que l&apos;association vous apporte
                </div>
                <div className="pillars-grid">
                  {pillars.map((pillar, index) => (
                    <article key={pillar.title} className="pillar-card">
                      <span className="font-display pillar-card__index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-display pillar-card__title">{pillar.title}</h3>
                      {pillar.description && (
                        <p className="pillar-card__text">{pillar.description}</p>
                      )}
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="container" style={{ paddingTop: 54, paddingBottom: 54 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "end", flexWrap: "wrap", marginBottom: 20 }}>
            <div>
              <div style={{ color: "#9a6638", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800 }}>
                Rencontres
              </div>
              <h2 className="font-display" style={{ margin: "8px 0 0", color: "#26201a", fontSize: 34 }}>
                Prochaines dates
              </h2>
            </div>
            {!session?.user && (
              <Link href="/login" style={{ textDecoration: "none", background: "#9a6638", color: "#fff", borderRadius: 999, padding: "11px 18px", fontWeight: 800 }}>
                Se connecter pour s'inscrire
              </Link>
            )}
          </div>

          {upcoming.length === 0 && (
            <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 14, padding: 24, color: "#8c8068" }}>
              Aucune rencontre programmée pour le moment.
            </div>
          )}

          <div className="grid grid-3" style={{ gap: 18 }}>
            {upcoming.map((meeting) => {
              const registered = Number(meeting.registered);
              const remaining = Math.max(0, meeting.capacity - registered);
              const isRegistered = myMeetingIds.has(meeting.id);
              return (
                <article id={`rencontre-${meeting.id}`} key={meeting.id} className="lift" style={{ background: "#fff", border: isRegistered ? "2px solid #1f8a5b" : "1px solid #e6dcc6", borderRadius: 12, overflow: "hidden", scrollMarginTop: 100 }}>
                  <div style={{ position: "relative", aspectRatio: "16 / 10", background: meeting.imageUrl ? `center/cover no-repeat url(${meeting.imageUrl})` : "repeating-linear-gradient(45deg,#efe9da,#efe9da 12px,#e6ddc9 12px,#e6ddc9 24px)" }}>
                    {isRegistered && (
                      <span style={{ position: "absolute", top: 12, right: 12, display: "inline-flex", alignItems: "center", gap: 6, background: "#1f8a5b", color: "#fff", borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 800, boxShadow: "0 4px 14px rgba(22,72,49,0.28)" }}>
                        ✓ Inscrit
                      </span>
                    )}
                  </div>
                  <div style={{ padding: 18 }}>
                    <div style={{ color: "#9a6638", fontSize: 12.5, fontWeight: 800 }}>
                      {formatDate(meeting.startsAt)} · {formatTime(meeting.startsAt)}
                    </div>
                    <h3 className="font-display" style={{ margin: "7px 0 7px", color: "#26201a", fontSize: 21 }}>
                      {meeting.title}
                    </h3>
                    {meeting.location && <div style={{ fontSize: 13, color: "#6c6150", fontWeight: 700 }}>{meeting.location}</div>}
                    <p style={{ color: "#8c8068", fontSize: 13.5, lineHeight: 1.6, minHeight: 64 }}>
                      {meeting.description}
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#6c6150", fontSize: 12.5, fontWeight: 800, marginBottom: 12 }}>
                      <span>{registered}/{meeting.capacity} inscrits</span>
                      <span>{remaining} place(s)</span>
                    </div>
                    <div style={{ color: "#8c8068", fontSize: 12.5, marginBottom: 10 }}>
                      Jusqu'à {meeting.participantsPerAccount} participant{meeting.participantsPerAccount > 1 ? "s" : ""} par compte
                    </div>
                    <Link
                      href={`/inscription/${meeting.id}`}
                      style={{ display: "block", textAlign: "center", textDecoration: "none", background: remaining <= 0 && !isRegistered ? "#a99c82" : "#13324F", color: "#fff", borderRadius: 8, padding: 11, fontWeight: 800 }}
                    >
                      {isRegistered ? "Modifier mon inscription" : remaining <= 0 ? "Complet" : memberId ? "S'inscrire" : "Connexion et inscription"}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section style={{ background: "#EFE9DA" }}>
          <div className="container" style={{ paddingTop: 54, paddingBottom: 54 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 18, flexWrap: "wrap", marginBottom: 20 }}>
              <div>
                <div style={{ color: "#9a6638", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800 }}>
                  Ils y étaient
                </div>
                <h2 className="font-display" style={{ margin: "8px 0 0", color: "#26201a", fontSize: 34 }}>
                  Nos dernières rencontres
                </h2>
              </div>
              <Link href="/rencontres-passees" style={{ display: "inline-block", background: "#13324F", color: "#fff", borderRadius: 8, padding: "11px 16px", fontSize: 13.5, fontWeight: 800, textDecoration: "none" }}>
                Voir toutes les rencontres passées
              </Link>
            </div>
            {past.length === 0 ? (
              <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 8, padding: 24, color: "#8c8068" }}>
                Aucune rencontre passée publiée pour le moment.
              </div>
            ) : (
              <div className="grid grid-3" style={{ gap: 18 }}>
                {past.map((meeting) => {
                  const photos = photosByPast.get(meeting.id) ?? [];
                  const participantCount = meeting.meetingId
                    ? registrationCounts.get(meeting.meetingId) ?? 0
                    : splitLines(meeting.participants ?? "").length;
                  return (
                    <article key={meeting.id} style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 8, padding: 18 }}>
                      <div style={{ color: "#9a6638", fontSize: 12.5, fontWeight: 800 }}>{formatDate(meeting.eventDate)}</div>
                      <h3 className="font-display" style={{ color: "#26201a", fontSize: 22, margin: "7px 0" }}>{meeting.title}</h3>
                      {meeting.location && <div style={{ color: "#6c6150", fontSize: 13, fontWeight: 700 }}>{meeting.location}</div>}
                      {meeting.description && <p style={{ color: "#8c8068", fontSize: 13.5, lineHeight: 1.65 }}>{meeting.description}</p>}
                      <div style={{ color: "#6c6150", fontSize: 12.5, fontWeight: 800, marginBottom: 12 }}>
                        {participantCount} participant{participantCount > 1 ? "s" : ""} · {photos.length} photo{photos.length > 1 ? "s" : ""}
                      </div>
                      <PastMeetingGallery title={meeting.title} photos={photos} />
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="container" style={{ paddingTop: 54, paddingBottom: 64 }}>
          <div style={{ color: "#9a6638", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800 }}>
            Gouvernance
          </div>
          <h2 className="font-display" style={{ margin: "8px 0 20px", color: "#26201a", fontSize: 34 }}>
            Directoire
          </h2>
          <div className="grid grid-2" style={{ gap: 18 }}>
            <article style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 12, padding: 22 }}>
              {settings.association_president_photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.association_president_photo} alt="" style={{ width: 86, height: 86, objectFit: "cover", borderRadius: "50%", marginBottom: 14 }} />
              )}
              <div style={{ color: "#9a6638", fontSize: 12, fontWeight: 800 }}>{settings.association_president_role}</div>
              <h3 className="font-display" style={{ color: "#26201a", fontSize: 24, margin: "6px 0" }}>
                {settings.association_president || "Présidence à renseigner"}
              </h3>
              {settings.association_president_message && (
                <p style={{ color: "#6c6150", lineHeight: 1.7 }}>{settings.association_president_message}</p>
              )}
            </article>
            <div className="grid" style={{ gap: 12 }}>
              {[...officers.map(([role, name]) => ({ role, name })), ...board].map((person, index) => (
                <article key={`${person.role}-${person.name}-${index}`} style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ color: "#9a6638", fontSize: 12, fontWeight: 800 }}>{person.role}</div>
                  <div className="font-display" style={{ color: "#26201a", fontSize: 19, fontWeight: 800, marginTop: 3 }}>
                    {person.name}
                  </div>
                </article>
              ))}
              {officers.length === 0 && board.length === 0 && (
                <article style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 12, padding: 18, color: "#8c8068" }}>
                  Les membres du directoire seront affichés ici après configuration.
                </article>
              )}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
