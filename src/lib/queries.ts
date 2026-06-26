import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, members, promotions } from "@/db/schema";

export async function getActiveMembersWithCategory() {
  return db
    .select({
      id: members.id,
      name: members.name,
      description: members.description,
      city: members.city,
      address: members.address,
      categoryLabel: categories.label,
      accent: categories.accent,
    })
    .from(members)
    .leftJoin(categories, eq(members.categoryId, categories.id))
    .where(eq(members.status, "active"))
    .orderBy(asc(members.name));
}

export async function getAllCategories() {
  return db
    .select({ id: categories.id, label: categories.label, accent: categories.accent })
    .from(categories)
    .orderBy(asc(categories.sort));
}

export async function getLiveBadgesByMember() {
  return db
    .select({ memberId: promotions.memberId, badge: promotions.badge })
    .from(promotions)
    .where(eq(promotions.status, "live"));
}

export async function getCategoriesWithCounts(limit = 6) {
  const rows = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      label: categories.label,
      accent: categories.accent,
      tint: categories.tint,
      sort: categories.sort,
      memberCount: count(members.id),
    })
    .from(categories)
    .leftJoin(
      members,
      and(eq(members.categoryId, categories.id), eq(members.status, "active"))
    )
    .groupBy(categories.id)
    .orderBy(categories.sort)
    .limit(limit);
  return rows;
}

export async function getLivePromotions(limit = 6) {
  const rows = await db
    .select({
      id: promotions.id,
      title: promotions.title,
      text: promotions.text,
      category: promotions.category,
      badge: promotions.badge,
      imageUrl: promotions.imageUrl,
      validUntil: promotions.validUntil,
      memberName: members.name,
    })
    .from(promotions)
    .leftJoin(members, eq(promotions.memberId, members.id))
    .where(eq(promotions.status, "live"))
    .orderBy(desc(promotions.createdAt))
    .limit(limit);
  return rows;
}

export async function getPublicMember(id: number) {
  const [m] = await db
    .select({
      id: members.id,
      name: members.name,
      email: members.email,
      description: members.description,
      city: members.city,
      address: members.address,
      status: members.status,
      logoUrl: members.logoUrl,
      coverUrl: members.coverUrl,
      phone: members.phone,
      website: members.website,
      postalCode: members.postalCode,
      memberSince: members.memberSince,
      hours: members.hours,
      tags: members.tags,
      categoryLabel: categories.label,
      accent: categories.accent,
      tint: categories.tint,
    })
    .from(members)
    .leftJoin(categories, eq(members.categoryId, categories.id))
    .where(eq(members.id, id));
  return m ?? null;
}

export async function getMemberLivePromotions(memberId: number) {
  return db
    .select({
      id: promotions.id,
      title: promotions.title,
      text: promotions.text,
      category: promotions.category,
      badge: promotions.badge,
      imageUrl: promotions.imageUrl,
      validUntil: promotions.validUntil,
    })
    .from(promotions)
    .where(and(eq(promotions.memberId, memberId), eq(promotions.status, "live")))
    .orderBy(desc(promotions.createdAt));
}

export async function getHighlightedMembers(limit = 3) {
  const rows = await db
    .select({
      id: members.id,
      name: members.name,
      description: members.description,
      city: members.city,
      address: members.address,
      categoryLabel: categories.label,
      accent: categories.accent,
    })
    .from(members)
    .leftJoin(categories, eq(members.categoryId, categories.id))
    .where(and(eq(members.highlighted, true), eq(members.status, "active")))
    .limit(limit);
  return rows;
}
