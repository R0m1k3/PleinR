import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { mailMessages } from "@/db/schema";
import type { MailKind, MailMessage } from "@/db/schema";
import { sendNow } from "@/lib/mailer";

/**
 * File d'attente d'envoi.
 *
 * Une diffusion à quatre-vingts adhérents ne peut pas partir dans la requête
 * qui l'a déclenchée : la page attendrait quatre-vingts allers-retours. Les
 * messages sont donc écrits en base et vidés par la boucle de fond, sur le
 * modèle de `releaseDuePromotions`.
 *
 * Une ligne par destinataire, jamais de copie partagée : `to_address` est un
 * `varchar` unique, la confidentialité est structurelle.
 *
 * **Les mots de passe temporaires ne passent pas par ici.** Le clair n'existe
 * que dans la portée de l'action qui les émet, et `mail_messages.html` est
 * stocké en base : ils partent en ligne directe (`sendNow`), et seule une
 * trace sans contenu est journalisée.
 */

/** Débit par passage. Gmail bride autour de quelques centaines par jour. */
const DEFAULT_BATCH = Number(process.env.MAIL_RATE_PER_MINUTE ?? 20);

/** Au-delà, le message est abandonné : cinq échecs ne sont pas un incident réseau. */
export const MAX_ATTEMPTS = 5;

/** Un verrou plus vieux que cela vient d'un conteneur mort en plein envoi. */
const STALE_LOCK_MS = 10 * 60_000;

export type QueuedMail = {
  kind: MailKind;
  toAddress: string;
  toName?: string | null;
  subject: string;
  html: string;
  text?: string | null;
  replyTo?: string | null;
  informationId?: number | null;
  meetingId?: number | null;
  memberId?: number | null;
  createdById?: number | null;
};

/** Attente avant la prochaine tentative : 2, 4, 8, 16 minutes. */
export function backoffDelayMs(attempts: number): number {
  const capped = Math.min(Math.max(attempts, 1), MAX_ATTEMPTS);
  return 2 ** capped * 60_000;
}

export function shouldGiveUp(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS;
}

export async function queueMails(mails: QueuedMail[]): Promise<number> {
  if (mails.length === 0) return 0;
  const rows = await db.insert(mailMessages).values(mails).returning({ id: mailMessages.id });
  return rows.length;
}

export async function queueMail(mail: QueuedMail): Promise<number> {
  return queueMails([mail]);
}

/**
 * Journalise un envoi déjà parti, sans son contenu.
 *
 * Sert aux mots de passe temporaires : le journal doit montrer qu'un message
 * est parti, à qui et quand, sans que le corps — donc le mot de passe — ne
 * touche la base.
 */
export async function logSentMail(entry: {
  kind: MailKind;
  toAddress: string;
  subject: string;
  memberId?: number | null;
  createdById?: number | null;
  result: { ok: true } | { ok: false; reason: string };
}) {
  await db.insert(mailMessages).values({
    kind: entry.kind,
    toAddress: entry.toAddress,
    subject: entry.subject,
    html: "",
    memberId: entry.memberId ?? null,
    createdById: entry.createdById ?? null,
    status: entry.result.ok ? "sent" : "failed",
    attempts: 1,
    sentAt: entry.result.ok ? new Date() : null,
    error: entry.result.ok ? null : entry.result.reason.slice(0, 2000),
  });
}

/**
 * Réclame un lot de messages à envoyer.
 *
 * `FOR UPDATE SKIP LOCKED` : deux instances peuvent vider la file en parallèle
 * sans jamais expédier deux fois le même message. `releaseDuePromotions` s'en
 * passe parce que la transition de statut y fait office de verrou ; ici le
 * passage en `sending` doit être exclusif avant l'appel réseau.
 */
async function claimDueMails(limit: number): Promise<MailMessage[]> {
  const stale = new Date(Date.now() - STALE_LOCK_MS);
  // Un conteneur arrêté en plein envoi laisse des lignes en `sending` :
  // on les remet en file avant de servir le lot suivant.
  await db
    .update(mailMessages)
    .set({ status: "queued", lockedAt: null })
    .where(and(eq(mailMessages.status, "sending"), sql`${mailMessages.lockedAt} < ${stale}`));

  const { rows } = await db.execute<MailMessage>(sql`
    update ${mailMessages}
       set status = 'sending', locked_at = now()
     where id in (
       select id from ${mailMessages}
        where status = 'queued' and next_attempt_at <= now()
        order by id
        limit ${limit}
        for update skip locked
     )
    returning *
  `);
  return rows;
}

export type OutboxReport = { sent: number; failed: number };

/** Vide un lot de la file. Ne lève jamais : c'est une boucle de fond. */
export async function processOutbox(limit = DEFAULT_BATCH): Promise<OutboxReport> {
  const report: OutboxReport = { sent: 0, failed: 0 };
  let claimed: MailMessage[] = [];
  try {
    claimed = await claimDueMails(limit);
  } catch (error) {
    console.error("[mail] réclamation :", error);
    return report;
  }

  for (const message of claimed) {
    const result = await sendNow({
      to: message.toAddress,
      toName: message.toName,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
    });

    if (result.ok) {
      report.sent += 1;
      await db
        .update(mailMessages)
        .set({ status: "sent", sentAt: new Date(), provider: result.provider, lockedAt: null, error: null })
        .where(eq(mailMessages.id, message.id));
      continue;
    }

    report.failed += 1;
    const attempts = message.attempts + 1;
    const exhausted = shouldGiveUp(attempts);
    await db
      .update(mailMessages)
      .set({
        status: exhausted ? "failed" : "queued",
        attempts,
        lockedAt: null,
        nextAttemptAt: new Date(Date.now() + backoffDelayMs(attempts)),
        error: result.reason.slice(0, 2000),
      })
      .where(eq(mailMessages.id, message.id));
  }

  return report;
}

// ---- Journal ----

export async function recentMails(limit = 40) {
  return db.select().from(mailMessages).orderBy(desc(mailMessages.id)).limit(limit);
}

export async function mailCountsFor(informationId: number) {
  const rows = await db
    .select({ status: mailMessages.status, total: sql<number>`count(*)::int` })
    .from(mailMessages)
    .where(eq(mailMessages.informationId, informationId))
    .groupBy(mailMessages.status);
  return rows.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.status]: row.total }), {});
}

/** Remet un message échoué en file, immédiatement. */
export async function retryMailMessage(id: number) {
  await db
    .update(mailMessages)
    .set({ status: "queued", attempts: 0, nextAttemptAt: new Date(), lockedAt: null, error: null })
    .where(and(eq(mailMessages.id, id), eq(mailMessages.status, "failed")));
}

/** Annule un message encore en attente ; un message parti ne s'annule pas. */
export async function cancelMailMessage(id: number) {
  await db
    .update(mailMessages)
    .set({ status: "cancelled", lockedAt: null })
    .where(and(eq(mailMessages.id, id), eq(mailMessages.status, "queued")));
}
