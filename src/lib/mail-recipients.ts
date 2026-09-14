import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories, meetingRegistrations, members, users } from "@/db/schema";

/**
 * Qui reçoit quoi.
 *
 * L'adresse retenue est **`members.email`**, l'adresse administrative qui sert
 * aussi d'identifiant de connexion — jamais `members.contact_email`, qui est
 * l'adresse publique de la fiche et peut pointer vers un standard.
 *
 * La partie pure (`dedupeRecipients`) est exportée pour être testée sans base :
 * c'est elle qui garantit qu'un adhérent ne reçoit pas deux fois le même
 * message, et que N destinataires donnent bien N envois.
 */

export type Recipient = { email: string; name: string; memberId: number | null };

export type AudienceKind = "all" | "category" | "members" | "meeting";

export type Audience =
  | { kind: "all" }
  | { kind: "category"; categoryId: number }
  | { kind: "members"; memberIds: number[] }
  | { kind: "meeting"; meetingId: number };

// Volontairement permissif : le rôle de ce contrôle est d'écarter les champs
// vides ou manifestement cassés, pas de réinventer la RFC 5322.
const PLAUSIBLE_EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;

export function isPlausibleEmail(value: string): boolean {
  return PLAUSIBLE_EMAIL.test(String(value ?? "").trim());
}

/**
 * Écarte les adresses vides ou invalides et les doublons, insensiblement à la
 * casse. L'ordre d'origine est conservé : la première occurrence gagne, avec
 * son nom.
 */
export function dedupeRecipients(rows: { email: string | null; name?: string | null; memberId?: number | null }[]): Recipient[] {
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const row of rows) {
    const email = String(row.email ?? "").trim();
    if (!isPlausibleEmail(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ email, name: String(row.name ?? "").trim(), memberId: row.memberId ?? null });
  }
  return out;
}

export async function resolveAudience(audience: Audience): Promise<Recipient[]> {
  if (audience.kind === "meeting") {
    const rows = await db
      .select({ email: meetingRegistrations.attendeeEmail, name: meetingRegistrations.attendeeName, memberId: meetingRegistrations.memberId })
      .from(meetingRegistrations)
      .where(eq(meetingRegistrations.meetingId, audience.meetingId))
      .orderBy(asc(meetingRegistrations.id));
    return dedupeRecipients(rows);
  }

  const base = db
    .select({ email: members.email, name: members.name, memberId: members.id })
    .from(members)
    .$dynamic();

  if (audience.kind === "category") {
    return dedupeRecipients(
      await base
        .where(and(eq(members.status, "active"), eq(members.categoryId, audience.categoryId)))
        .orderBy(asc(members.name)),
    );
  }

  if (audience.kind === "members") {
    if (audience.memberIds.length === 0) return [];
    return dedupeRecipients(await base.where(inArray(members.id, audience.memberIds)).orderBy(asc(members.name)));
  }

  return dedupeRecipients(await base.where(eq(members.status, "active")).orderBy(asc(members.name)));
}

/** Les adhérents actifs, pour la diffusion d'une information. */
export async function activeMemberRecipients(): Promise<Recipient[]> {
  return resolveAudience({ kind: "all" });
}

export type AudienceOption = { value: string; label: string; count: number };

/** Options proposées par le sélecteur de destinataires. */
export async function audienceOptions(): Promise<{ all: number; categories: AudienceOption[] }> {
  const all = (await activeMemberRecipients()).length;
  const rows = await db
    .select({ id: categories.id, label: categories.label, email: members.email, memberId: members.id })
    .from(categories)
    .innerJoin(members, and(eq(members.categoryId, categories.id), eq(members.status, "active")))
    .orderBy(asc(categories.sort), asc(categories.label));

  const grouped = new Map<number, { label: string; rows: { email: string | null; memberId: number }[] }>();
  for (const row of rows) {
    const entry = grouped.get(row.id) ?? { label: row.label, rows: [] };
    entry.rows.push({ email: row.email, memberId: row.memberId });
    grouped.set(row.id, entry);
  }

  return {
    all,
    categories: [...grouped.entries()].map(([id, entry]) => ({
      value: String(id),
      label: entry.label,
      count: dedupeRecipients(entry.rows).length,
    })),
  };
}

/** L'adresse de l'utilisateur courant, pour « m'envoyer un test ». */
export async function selfRecipient(userId: number): Promise<Recipient | null> {
  const [row] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, userId));
  return dedupeRecipients(row ? [{ ...row, memberId: null }] : [])[0] ?? null;
}
