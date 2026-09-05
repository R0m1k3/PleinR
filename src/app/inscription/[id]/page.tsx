import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { MeetingRegistrationForm } from "@/components/MeetingRegistrationForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { db } from "@/db";
import { meetingRegistrations, meetings, members } from "@/db/schema";
import { NOINDEX } from "@/lib/seo";

export const dynamic = "force-dynamic";

// Page transactionnelle : rien à indexer, la rencontre est décrite sur /association.
export const metadata: Metadata = {
  title: "Inscription à une rencontre",
  robots: NOINDEX,
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

export default async function MeetingRegistrationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meetingId = Number(id);
  const session = await getSession();
  const now = new Date();

  const [meeting] = Number.isInteger(meetingId)
    ? await db
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
        .where(and(eq(meetings.id, meetingId), gte(meetings.startsAt, now)))
        .groupBy(meetings.id)
    : [];

  const memberId = session?.user.memberId ?? null;
  const [member, existing] = memberId && meeting
    ? await Promise.all([
        db
          .select({ name: members.name, status: members.status })
          .from(members)
          .where(eq(members.id, memberId))
          .then((rows) => rows[0] ?? null),
        db
          .select({
            name: meetingRegistrations.attendeeName,
            imageConsent: meetingRegistrations.imageConsent,
            status: meetingRegistrations.status,
          })
          .from(meetingRegistrations)
          .where(and(eq(meetingRegistrations.meetingId, meeting.id), eq(meetingRegistrations.memberId, memberId)))
          .orderBy(asc(meetingRegistrations.createdAt), asc(meetingRegistrations.id)),
      ])
    : [null, []];

  const registered = meeting ? Number(meeting.registered) : 0;
  const remaining = meeting ? Math.max(0, meeting.capacity - registered) : 0;

  return (
    <div style={{ background: "#F6F2E8", minHeight: "100vh", fontFamily: "'Public Sans',sans-serif", color: "#33291D" }}>
      <SiteHeader active="association" logo />
      <main>
        {!meeting ? (
          <section className="container" style={{ paddingTop: 72, paddingBottom: 96, maxWidth: 760 }}>
            <div style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 8, padding: "32px clamp(22px, 5vw, 38px)" }}>
              <div style={{ color: "#9a6638", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800 }}>Rencontre</div>
              <h1 className="font-display" style={{ color: "#26201a", fontSize: 34, margin: "8px 0 12px" }}>Inscription indisponible</h1>
              <p style={{ color: "#6c6150", lineHeight: 1.7 }}>Cette rencontre n'existe pas ou les inscriptions sont terminées.</p>
              <Link href="/association" style={{ display: "inline-block", marginTop: 12, color: "#9a6638", fontWeight: 800, textDecoration: "none" }}>Voir les prochaines rencontres</Link>
            </div>
          </section>
        ) : (
          <section className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
            <div style={{ gap: 28, alignItems: "start" }} className="meeting-registration-layout">
              <article style={{ background: "#13324F", color: "#fff", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ aspectRatio: "16 / 9", background: meeting.imageUrl ? `center/cover no-repeat url(${meeting.imageUrl})` : "repeating-linear-gradient(45deg,#244965,#244965 12px,#2d5571 12px,#2d5571 24px)" }} />
                <div style={{ padding: 24 }}>
                  <div style={{ color: "#E0A63C", fontSize: 12.5, fontWeight: 800 }}>{formatDate(meeting.startsAt)} · {formatTime(meeting.startsAt)}</div>
                  <h1 className="font-display" style={{ fontSize: 30, margin: "9px 0 8px" }}>{meeting.title}</h1>
                  {meeting.location && <div style={{ color: "#cfe0ee", fontSize: 14, fontWeight: 700 }}>{meeting.location}</div>}
                  {meeting.description && <p style={{ color: "#cfe0ee", lineHeight: 1.7, margin: "16px 0" }}>{meeting.description}</p>}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,.16)", paddingTop: 15, color: "#fff", fontSize: 13.5, fontWeight: 800 }}>
                    {registered}/{meeting.capacity} participants · {remaining} place{remaining > 1 ? "s" : ""} restante{remaining > 1 ? "s" : ""}
                  </div>
                </div>
              </article>

              <section style={{ background: "#fff", border: "1px solid #e6dcc6", borderRadius: 8, padding: "clamp(22px, 4vw, 30px)" }}>
                <div style={{ color: "#9a6638", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800 }}>Inscription membre</div>
                <h2 className="font-display" style={{ color: "#26201a", fontSize: 28, margin: "8px 0 20px" }}>
                  {existing.length > 0 ? "Modifier les participants" : "Inscrire les participants"}
                </h2>
                {!session?.user || !memberId ? (
                  <div>
                    <p style={{ color: "#6c6150", lineHeight: 1.7 }}>Connectez-vous avec votre compte adhérent avant de choisir les participants.</p>
                    <Link href="/login" style={{ display: "inline-block", background: "#13324F", color: "#fff", borderRadius: 8, padding: "13px 20px", fontWeight: 800, textDecoration: "none" }}>Se connecter</Link>
                  </div>
                ) : member?.status !== "active" ? (
                  <div style={{ background: "#fbeede", border: "1px solid #ecd8b8", color: "#9a6638", borderRadius: 8, padding: "14px 16px", lineHeight: 1.6 }}>
                    Votre adhésion doit être active avant de pouvoir vous inscrire aux rencontres.
                  </div>
                ) : remaining === 0 && existing.length === 0 ? (
                  <div style={{ background: "#f1efe7", border: "1px solid #ded8c8", color: "#6c6150", borderRadius: 8, padding: "14px 16px" }}>Cette rencontre est complète.</div>
                ) : (
                  <MeetingRegistrationForm
                    meetingId={meeting.id}
                    defaultName={session.user.name ?? member.name}
                    existing={existing}
                    maxPerAccount={meeting.participantsPerAccount}
                    remaining={remaining}
                  />
                )}
              </section>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
