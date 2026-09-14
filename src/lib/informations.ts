import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { informationReads, informations, users } from "@/db/schema";

/**
 * Lectures du fil d'informations.
 *
 * Ce module vit hors de `backend/actions.ts` parce qu'il a plusieurs appelants
 * qui ne sont pas des actions : le gabarit du back-office (pour le compteur de
 * non-lues de la barre latérale) et les trois pages de l'espace adhérent.
 */

export type FeedItem = {
  id: number;
  title: string;
  body: string;
  imageUrl: string | null;
  pinned: boolean;
  publishedAt: Date | null;
  authorName: string | null;
  unread: boolean;
};

export type AdminItem = {
  id: number;
  title: string;
  body: string;
  imageUrl: string | null;
  status: "draft" | "published";
  pinned: boolean;
  publishedAt: Date | null;
  emailSentAt: Date | null;
  updatedAt: Date;
  authorName: string | null;
  readCount: number;
};

/** Épinglée d'abord, puis la plus récente : l'ordre est le même partout. */
const FEED_ORDER = [desc(informations.pinned), desc(informations.publishedAt), desc(informations.id)];

/**
 * Le fil tel que le voit un adhérent, avec l'état de lecture **avant** la
 * visite : c'est ce qui permet d'afficher les pastilles « Nouveau » sur le
 * rendu même où elles sont marquées comme lues.
 */
export async function getMemberFeed(userId: number, limit?: number): Promise<FeedItem[]> {
  const query = db
    .select({
      id: informations.id,
      title: informations.title,
      body: informations.body,
      imageUrl: informations.imageUrl,
      pinned: informations.pinned,
      publishedAt: informations.publishedAt,
      authorName: users.name,
      readId: informationReads.id,
    })
    .from(informations)
    .leftJoin(users, eq(users.id, informations.authorId))
    .leftJoin(
      informationReads,
      and(eq(informationReads.informationId, informations.id), eq(informationReads.userId, userId)),
    )
    .where(eq(informations.status, "published"))
    .orderBy(...FEED_ORDER);

  const rows = await (limit ? query.limit(limit) : query);
  return rows.map(({ readId, ...row }) => ({ ...row, unread: readId === null }));
}

export async function countPublishedInformations(): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(informations)
    .where(eq(informations.status, "published"));
  return row?.total ?? 0;
}

/** Compteur du badge : publiées moins déjà lues par cet utilisateur. */
export async function unreadInformationCount(userId: number): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(informations)
    .leftJoin(
      informationReads,
      and(eq(informationReads.informationId, informations.id), eq(informationReads.userId, userId)),
    )
    .where(and(eq(informations.status, "published"), isNull(informationReads.id)));
  return row?.total ?? 0;
}

/**
 * Marque comme lues les informations passées. Idempotent : la contrainte
 * d'unicité `(user_id, information_id)` absorbe les visites répétées, un
 * double clic ou deux onglets ouverts.
 */
export async function markInformationsRead(userId: number, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db
    .insert(informationReads)
    .values(ids.map((informationId) => ({ informationId, userId })))
    .onConflictDoNothing();
}

/** Liste du back-office : brouillons compris, avec le nombre de lectures. */
export async function getAdminInformations(): Promise<AdminItem[]> {
  const rows = await db
    .select({
      id: informations.id,
      title: informations.title,
      body: informations.body,
      imageUrl: informations.imageUrl,
      status: informations.status,
      pinned: informations.pinned,
      publishedAt: informations.publishedAt,
      emailSentAt: informations.emailSentAt,
      updatedAt: informations.updatedAt,
      authorName: users.name,
      readCount: sql<number>`(
        select count(*)::int from ${informationReads}
        where ${informationReads.informationId} = ${informations.id}
      )`,
    })
    .from(informations)
    .leftJoin(users, eq(users.id, informations.authorId))
    .orderBy(desc(informations.status), ...FEED_ORDER, desc(informations.updatedAt));
  return rows;
}

export async function getInformation(id: number) {
  const [row] = await db.select().from(informations).where(eq(informations.id, id));
  return row ?? null;
}

/** Nombre de comptes adhérents destinataires : le dénominateur du « lue par ». */
export async function countMemberAccounts(): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, "member"));
  return row?.total ?? 0;
}
