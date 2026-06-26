import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  varchar,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---- Enums ----
export const roleEnum = pgEnum("role", ["admin", "moderator", "editor", "member"]);
export const memberStatusEnum = pgEnum("member_status", ["active", "pending"]);
export const promoStatusEnum = pgEnum("promo_status", [
  "pending",
  "live",
  "expired",
  "rejected",
]);
export const requestStatusEnum = pgEnum("request_status", [
  "new",
  "approved",
  "rejected",
]);

// ---- Categories (métiers) ----
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  label: varchar("label", { length: 120 }).notNull(),
  accent: varchar("accent", { length: 16 }).notNull().default("#E0A63C"),
  tint: varchar("tint", { length: 16 }).notNull().default("#f6efdc"),
  sort: integer("sort").notNull().default(0),
});

// ---- Members (adhérents / businesses) ----
export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 200 }).notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  city: varchar("city", { length: 120 }),
  address: varchar("address", { length: 240 }),
  description: text("description"),
  status: memberStatusEnum("status").notNull().default("pending"),
  highlighted: boolean("highlighted").notNull().default(false),
  logoUrl: text("logo_url"),
  coverUrl: text("cover_url"),
  phone: varchar("phone", { length: 40 }),
  website: varchar("website", { length: 200 }),
  postalCode: varchar("postal_code", { length: 20 }),
  memberSince: integer("member_since"),
  hours: text("hours"),
  tags: text("tags"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Users (admins + member accounts) ----
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 200 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: roleEnum("role").notNull().default("member"),
    memberId: integer("member_id").references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  })
);

// ---- Promotions ----
export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  text: text("text"),
  category: varchar("category", { length: 120 }),
  badge: varchar("badge", { length: 40 }),
  imageUrl: text("image_url"),
  memberId: integer("member_id").references(() => members.id),
  status: promoStatusEnum("status").notNull().default("pending"),
  validUntil: varchar("valid_until", { length: 120 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Membership requests (demandes d'adhésion) ----
export const membershipRequests = pgTable("membership_requests", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 200 }),
  message: text("message"),
  status: requestStatusEnum("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Activity log (activité récente) ----
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  dot: varchar("dot", { length: 16 }).notNull().default("#2C6FB3"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Relations ----
export const membersRelations = relations(members, ({ one, many }) => ({
  category: one(categories, {
    fields: [members.categoryId],
    references: [categories.id],
  }),
  promotions: many(promotions),
}));

export const promotionsRelations = relations(promotions, ({ one }) => ({
  member: one(members, {
    fields: [promotions.memberId],
    references: [members.id],
  }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  member: one(members, {
    fields: [users.memberId],
    references: [members.id],
  }),
}));

export type Category = typeof categories.$inferSelect;
export type Member = typeof members.$inferSelect;
export type User = typeof users.$inferSelect;
export type Promotion = typeof promotions.$inferSelect;
export type MembershipRequest = typeof membershipRequests.$inferSelect;
export type ActivityEntry = typeof activityLog.$inferSelect;
