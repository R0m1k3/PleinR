import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  varchar,
  boolean,
  timestamp,
  index,
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
  "suspended",
]);
// Qui a suspendu la promotion : son créateur (l'adhérent) ou l'association.
// Une promotion suspendue par l'association ne peut être réactivée que par elle.
export const promoSuspendedByEnum = pgEnum("promo_suspended_by", ["member", "staff"]);
export const socialNetworkEnum = pgEnum("social_network", ["facebook", "linkedin"]);
export const socialPostStatusEnum = pgEnum("social_post_status", ["posted", "failed"]);
export const requestStatusEnum = pgEnum("request_status", [
  "new",
  "approved",
  "rejected",
]);
export const contactStatusEnum = pgEnum("contact_status", [
  "new",
  "read",
  "archived",
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
  // E-mail administratif : identifiant de connexion à la création, échanges
  // avec l'association. Jamais forcément celui que le commerce veut afficher.
  email: varchar("email", { length: 200 }).notNull(),
  // E-mail public de la fiche ; à vide, la fiche retombe sur `email`.
  contactEmail: varchar("contact_email", { length: 200 }),
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
    // Le mot de passe temporaire n'est plus stocké (ni en clair ni chiffré) :
    // il est montré une seule fois à la création / réinitialisation.
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    // Incrémenté pour invalider les jetons déjà émis (changement ou
    // réinitialisation de mot de passe).
    sessionVersion: integer("session_version").notNull().default(0),
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
  // Réseaux demandés à la soumission. Le choix reste modifiable tant que la
  // promo est « pending » ; la validation le fige ET déclenche la publication.
  shareFacebook: boolean("share_facebook").notNull().default(false),
  shareLinkedin: boolean("share_linkedin").notNull().default(false),
  suspendedBy: promoSuspendedByEnum("suspended_by"),
  suspendedById: integer("suspended_by_id").references(() => users.id, { onDelete: "set null" }),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Publications réseaux sociaux (Facebook / LinkedIn) ----
export const socialPosts = pgTable(
  "social_posts",
  {
    id: serial("id").primaryKey(),
    promotionId: integer("promotion_id")
      .notNull()
      .references(() => promotions.id, { onDelete: "cascade" }),
    network: socialNetworkEnum("network").notNull(),
    status: socialPostStatusEnum("status").notNull(),
    externalId: varchar("external_id", { length: 200 }),
    url: text("url"),
    error: text("error"),
    postedById: integer("posted_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    promoIdx: index("social_posts_promotion_idx").on(t.promotionId),
  })
);

// ---- Comptes réseaux sociaux connectés (OAuth) ----
// Une ligne par réseau. Les secrets sont chiffrés (src/lib/crypto.ts) et ne
// ressortent jamais vers le navigateur.
export const socialAccounts = pgTable("social_accounts", {
  id: serial("id").primaryKey(),
  network: socialNetworkEnum("network").notNull().unique(),
  appId: varchar("app_id", { length: 200 }).notNull(),
  appSecret: text("app_secret").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  // Nul = n'expire pas (jeton de page Facebook).
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  targetId: varchar("target_id", { length: 200 }),
  targetName: varchar("target_name", { length: 200 }),
  connectedById: integer("connected_by_id").references(() => users.id, { onDelete: "set null" }),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  // Dernier contrôle de validité auprès de la plateforme : permet au tableau de
  // bord d'alerter sans refaire un appel réseau à chaque affichage.
  lastCheckAt: timestamp("last_check_at", { withTimezone: true }),
  lastCheckOk: boolean("last_check_ok"),
  lastCheckError: text("last_check_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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

// ---- Contact messages (formulaire de contact) ----
export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 200 }).notNull(),
  subject: varchar("subject", { length: 200 }),
  message: text("message").notNull(),
  status: contactStatusEnum("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Activity log (activité récente) ----
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  dot: varchar("dot", { length: 16 }).notNull().default("#2C6FB3"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Site settings (contenus configurables) ----
export const siteSettings = pgTable("site_settings", {
  key: varchar("key", { length: 120 }).primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Rencontres à venir ----
export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  location: varchar("location", { length: 240 }),
  description: text("description"),
  capacity: integer("capacity").notNull().default(30),
  participantsPerAccount: integer("participants_per_account").notNull().default(1),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const meetingRegistrations = pgTable(
  "meeting_registrations",
  {
    id: serial("id").primaryKey(),
    meetingId: integer("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    memberId: integer("member_id").references(() => members.id, { onDelete: "set null" }),
    attendeeName: varchar("attendee_name", { length: 200 }).notNull(),
    attendeeCompany: varchar("attendee_company", { length: 200 }).notNull().default(""),
    attendeeEmail: varchar("attendee_email", { length: 200 }),
    attendeePhone: varchar("attendee_phone", { length: 40 }),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    imageConsent: boolean("image_consent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    meetingIdx: index("meeting_registrations_meeting_idx").on(t.meetingId),
    memberMeetingIdx: index("meeting_registrations_member_meeting_idx").on(t.memberId, t.meetingId),
  })
);

// ---- Rencontres passées + galerie ----
export const pastMeetings = pgTable("past_meetings", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
  location: varchar("location", { length: 240 }),
  description: text("description"),
  participants: text("participants"),
  meetingId: integer("meeting_id").references(() => meetings.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pastMeetingPhotos = pgTable("past_meeting_photos", {
  id: serial("id").primaryKey(),
  pastMeetingId: integer("past_meeting_id")
    .notNull()
    .references(() => pastMeetings.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  caption: varchar("caption", { length: 200 }),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- RGPD / droit à l'image : historique append-only ----
export const imageConsents = pgTable("image_consents", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  decision: varchar("decision", { length: 20 }).notNull(),
  scopes: text("scopes"),
  signatoryName: varchar("signatory_name", { length: 200 }),
  signaturePng: text("signature_png"),
  consentVersion: varchar("consent_version", { length: 40 }).notNull(),
  ip: varchar("ip", { length: 120 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Relations ----
export const membersRelations = relations(members, ({ one, many }) => ({
  category: one(categories, {
    fields: [members.categoryId],
    references: [categories.id],
  }),
  promotions: many(promotions),
  meetingRegistrations: many(meetingRegistrations),
  imageConsents: many(imageConsents),
}));

export const promotionsRelations = relations(promotions, ({ one, many }) => ({
  member: one(members, {
    fields: [promotions.memberId],
    references: [members.id],
  }),
  socialPosts: many(socialPosts),
}));

export const socialPostsRelations = relations(socialPosts, ({ one }) => ({
  promotion: one(promotions, {
    fields: [socialPosts.promotionId],
    references: [promotions.id],
  }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  member: one(members, {
    fields: [users.memberId],
    references: [members.id],
  }),
}));

export const meetingsRelations = relations(meetings, ({ many }) => ({
  registrations: many(meetingRegistrations),
}));

export const meetingRegistrationsRelations = relations(meetingRegistrations, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingRegistrations.meetingId],
    references: [meetings.id],
  }),
  member: one(members, {
    fields: [meetingRegistrations.memberId],
    references: [members.id],
  }),
}));

export const pastMeetingsRelations = relations(pastMeetings, ({ one, many }) => ({
  linkedMeeting: one(meetings, {
    fields: [pastMeetings.meetingId],
    references: [meetings.id],
  }),
  photos: many(pastMeetingPhotos),
}));

export const pastMeetingPhotosRelations = relations(pastMeetingPhotos, ({ one }) => ({
  pastMeeting: one(pastMeetings, {
    fields: [pastMeetingPhotos.pastMeetingId],
    references: [pastMeetings.id],
  }),
}));

export const imageConsentsRelations = relations(imageConsents, ({ one }) => ({
  member: one(members, {
    fields: [imageConsents.memberId],
    references: [members.id],
  }),
}));

export type Category = typeof categories.$inferSelect;
export type Member = typeof members.$inferSelect;
export type User = typeof users.$inferSelect;
export type Promotion = typeof promotions.$inferSelect;
export type SocialPost = typeof socialPosts.$inferSelect;
export type SocialAccount = typeof socialAccounts.$inferSelect;
export type SocialNetwork = (typeof socialNetworkEnum.enumValues)[number];
export type MembershipRequest = typeof membershipRequests.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type ActivityEntry = typeof activityLog.$inferSelect;
export type SiteSetting = typeof siteSettings.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type MeetingRegistration = typeof meetingRegistrations.$inferSelect;
export type PastMeeting = typeof pastMeetings.$inferSelect;
export type PastMeetingPhoto = typeof pastMeetingPhotos.$inferSelect;
export type ImageConsent = typeof imageConsents.$inferSelect;
