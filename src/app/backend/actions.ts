"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signOut } from "@/auth";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { CATEGORY_PALETTE } from "@/db/categories";
import { slugify } from "@/lib/slug";
import { autoTags } from "@/lib/tags";
import {
  categories,
  contactMessages,
  imageConsents,
  informations,
  meetingRegistrations,
  meetings,
  members,
  membershipRequests,
  pastMeetingPhotos,
  pastMeetings,
  promotions,
  siteSettings,
  users,
} from "@/db/schema";
import { can, LABEL_TO_ROLE } from "@/lib/rbac";
import {
  SOCIAL_LABELS,
  SOCIAL_NETWORKS,
  type SocialNetwork,
} from "@/lib/social";
import {
  disconnectAccount,
  saveAppCredentials,
  selectTarget,
} from "@/lib/social-accounts";
import { normalizeWebsite } from "@/lib/member-profile";
import { isRangeInvalid } from "@/lib/promo-validity";
import { formatSchedule, isDue, parseScheduleInput } from "@/lib/promo-schedule";
import { publishPromoShares, requestedNetworks } from "@/lib/promo-publish";
import { logActivity } from "@/lib/activity-log";
import {
  MAIL_LABELS,
  MAIL_PROVIDERS,
  checkMailHealth,
  disconnectMailAccount,
  saveOAuthApp,
  saveSmtpAccount,
  setActiveMailProvider,
  isMailConfigured,
} from "@/lib/mail-accounts";
import type { MailProvider } from "@/db/schema";
import { sendNow } from "@/lib/mailer";
import { cancelMailMessage, logSentMail, queueMails, retryMailMessage } from "@/lib/mail-outbox";
import { activeMemberRecipients, resolveAudience, selfRecipient, type Audience } from "@/lib/mail-recipients";
import {
  buildCredentialsEmail,
  buildGeneralEmail,
  buildInformationEmail,
  buildMeetingEmail,
  type GeneralEmailContent,
  type MeetingEmailTexts,
} from "@/lib/email-templates";
import { richTextToPlain } from "@/lib/rich-text";
import { emailBrand, getSiteSettings } from "@/lib/site-settings";
import { siteUrl } from "@/lib/social-accounts";
import { markInformationsRead as markRead } from "@/lib/informations";
import { SITE_SETTING_DEFAULTS } from "@/lib/site-settings";
import type { AppRole } from "@/types/next-auth";



// Mot de passe temporaire lisible (sans caractères ambigus).
// `randomInt` et non `Math.random()` : ce dernier n'est pas cryptographique et
// permet de prédire les mots de passe suivants à partir de quelques tirages.
function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += alphabet[randomInt(alphabet.length)];
  }
  return out;
}

async function requireRole(): Promise<{
  role: AppRole;
  memberId: number | null;
  name: string;
  userId: number | null;
}> {
  const session = await getSession();
  if (!session?.user) throw new Error("Non authentifié");
  const userId = Number(session.user.id);
  return {
    role: session.user.role,
    memberId: session.user.memberId,
    name: session.user.name ?? "Adhérent",
    userId: Number.isFinite(userId) ? userId : null,
  };
}

function asString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function asDate(formData: FormData, key: string) {
  const raw = asString(formData, key);
  const date = raw ? new Date(raw) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error("Date invalide");
  return date;
}

function asNullableString(formData: FormData, key: string) {
  return asString(formData, key) || null;
}

// ~3 Mo de base64, soit environ 2,2 Mo d'image réelle.
const MAX_IMAGE_DATA_URI = 3_000_000;
const IMAGE_DATA_URI = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/;

/**
 * N'accepte qu'une image en data-URI. Une URL http(s) ferait appeler par le
 * serveur une adresse choisie par l'utilisateur (SSRF) au moment de la
 * publication sur les réseaux.
 */
function asImageDataUri(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) return null;
  if (value.length > MAX_IMAGE_DATA_URI) throw new Error("Image trop volumineuse (3 Mo maximum).");
  if (!IMAGE_DATA_URI.test(value)) throw new Error("Format d'image non accepté.");
  return value;
}

/** Date `YYYY-MM-DD` facultative issue d'un `<input type="date">`. */
function asOptionalDate(formData: FormData, key: string): string | null {
  const value = asString(formData, key);
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Date invalide.");
  return value;
}

function revalidatePromoPaths(memberId?: number | null) {
  revalidatePath("/backend/promotions");
  revalidatePath("/backend/espace");
  revalidatePath("/backend/espace/promotions");
  revalidatePath("/backend");
  revalidatePath("/");
  revalidatePath("/annuaire");
  if (memberId) revalidatePath("/adherents/[id]", "page");
}

function readShareTargets(formData: FormData) {
  return {
    shareFacebook: formData.get("shareFacebook") === "on",
    shareLinkedin: formData.get("shareLinkedin") === "on",
  };
}

// ---- Promotion moderation ----
export async function moderatePromo(formData: FormData) {
  const { role, userId, name } = await requireRole();
  if (!can(role, "moderatePromos")) throw new Error("Accès refusé");

  const id = Number(formData.get("id"));
  const action = String(formData.get("action"));
  if (!id) return;

  const [promo] = await db.select().from(promotions).where(eq(promotions.id, id));
  if (!promo) return;

  if (action === "approve") {
    // Le modérateur peut ajuster les réseaux demandés par l'adhérent, mais
    // uniquement ici : après validation le choix est figé.
    const targets = readShareTargets(formData);
    // Le champ est pré-rempli avec la date demandée par l'adhérent : vidé, la
    // promotion part tout de suite ; une échéance déjà passée aussi.
    const publishAt = parseScheduleInput(String(formData.get("publishAt") ?? ""));
    const immediate = isDue(publishAt);

    await db
      .update(promotions)
      .set({
        status: immediate ? "live" : "scheduled",
        publishAt: immediate ? null : publishAt,
        ...targets,
        suspendedBy: null,
        suspendedById: null,
        suspendedAt: null,
      })
      .where(eq(promotions.id, id));

    if (immediate) {
      await logActivity(`Promotion « ${promo.title} » validée et mise en ligne`, "#1f8a5b");
      // Mise en ligne committée avant l'appel réseau : si un réseau répond mal,
      // la promo est quand même publiée sur le site.
      await publishPromoShares(id, requestedNetworks(targets), userId);
    } else {
      // Rien n'est diffusé maintenant : `releaseDuePromotions()` s'en chargera
      // à l'échéance, site et réseaux d'un seul coup.
      await logActivity(
        `Promotion « ${promo.title} » validée, publication programmée ${formatSchedule(publishAt)}`,
        "#9a6638"
      );
    }
  } else if (action === "suspend") {
    // Suspension par l'association : la promotion sort du site public et
    // l'adhérent ne peut pas la remettre en ligne lui-même.
    await db
      .update(promotions)
      .set({ status: "suspended", suspendedBy: "staff", suspendedById: userId, suspendedAt: new Date() })
      .where(eq(promotions.id, id));
    await logActivity(
      `Promotion « ${promo.title} » suspendue par <strong>${name}</strong>`,
      "#d8472b"
    );
  } else if (action === "publish-now") {
    // Raccourci sur une promo programmée : on n'attend pas l'échéance.
    if (promo.status !== "scheduled") return;
    await db
      .update(promotions)
      .set({ status: "live", publishAt: null })
      .where(eq(promotions.id, id));
    await logActivity(`Promotion « ${promo.title} » publiée avant l'heure programmée`, "#1f8a5b");
    await publishPromoShares(id, requestedNetworks(promo), userId);
  } else if (action === "restore") {
    await db
      .update(promotions)
      .set({ status: "live", suspendedBy: null, suspendedById: null, suspendedAt: null })
      .where(eq(promotions.id, id));
    await logActivity(`Promotion « ${promo.title} » remise en ligne`, "#1f8a5b");
  } else if (action === "reject" || action === "remove") {
    await db.delete(promotions).where(eq(promotions.id, id));
  }

  revalidatePromoPaths(promo.memberId);
}

// ---- Member space: suspendre / réactiver sa propre promotion ----
export async function setOwnPromoSuspension(formData: FormData) {
  const { memberId, userId, name } = await requireRole();
  if (!memberId) throw new Error("Aucune fiche adhérent liée à votre compte.");

  const id = Number(formData.get("id"));
  const action = String(formData.get("action"));
  if (!id) return;

  const [promo] = await db
    .select()
    .from(promotions)
    .where(and(eq(promotions.id, id), eq(promotions.memberId, memberId)));
  if (!promo) throw new Error("Promotion introuvable.");

  if (action === "suspend") {
    if (promo.status !== "live") return;
    await db
      .update(promotions)
      .set({ status: "suspended", suspendedBy: "member", suspendedById: userId, suspendedAt: new Date() })
      .where(eq(promotions.id, id));
    await logActivity(`<strong>${name}</strong> a suspendu sa promotion « ${promo.title} »`, "#9a6638");
  } else if (action === "restore") {
    if (promo.status !== "suspended") return;
    // Une suspension décidée par l'association ne se lève que par elle.
    if (promo.suspendedBy === "staff") {
      throw new Error(
        "Cette promotion a été suspendue par l'association : contactez-la pour la remettre en ligne."
      );
    }
    await db
      .update(promotions)
      .set({ status: "live", suspendedBy: null, suspendedById: null, suspendedAt: null })
      .where(eq(promotions.id, id));
    await logActivity(`<strong>${name}</strong> a réactivé sa promotion « ${promo.title} »`, "#1f8a5b");
  }

  revalidatePromoPaths(memberId);
}

// ---- Rattrapage d'une publication en échec ----
// Ne permet pas d'élargir la diffusion : uniquement de retenter un réseau déjà
// choisi avant la validation, et qui n'est pas encore passé.
export async function retryPromoShare(formData: FormData) {
  const { role, userId } = await requireRole();
  if (!can(role, "publishSocial")) throw new Error("Accès refusé");

  const id = Number(formData.get("id"));
  const network = String(formData.get("network")) as SocialNetwork;
  if (!id || !SOCIAL_NETWORKS.includes(network)) return;

  const [promo] = await db.select().from(promotions).where(eq(promotions.id, id));
  if (!promo) throw new Error("Promotion introuvable.");
  if (promo.status !== "live") {
    throw new Error("Seule une promotion en ligne peut être publiée sur les réseaux.");
  }
  if (!requestedNetworks(promo).includes(network)) {
    throw new Error(
      `${SOCIAL_LABELS[network]} n'a pas été demandé pour cette promotion : le choix est figé depuis sa validation.`
    );
  }

  await publishPromoShares(id, [network], userId);
  revalidatePath("/backend/promotions");
  revalidatePath("/backend/espace");
  revalidatePath("/backend/espace/promotions");
}

// ---- Member space: choisir les réseaux tant que la promo est en attente ----
export async function setOwnPromoShareTargets(formData: FormData) {
  const { memberId } = await requireRole();
  if (!memberId) throw new Error("Aucune fiche adhérent liée à votre compte.");

  const id = Number(formData.get("id"));
  if (!id) return;

  const [promo] = await db
    .select({ status: promotions.status })
    .from(promotions)
    .where(and(eq(promotions.id, id), eq(promotions.memberId, memberId)));
  if (!promo) throw new Error("Promotion introuvable.");
  if (promo.status !== "pending") {
    throw new Error("La diffusion n'est plus modifiable une fois la promotion validée.");
  }

  await db.update(promotions).set(readShareTargets(formData)).where(eq(promotions.id, id));
  revalidatePath("/backend/espace");
  revalidatePath("/backend/espace/promotions");
  revalidatePath("/backend/promotions");
}

// ---- Member space: publish a promotion ----
export async function publishPromo(formData: FormData) {
  const { memberId, name } = await requireRole();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const text = String(formData.get("text") ?? "").slice(0, 240);
  const category = String(formData.get("category") ?? "");
  const badge = String(formData.get("badge") ?? "").trim() || null;
  const startsOn = asOptionalDate(formData, "startsOn");
  const endsOn = asOptionalDate(formData, "endsOn");
  if (isRangeInvalid({ startsOn, endsOn })) {
    throw new Error("La date de fin doit être postérieure à la date de début.");
  }
  const imageUrl = asImageDataUri(formData, "imageUrl");
  // Date souhaitée de mise en ligne. Elle n'engage rien : le modérateur la voit
  // et peut la garder, la déplacer ou la vider dans le formulaire « Valider ».
  const publishAt = parseScheduleInput(String(formData.get("publishAt") ?? ""));

  // Réseaux souhaités : rien n'est publié ici, la diffusion attend la validation.
  await db.insert(promotions).values({
    title,
    text,
    category,
    badge,
    imageUrl,
    memberId: memberId ?? null,
    status: "pending",
    startsOn,
    endsOn,
    publishAt,
    ...readShareTargets(formData),
  });

  await logActivity(`<strong>${name}</strong> a soumis une promotion « ${title} »`, "#E0A63C");

  revalidatePath("/backend/espace");
  revalidatePath("/backend/espace/promotions");
  revalidatePath("/backend");
  revalidatePath("/backend/promotions");
}

// ---- Members CRUD ----
/**
 * Identifiants d'un compte qui vient d'être créé ou réinitialisé.
 *
 * Le mot de passe temporaire n'est **jamais stocké** : il n'existe qu'en
 * mémoire le temps de la réponse et n'est montré qu'une seule fois, à l'écran
 * qui a déclenché l'action. Un export de la base ne peut donc plus révéler de
 * mot de passe utilisable.
 */
export type IssuedCredentials = {
  email: string;
  tempPassword: string;
  /** Faux si aucune boîte n'est configurée ou si le fournisseur a refusé. */
  mailed: boolean;
  mailError?: string;
};

/**
 * Envoie les identifiants au destinataire, tout de suite.
 *
 * **Jamais par la file d'attente** : `mail_messages.html` est stocké en base,
 * et le mot de passe temporaire ne doit exister que le temps de l'action. Seule
 * une trace sans contenu est journalisée.
 *
 * L'envoi est un plus, jamais un point de rupture : en cas d'échec, le mot de
 * passe reste affiché à l'écran comme avant, et l'appelant en est informé.
 */
async function deliverCredentials(
  input: { name: string; email: string; tempPassword: string; intro: string },
  actorId: number | null
): Promise<{ mailed: boolean; mailError?: string }> {
  try {
    const settings = await getSiteSettings();
    const { subject, html } = buildCredentialsEmail(
      { name: input.name, email: input.email, tempPassword: input.tempPassword, intro: input.intro },
      await siteUrl(),
      emailBrand(settings)
    );
    const result = await sendNow({
      to: input.email,
      toName: input.name,
      subject,
      html,
      replyTo: settings.association_email || null,
    });
    await logSentMail({
      kind: "credentials",
      toAddress: input.email,
      subject,
      createdById: actorId,
      result: result.ok ? { ok: true } : { ok: false, reason: result.reason },
    });
    return result.ok ? { mailed: true } : { mailed: false, mailError: result.reason };
  } catch (error) {
    // Un envoi raté ne doit jamais faire échouer la création du compte.
    return { mailed: false, mailError: error instanceof Error ? error.message : "Envoi impossible" };
  }
}

export type CreatedMemberAccount = IssuedCredentials & { memberId: number };

/**
 * Échec **attendu** d'une action : e-mail déjà pris, champ manquant…
 *
 * Il est renvoyé et non `throw` : une exception levée dans une server action
 * est masquée par Next en production (message remplacé par un digest) et fait
 * tomber la page entière sur « Application error ». Le `throw` reste réservé
 * aux violations d'accès, qui ne doivent pas s'expliquer à l'utilisateur.
 */
export type ActionError = { error: string };

/**
 * Tags à enregistrer : la saisie si elle existe, sinon les suggestions déduites
 * du métier, de la commune et de la description (`autoTags`).
 */
async function resolveMemberTags(
  formTags: FormDataEntryValue | null,
  input: { categoryId: number | null; city: string | null; description: string | null }
): Promise<string | null> {
  const [category] = input.categoryId
    ? await db
        .select({ slug: categories.slug, label: categories.label })
        .from(categories)
        .where(eq(categories.id, input.categoryId))
    : [];
  return autoTags(String(formTags ?? ""), {
    categorySlug: category?.slug,
    categoryLabel: category?.label,
    city: input.city,
    description: input.description,
  });
}

export async function addMember(
  formData: FormData
): Promise<CreatedMemberAccount | ActionError | undefined> {
  const { role, userId } = await requireRole();
  if (!can(role, "manageMembers")) throw new Error("Accès refusé");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return undefined;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "L'e-mail est requis pour créer le compte de l'adhérent." };
  const categoryId = formData.get("categoryId") ? Number(formData.get("categoryId")) : null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const status = (String(formData.get("status") ?? "pending") as "active" | "pending");

  // Un seul compte par e-mail.
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    return { error: `Un compte existe déjà avec l'e-mail ${email}.` };
  }

  const tags = await resolveMemberTags(null, { categoryId, city, description: null });
  const [newMember] = await db
    .insert(members)
    .values({ name, email, categoryId, city, status, tags })
    .returning({ id: members.id });

  // Compte de connexion adhérent avec mot de passe temporaire à changer.
  const tempPassword = generateTempPassword();
  await db.insert(users).values({
    name,
    email,
    role: "member",
    memberId: newMember.id,
    passwordHash: await bcrypt.hash(tempPassword, 10),
    mustChangePassword: true,
  });

  await logActivity(`Nouvel adhérent ajouté : <strong>${name}</strong>`, "#2C6FB3");

  const delivery = await deliverCredentials(
    { name, email, tempPassword, intro: "Votre compte adhérent Plein R est ouvert. Voici de quoi vous connecter à votre espace : fiche publique, promotions et informations de l'association." },
    userId
  );

  revalidatePath("/backend/adherents");
  revalidatePath("/backend");
  revalidatePath("/");
  return { memberId: newMember.id, email, tempPassword, ...delivery };
}

// Crée des comptes de connexion pour les adhérents existants qui n'en ont pas
// encore (ceux ajoutés avant l'arrivée des comptes adhérent). Chaque compte
// reçoit un mot de passe temporaire à changer à la première connexion. Les
// identifiants sont renvoyés pour un affichage unique : rien n'est conservé.
export async function createMissingMemberAccounts(): Promise<(IssuedCredentials & { name: string })[]> {
  const { role, userId: actorId } = await requireRole();
  if (!can(role, "manageMembers")) throw new Error("Accès refusé");

  const allMembers = await db
    .select({ id: members.id, name: members.name, email: members.email })
    .from(members);
  const allUsers = await db
    .select({ email: users.email, memberId: users.memberId })
    .from(users);

  const takenEmails = new Set(allUsers.map((u) => u.email.toLowerCase()));
  const linkedMemberIds = new Set(allUsers.map((u) => u.memberId).filter((x): x is number => x != null));

  const created: (IssuedCredentials & { name: string })[] = [];
  for (const m of allMembers) {
    if (linkedMemberIds.has(m.id)) continue;
    const email = (m.email ?? "").trim().toLowerCase();
    if (!email || takenEmails.has(email)) continue; // pas d'e-mail ou déjà pris : on saute

    const tempPassword = generateTempPassword();
    await db.insert(users).values({
      name: m.name,
      email,
      role: "member",
      memberId: m.id,
      passwordHash: await bcrypt.hash(tempPassword, 10),
      mustChangePassword: true,
    });
    takenEmails.add(email);
    const delivery = await deliverCredentials(
      { name: m.name, email, tempPassword, intro: "Votre compte adhérent Plein R est ouvert. Voici de quoi vous connecter à votre espace : fiche publique, promotions et informations de l'association." },
      actorId
    );
    created.push({ name: m.name, email, tempPassword, ...delivery });
  }

  if (created.length > 0) {
    await logActivity(`${created.length} compte(s) adhérent créé(s) pour les fiches existantes`, "#2C6FB3");
  }
  revalidatePath("/backend/adherents");
  return created;
}

// Réinitialise le mot de passe d'un adhérent : le nouveau mot de passe
// temporaire est renvoyé pour un affichage unique, puis oublié.
export async function resetMemberPassword(formData: FormData): Promise<IssuedCredentials | undefined> {
  const { role, userId } = await requireRole();
  if (!can(role, "manageMembers")) throw new Error("Accès refusé");

  const memberId = Number(formData.get("memberId"));
  if (!memberId) return undefined;

  const [u] = await db.select().from(users).where(eq(users.memberId, memberId));
  if (!u) throw new Error("Aucun compte de connexion lié à cet adhérent.");

  const tempPassword = generateTempPassword();
  await db
    .update(users)
    .set({
      passwordHash: await bcrypt.hash(tempPassword, 10),
      mustChangePassword: true,
      // Coupe les sessions ouvertes avec l'ancien mot de passe.
      sessionVersion: (u.sessionVersion ?? 0) + 1,
    })
    .where(eq(users.id, u.id));

  const delivery = await deliverCredentials(
    { name: u.name, email: u.email, tempPassword, intro: "Le mot de passe de votre compte Plein R vient d'être réinitialisé par l'association. Vos sessions ouvertes ont été fermées." },
    userId
  );

  revalidatePath(`/backend/adherents/${memberId}`);
  return { email: u.email, tempPassword, ...delivery };
}

export async function updateMember(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMembers")) throw new Error("Accès refusé");

  const id = Number(formData.get("id"));
  if (!id) return;

  const categoryId = formData.get("categoryId") ? Number(formData.get("categoryId")) : null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const tags = await resolveMemberTags(formData.get("tags"), { categoryId, city, description });

  await db
    .update(members)
    .set({
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      contactEmail: String(formData.get("contactEmail") ?? "").trim().toLowerCase() || null,
      contactFirstName: String(formData.get("contactFirstName") ?? "").trim() || null,
      contactLastName: String(formData.get("contactLastName") ?? "").trim() || null,
      contactPhone: String(formData.get("contactPhone") ?? "").trim() || null,
      categoryId,
      city,
      address: String(formData.get("address") ?? "").trim() || null,
      description,
      postalCode: String(formData.get("postalCode") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      website: normalizeWebsite(String(formData.get("website") ?? "")),
      memberSince: formData.get("memberSince") ? Number(formData.get("memberSince")) : null,
      coverUrl: String(formData.get("coverUrl") ?? "").trim() || null,
      logoUrl: String(formData.get("logoUrl") ?? "").trim() || null,
      tags,
      hours: String(formData.get("hours") ?? "").trim() || null,
      status: String(formData.get("status") ?? "pending") as "active" | "pending",
    })
    .where(eq(members.id, id));

  revalidatePath("/backend/adherents");
  revalidatePath("/adherents/[id]", "page");
  revalidatePath("/annuaire");
  revalidatePath("/");
}

export async function deleteMember(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMembers")) throw new Error("Accès refusé");
  const id = Number(formData.get("id"));
  if (!id) return;
  // Remove dependent rows first to satisfy foreign-key constraints:
  // delete the member's promotions and detach any linked user account.
  await db.transaction(async (tx) => {
    await tx.delete(promotions).where(eq(promotions.memberId, id));
    await tx.update(users).set({ memberId: null }).where(eq(users.memberId, id));
    await tx.delete(members).where(eq(members.id, id));
  });
  revalidatePath("/backend/adherents");
  revalidatePath("/");
}

// ---- Admins ----
export async function inviteAdmin(
  formData: FormData
): Promise<IssuedCredentials | ActionError | undefined> {
  const { role, userId } = await requireRole();
  if (!can(role, "manageAdmins")) throw new Error("Accès refusé");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return undefined;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return undefined;
  const roleLabel = String(formData.get("role") ?? "Administrateur");
  const newRole: AppRole = LABEL_TO_ROLE[roleLabel] ?? "editor";

  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length > 0) return { error: `Un compte existe déjà avec l'e-mail ${email}.` };

  // Mot de passe temporaire montré une seule fois à l'inviteur, à changer à
  // la première connexion. Auparavant il n'était ni conservé ni affiché :
  // l'invité ne pouvait pas se connecter.
  const tempPassword = generateTempPassword();
  await db.insert(users).values({
    name,
    email,
    role: newRole,
    passwordHash: await bcrypt.hash(tempPassword, 10),
    mustChangePassword: true,
  });

  const delivery = await deliverCredentials(
    { name, email, tempPassword, intro: "Un accès à l'administration du site Plein R vient d'être ouvert à votre nom. Voici de quoi vous connecter." },
    userId
  );

  await logActivity(`<strong>${name}</strong> a été invité comme ${roleLabel}`, "#2C6FB3");
  revalidatePath("/backend/administrateurs");
  return { email, tempPassword, ...delivery };
}

export async function removeAdmin(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageAdmins")) throw new Error("Accès refusé");
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/backend/administrateurs");
}

// ---- Categories ----
export async function addCategory(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageCategories")) throw new Error("Accès refusé");

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;

  let base = slugify(label) || "categorie";
  let slug = base;
  let n = 2;
  while ((await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug))).length > 0) {
    slug = `${base}-${n++}`;
  }

  const existing = await db.select({ id: categories.id }).from(categories);
  const palette = CATEGORY_PALETTE[existing.length % CATEGORY_PALETTE.length];
  const [{ max } = { max: 0 }] = await db
    .select({ max: sql<number>`coalesce(max(${categories.sort}), 0)` })
    .from(categories);

  await db.insert(categories).values({
    slug,
    label,
    accent: palette.accent,
    tint: palette.tint,
    sort: Number(max) + 1,
  });

  revalidatePath("/backend/categories");
  revalidatePath("/annuaire");
}

export async function renameCategory(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageCategories")) throw new Error("Accès refusé");
  const id = Number(formData.get("id"));
  const label = String(formData.get("label") ?? "").trim();
  if (!id || !label) return;
  await db.update(categories).set({ label }).where(eq(categories.id, id));
  revalidatePath("/backend/categories");
  revalidatePath("/annuaire");
}

export async function deleteCategory(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageCategories")) throw new Error("Accès refusé");
  const id = Number(formData.get("id"));
  if (!id) return;
  // Detach members from this category, then delete it (avoids FK violation).
  await db.transaction(async (tx) => {
    await tx.update(members).set({ categoryId: null }).where(eq(members.categoryId, id));
    await tx.delete(categories).where(eq(categories.id, id));
  });
  revalidatePath("/backend/categories");
  revalidatePath("/backend/adherents");
  revalidatePath("/annuaire");
}

// ---- Rencontres ----
export async function createMeeting(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMeetings")) throw new Error("Accès refusé");

  const title = asString(formData, "title");
  if (!title) return;
  await db.insert(meetings).values({
    title,
    startsAt: asDate(formData, "startsAt"),
    location: asNullableString(formData, "location"),
    description: asNullableString(formData, "description"),
    capacity: Math.min(100000, Math.max(1, Number(formData.get("capacity") ?? 30) || 30)),
    participantsPerAccount: Math.min(100, Math.max(1, Number(formData.get("participantsPerAccount") ?? 1) || 1)),
    imageUrl: asNullableString(formData, "imageUrl"),
  });
  await logActivity(`Rencontre ajoutée : <strong>${title}</strong>`, "#2C6FB3");
  revalidatePath("/backend/rencontres");
  revalidatePath("/backend/inscriptions");
  revalidatePath("/association");
}

export async function updateMeeting(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMeetings")) throw new Error("Accès refusé");

  const id = Number(formData.get("id"));
  const title = asString(formData, "title");
  if (!id || !title) return;
  await db
    .update(meetings)
    .set({
      title,
      startsAt: asDate(formData, "startsAt"),
      location: asNullableString(formData, "location"),
      description: asNullableString(formData, "description"),
      capacity: Math.min(100000, Math.max(1, Number(formData.get("capacity") ?? 30) || 30)),
      participantsPerAccount: Math.min(100, Math.max(1, Number(formData.get("participantsPerAccount") ?? 1) || 1)),
      imageUrl: asNullableString(formData, "imageUrl"),
    })
    .where(eq(meetings.id, id));
  revalidatePath("/backend/rencontres");
  revalidatePath("/backend/inscriptions");
  revalidatePath("/association");
}

export async function deleteMeeting(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMeetings")) throw new Error("Accès refusé");
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.delete(meetings).where(eq(meetings.id, id));
  revalidatePath("/backend/rencontres");
  revalidatePath("/backend/inscriptions");
  revalidatePath("/association");
}

export type MeetingRegistrationState = {
  status: "idle" | "success" | "error";
  message: string;
  registrationCount?: number;
};

export async function saveMeetingRegistration(
  _previousState: MeetingRegistrationState,
  formData: FormData,
): Promise<MeetingRegistrationState> {
  const session = await getSession();
  if (!session?.user?.memberId) {
    return { status: "error", message: "Connectez-vous avec un compte adhérent pour vous inscrire." };
  }
  const memberId = session.user.memberId;
  const meetingId = Number(formData.get("meetingId"));
  if (!meetingId) return { status: "error", message: "Rencontre introuvable." };

  try {
    if (asString(formData, "intent") === "cancel") {
      await db
        .delete(meetingRegistrations)
        .where(and(eq(meetingRegistrations.meetingId, meetingId), eq(meetingRegistrations.memberId, memberId)));
      revalidateMeetingPaths(meetingId);
      return { status: "success", message: "Votre inscription a été annulée.", registrationCount: 0 };
    }

    const participantCount = Number(formData.get("participantCount"));
    if (!Number.isInteger(participantCount) || participantCount < 1 || participantCount > 100) {
      return { status: "error", message: "Ajoutez au moins un participant." };
    }

    const participants = Array.from({ length: participantCount }, (_, index) => ({
      name: asString(formData, `participantName-${index}`),
      imageConsent: formData.get(`imageConsent-${index}`) === "on",
    }));
    if (participants.some((participant) => !participant.name || participant.name.length > 200)) {
      return { status: "error", message: "Renseignez le nom et le prénom de chaque participant." };
    }
    const normalizedNames = participants.map((participant) => participant.name.toLocaleLowerCase("fr-FR"));
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      return { status: "error", message: "Chaque participant doit avoir un nom différent." };
    }
    if (formData.get("attestation") !== "on") {
      return { status: "error", message: "Vous devez confirmer avoir recueilli le choix de chaque participant." };
    }

    await db.transaction(async (tx) => {
      await tx.execute(sql`select ${meetings.id} from ${meetings} where ${meetings.id} = ${meetingId} for update`);
      const [meeting] = await tx.select().from(meetings).where(eq(meetings.id, meetingId));
      if (!meeting) throw new Error("Rencontre introuvable.");
      if (meeting.startsAt.getTime() < Date.now()) throw new Error("Cette rencontre est passée.");
      if (participants.length > meeting.participantsPerAccount) {
        throw new Error(`Cette rencontre autorise ${meeting.participantsPerAccount} participant(s) maximum par compte.`);
      }

      const [member] = await tx
        .select({ name: members.name, email: members.email, phone: members.phone, status: members.status })
        .from(members)
        .where(eq(members.id, memberId));
      if (!member || member.status !== "active") {
        throw new Error("Votre adhésion doit être active pour vous inscrire.");
      }

      const [{ total } = { total: 0 }] = await tx
        .select({ total: sql<number>`count(*)` })
        .from(meetingRegistrations)
        .where(
          and(
            eq(meetingRegistrations.meetingId, meetingId),
            sql`${meetingRegistrations.memberId} is distinct from ${memberId}`,
          ),
        );
      if (Number(total) + participants.length > meeting.capacity) {
        throw new Error("Il ne reste pas assez de places pour tous les participants.");
      }

      await tx
        .delete(meetingRegistrations)
        .where(and(eq(meetingRegistrations.meetingId, meetingId), eq(meetingRegistrations.memberId, memberId)));
      await tx.insert(meetingRegistrations).values(
        participants.map((participant) => ({
          meetingId,
          memberId,
          attendeeName: participant.name,
          attendeeCompany: member.name,
          attendeeEmail: member.email ?? session.user.email ?? null,
          attendeePhone: member.phone,
          status: "pending",
          imageConsent: participant.imageConsent,
        })),
      );
    });

    revalidateMeetingPaths(meetingId);
    return {
      status: "success",
      message: `Inscription enregistrée pour ${participants.length} participant${participants.length > 1 ? "s" : ""}.`,
      registrationCount: participants.length,
    };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Inscription impossible." };
  }
}

function revalidateMeetingPaths(meetingId?: number) {
  revalidatePath("/association");
  revalidatePath("/backend/rencontres");
  revalidatePath("/backend/inscriptions");
  revalidatePath("/backend/rencontres-passees");
  revalidatePath("/backend/espace");
  revalidatePath("/backend/espace/promotions");
  revalidatePath("/rencontres-passees");
  if (meetingId) revalidatePath(`/inscription/${meetingId}`);
}

export async function updateMeetingRegistration(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMeetings")) throw new Error("Accès refusé");
  const id = Number(formData.get("id"));
  const attendeeName = asString(formData, "attendeeName");
  const status = asString(formData, "status");
  if (!id || !attendeeName || !["pending", "confirmed"].includes(status)) return;
  const [registration] = await db
    .update(meetingRegistrations)
    .set({
      attendeeName,
      attendeeCompany: asString(formData, "attendeeCompany"),
      attendeeEmail: asNullableString(formData, "attendeeEmail"),
      attendeePhone: asNullableString(formData, "attendeePhone"),
      status,
      imageConsent: formData.get("imageConsent") === "on",
    })
    .where(eq(meetingRegistrations.id, id))
    .returning({ meetingId: meetingRegistrations.meetingId });
  revalidateMeetingPaths(registration?.meetingId);
}

export async function confirmMeetingRegistration(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMeetings")) throw new Error("Accès refusé");
  const id = Number(formData.get("id"));
  if (!id) return;
  const [registration] = await db
    .update(meetingRegistrations)
    .set({ status: "confirmed" })
    .where(eq(meetingRegistrations.id, id))
    .returning({ meetingId: meetingRegistrations.meetingId });
  revalidateMeetingPaths(registration?.meetingId);
}

export async function deleteMeetingRegistration(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMeetings")) throw new Error("Accès refusé");
  const id = Number(formData.get("id"));
  if (!id) return;
  const [registration] = await db
    .delete(meetingRegistrations)
    .where(eq(meetingRegistrations.id, id))
    .returning({ meetingId: meetingRegistrations.meetingId });
  revalidateMeetingPaths(registration?.meetingId);
}

export async function createPastMeeting(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMeetings")) throw new Error("Accès refusé");
  const title = asString(formData, "title");
  if (!title) return;
  await db.insert(pastMeetings).values({
    title,
    eventDate: asDate(formData, "eventDate"),
    location: asNullableString(formData, "location"),
    description: asNullableString(formData, "description"),
    participants: asNullableString(formData, "participants"),
    meetingId: formData.get("meetingId") ? Number(formData.get("meetingId")) : null,
  });
  revalidatePath("/backend/rencontres");
  revalidatePath("/association");
  revalidatePath("/backend/rencontres-passees");
  revalidatePath("/rencontres-passees");
}

export async function updatePastMeeting(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMeetings")) throw new Error("Accès refusé");
  const id = Number(formData.get("id"));
  const title = asString(formData, "title");
  if (!id || !title) return;
  await db
    .update(pastMeetings)
    .set({
      title,
      eventDate: asDate(formData, "eventDate"),
      location: asNullableString(formData, "location"),
      description: asNullableString(formData, "description"),
      participants: asNullableString(formData, "participants"),
      meetingId: formData.get("meetingId") ? Number(formData.get("meetingId")) : null,
    })
    .where(eq(pastMeetings.id, id));
  revalidatePath("/backend/rencontres");
  revalidatePath("/association");
  revalidatePath("/backend/rencontres-passees");
  revalidatePath("/rencontres-passees");
}

export async function deletePastMeeting(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMeetings")) throw new Error("Accès refusé");
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.delete(pastMeetings).where(eq(pastMeetings.id, id));
  revalidatePath("/backend/rencontres");
  revalidatePath("/association");
  revalidatePath("/backend/rencontres-passees");
  revalidatePath("/rencontres-passees");
}

export async function addPastMeetingPhoto(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMeetings")) throw new Error("Accès refusé");
  const pastMeetingId = Number(formData.get("pastMeetingId"));
  const imageUrl = asString(formData, "imageUrl");
  if (!pastMeetingId || !imageUrl) return;
  const [{ max } = { max: 0 }] = await db
    .select({ max: sql<number>`coalesce(max(${pastMeetingPhotos.position}), 0)` })
    .from(pastMeetingPhotos)
    .where(eq(pastMeetingPhotos.pastMeetingId, pastMeetingId));
  await db.insert(pastMeetingPhotos).values({
    pastMeetingId,
    imageUrl,
    caption: asNullableString(formData, "caption"),
    position: Number(max) + 1,
  });
  revalidatePath("/backend/rencontres");
  revalidatePath("/association");
  revalidatePath("/backend/rencontres-passees");
  revalidatePath("/rencontres-passees");
}

export async function deletePastMeetingPhoto(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMeetings")) throw new Error("Accès refusé");
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.delete(pastMeetingPhotos).where(eq(pastMeetingPhotos.id, id));
  revalidatePath("/backend/rencontres");
  revalidatePath("/association");
  revalidatePath("/backend/rencontres-passees");
  revalidatePath("/rencontres-passees");
}

// ---- Paramètres du site ----
export async function saveSiteSettings(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageSettings")) throw new Error("Accès refusé");
  const updatedAt = new Date();

  for (const key of Object.keys(SITE_SETTING_DEFAULTS)) {
    // Réglée sur l'écran Réseaux sociaux : ce formulaire ne la contient pas et
    // l'écraserait avec une chaîne vide.
    if (key === "site_public_url") continue;
    await db
      .insert(siteSettings)
      .values({ key, value: asString(formData, key), updatedAt })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: asString(formData, key), updatedAt },
      });
  }

  revalidatePath("/backend/parametres");
  revalidatePath("/association");
  revalidatePath("/mentions-legales");
  revalidatePath("/confidentialite");
  revalidatePath("/");
}

// ---- RGPD / droit à l'image ----
export async function saveImageConsent(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.memberId) throw new Error("Compte adhérent requis");

  const decision = asString(formData, "decision");
  if (!["accepted", "refused"].includes(decision)) throw new Error("Décision invalide");
  const signatoryName = asString(formData, "signatoryName") || session.user.name || "Adhérent";
  const signaturePng = asString(formData, "signaturePng");
  if (decision === "accepted" && !signaturePng) {
    throw new Error("Signature requise pour autoriser le droit à l'image");
  }
  const h = await headers();

  await db.insert(imageConsents).values({
    memberId: session.user.memberId,
    decision,
    scopes: decision === "accepted" ? "site,social,print" : "",
    signatoryName,
    signaturePng: decision === "accepted" ? signaturePng : null,
    consentVersion: "2026-07-v1",
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent") ?? null,
  });

  revalidatePath("/backend");
  revalidatePath("/backend/espace");
  revalidatePath("/backend/espace/promotions");
  redirect("/backend/espace");
}

// ---- Self password change (forced at first login) ----
export async function changeOwnPassword(formData: FormData) {
  const session = await getSession();
  if (!session?.user) throw new Error("Non authentifié");
  const userId = Number(session.user.id);

  const current = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const back = (message: string) =>
    redirect(`/backend/changer-mot-de-passe?error=${encodeURIComponent(message)}`);

  if (password.length < 8) back("Le nouveau mot de passe doit faire au moins 8 caractères.");
  if (password !== confirm) back("Les deux mots de passe ne correspondent pas.");

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) back("Compte introuvable.");

  // Le mot de passe actuel est exigé : sans lui, un poste laissé ouvert suffit
  // à un tiers pour s'approprier le compte.
  if (!current || !(await bcrypt.compare(current, user!.passwordHash))) {
    back("Le mot de passe actuel est incorrect.");
  }
  if (current === password) back("Le nouveau mot de passe doit être différent de l'actuel.");

  await db
    .update(users)
    .set({
      passwordHash: await bcrypt.hash(password, 10),
      mustChangePassword: false,
      // Invalide toutes les autres sessions ouvertes sur ce compte.
      sessionVersion: (user!.sessionVersion ?? 0) + 1,
    })
    .where(eq(users.id, userId));

  // Force une nouvelle session (jeton sans le drapeau « mot de passe à changer »).
  await signOut({ redirectTo: "/login" });
}

// ---- Member: edit own profile ----
export async function updateOwnProfile(formData: FormData) {
  const session = await getSession();
  if (!session?.user) throw new Error("Non authentifié");
  const memberId = session.user.memberId;
  if (!memberId) throw new Error("Aucune fiche adhérent liée à votre compte.");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  // La catégorie n'est pas modifiable par l'adhérent : on la relit en base pour
  // en déduire les tags si le champ est laissé vide.
  const [current] = await db.select({ categoryId: members.categoryId }).from(members).where(eq(members.id, memberId));
  const city = String(formData.get("city") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const tags = await resolveMemberTags(formData.get("tags"), {
    categoryId: current?.categoryId ?? null,
    city,
    description,
  });

  await db
    .update(members)
    .set({
      name,
      contactEmail: String(formData.get("contactEmail") ?? "").trim().toLowerCase() || null,
      contactFirstName: String(formData.get("contactFirstName") ?? "").trim() || null,
      contactLastName: String(formData.get("contactLastName") ?? "").trim() || null,
      contactPhone: String(formData.get("contactPhone") ?? "").trim() || null,
      description,
      address: String(formData.get("address") ?? "").trim() || null,
      postalCode: String(formData.get("postalCode") ?? "").trim() || null,
      city,
      phone: String(formData.get("phone") ?? "").trim() || null,
      website: normalizeWebsite(String(formData.get("website") ?? "")),
      hours: String(formData.get("hours") ?? "").trim() || null,
      tags,
      // Images restreintes aux data-URI : un adhérent ne peut pas faire pointer
      // sa fiche publique vers une ressource externe qu'il contrôle.
      coverUrl: asImageDataUri(formData, "coverUrl"),
      logoUrl: asImageDataUri(formData, "logoUrl"),
    })
    // Sécurité : on ne touche que SA propre fiche, jamais statut/catégorie/mise à l'honneur.
    .where(eq(members.id, memberId));

  revalidatePath("/backend/espace");
  revalidatePath("/backend/espace/promotions");
  revalidatePath("/adherents/[id]", "page");
  revalidatePath("/annuaire");
  revalidatePath("/");
}

// Approuve une demande d'adhésion ET crée directement l'adhérent + son compte
// de connexion. Renvoie l'id du nouvel adhérent et ses identifiants, à
// afficher une seule fois.
export async function approveMembershipRequest(
  formData: FormData
): Promise<CreatedMemberAccount | ActionError | undefined> {
  const { role, userId } = await requireRole();
  if (!can(role, "manageMembers")) throw new Error("Accès refusé");

  const id = Number(formData.get("id"));
  if (!id) return undefined;

  const [req] = await db.select().from(membershipRequests).where(eq(membershipRequests.id, id));
  if (!req) throw new Error("Demande introuvable.");

  // Le bouton disparaît dès qu'une demande est traitée, mais un onglet resté
  // ouvert peut encore poster : on refuse ici plutôt que de créer un doublon.
  if (req.status !== "new") {
    return {
      error:
        req.status === "approved"
          ? "Cette demande a déjà été approuvée."
          : "Cette demande a été rejetée : rouvrez-la avant de l'approuver.",
    };
  }

  const email = (req.email ?? "").trim().toLowerCase();
  if (!email) {
    return {
      error:
        "Cette demande n'a pas d'e-mail : impossible de créer le compte. Créez l'adhérent manuellement.",
    };
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    return { error: `Un compte existe déjà avec l'e-mail ${email}.` };
  }

  const [newMember] = await db
    .insert(members)
    .values({ name: req.name, email, status: "active" })
    .returning({ id: members.id });

  const tempPassword = generateTempPassword();
  await db.insert(users).values({
    name: req.name,
    email,
    role: "member",
    memberId: newMember.id,
    passwordHash: await bcrypt.hash(tempPassword, 10),
    mustChangePassword: true,
  });

  await db.update(membershipRequests).set({ status: "approved" }).where(eq(membershipRequests.id, id));
  await logActivity(`Demande approuvée : adhérent <strong>${req.name}</strong> créé`, "#1f8a5b");

  const delivery = await deliverCredentials(
    { name: req.name, email, tempPassword, intro: "Votre demande d'adhésion a été acceptée : bienvenue chez Plein R. Voici de quoi vous connecter à votre espace adhérent." },
    userId
  );

  revalidatePath("/backend/demandes");
  revalidatePath("/backend/adherents");
  revalidatePath("/backend");
  revalidatePath("/");
  return { memberId: newMember.id, email, tempPassword, ...delivery };
}

// ---- Inbox: membership requests + contact messages ----
export async function setRequestStatus(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMembers")) throw new Error("Accès refusé");
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  if (!id || !["new", "approved", "rejected"].includes(status)) return;
  // Une demande approuvée a créé un compte : elle ne se rejoue pas depuis un
  // onglet resté ouvert sur l'ancien état.
  await db
    .update(membershipRequests)
    .set({ status: status as "new" | "approved" | "rejected" })
    .where(and(eq(membershipRequests.id, id), ne(membershipRequests.status, "approved")));
  revalidatePath("/backend/demandes");
  revalidatePath("/backend");
}

export async function setContactStatus(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMembers")) throw new Error("Accès refusé");
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  if (!id || !["new", "read", "archived"].includes(status)) return;
  await db
    .update(contactMessages)
    .set({ status: status as "new" | "read" | "archived" })
    .where(eq(contactMessages.id, id));
  revalidatePath("/backend/demandes");
  revalidatePath("/backend");
}

// ---- URL publique de l'application ----
// Sert à l'adresse de retour OAuth et au lien inséré dans les publications.
export async function saveSitePublicUrl(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageSettings")) throw new Error("Accès refusé");

  const raw = asString(formData, "sitePublicUrl");
  let value = "";
  if (raw) {
    // Le schéma est facultatif à la saisie ; seul l'origine est conservée, un
    // chemin ou des paramètres casseraient l'adresse de retour OAuth.
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    let parsed: URL | null = null;
    try {
      parsed = new URL(candidate);
    } catch {
      parsed = null;
    }
    if (!parsed || !["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
      // Message rendu par le bandeau de l'écran, plutôt qu'une page d'erreur brute.
      redirect(
        `/backend/reseaux?error=${encodeURIComponent(
          "Adresse invalide : indiquez par exemple https://pleinr.example.fr"
        )}`
      );
    }
    value = parsed.origin;
  }

  const updatedAt = new Date();
  await db
    .insert(siteSettings)
    .values({ key: "site_public_url", value, updatedAt })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt } });

  revalidatePath("/backend/reseaux");
  revalidatePath("/backend/parametres");
}

// ---- Réseaux sociaux : identifiants d'application et connexion ----
export async function saveSocialApp(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageSettings")) throw new Error("Accès refusé");

  const network = String(formData.get("network")) as SocialNetwork;
  if (!SOCIAL_NETWORKS.includes(network)) return;

  const appId = asString(formData, "appId");
  if (!appId) throw new Error("L'identifiant de l'application est requis.");
  // Champ secret laissé vide = on garde celui déjà enregistré.
  const appSecret = asString(formData, "appSecret") || null;

  await saveAppCredentials(network, appId, appSecret);
  revalidatePath("/backend/reseaux");
}

export async function selectSocialTarget(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageSettings")) throw new Error("Accès refusé");

  const network = String(formData.get("network")) as SocialNetwork;
  const targetId = asString(formData, "targetId");
  if (!SOCIAL_NETWORKS.includes(network) || !targetId) return;

  await selectTarget(network, targetId);
  await logActivity(`Page ${SOCIAL_LABELS[network]} sélectionnée pour la publication`, "#2C6FB3");
  revalidatePath("/backend/reseaux");
  revalidatePath("/backend/promotions");
}

export async function disconnectSocial(formData: FormData) {
  const { role, name } = await requireRole();
  if (!can(role, "manageSettings")) throw new Error("Accès refusé");

  const network = String(formData.get("network")) as SocialNetwork;
  if (!SOCIAL_NETWORKS.includes(network)) return;

  await disconnectAccount(network);
  await logActivity(
    `Compte ${SOCIAL_LABELS[network]} déconnecté par <strong>${name}</strong>`,
    "#d8472b"
  );
  revalidatePath("/backend/reseaux");
  revalidatePath("/backend/promotions");
  revalidatePath("/backend/espace");
  revalidatePath("/backend/espace/promotions");
}

// ---- Sign out ----
export async function doSignOut() {
  await signOut({ redirectTo: "/" });
}

// ---- Informations de l'association ----

function revalidateInformationPaths() {
  revalidatePath("/backend/informations");
  revalidatePath("/backend/espace");
  revalidatePath("/backend/espace/informations");
  revalidatePath("/backend/espace/promotions");
  revalidatePath("/backend");
}

async function requireInformations() {
  const access = await requireRole();
  if (!can(access.role, "manageInformations")) throw new Error("Accès refusé");
  return access;
}

/**
 * Une seule information épinglée à la fois. Appliqué ici plutôt que par un
 * index partiel : l'écriture est réservée au staff, il n'y a pas de course
 * réelle, et drizzle-kit ne génère pas les index conditionnels.
 */
async function unpinOthers(keepId: number) {
  await db
    .update(informations)
    .set({ pinned: false })
    .where(and(eq(informations.pinned, true), ne(informations.id, keepId)));
}

export type SavedInformation = { id: number };

export async function saveInformation(
  formData: FormData
): Promise<SavedInformation | ActionError> {
  const { userId } = await requireInformations();

  const id = Number(formData.get("id") ?? 0) || null;
  const title = asString(formData, "title");
  const body = asString(formData, "body");
  if (!title) return { error: "Donnez un titre à cette information." };
  if (!body) return { error: "Le message est vide." };

  let imageUrl: string | null = null;
  try {
    imageUrl = asImageDataUri(formData, "imageUrl");
  } catch (error) {
    // Refus de saisie attendu : on le renvoie au formulaire, qui garde le reste.
    return { error: error instanceof Error ? error.message : "Image refusée." };
  }

  const pinned = formData.get("pinned") === "on";
  const now = new Date();

  if (id) {
    const [updated] = await db
      .update(informations)
      .set({ title, body, imageUrl, pinned, updatedAt: now })
      .where(eq(informations.id, id))
      .returning({ id: informations.id });
    if (!updated) return { error: "Cette information n'existe plus." };
    if (pinned) await unpinOthers(updated.id);
    revalidateInformationPaths();
    return { id: updated.id };
  }

  const [created] = await db
    .insert(informations)
    .values({ title, body, imageUrl, pinned, authorId: userId, createdAt: now, updatedAt: now })
    .returning({ id: informations.id });
  if (pinned) await unpinOthers(created.id);
  await logActivity(`Information rédigée : <strong>${title}</strong>`, "#6FB0C6");
  revalidateInformationPaths();
  return { id: created.id };
}

/**
 * Les refus de diffusion passent par une redirection avec message plutôt que
 * par un retour : le bouton « Publier » est un `<form action>` de composant
 * serveur, qui ne peut rien renvoyer au navigateur. Même idiome que
 * `saveSitePublicUrl`.
 */
function informationRedirect(message: string, tone: "error" | "ok"): never {
  redirect(`/backend/informations?${tone}=${encodeURIComponent(message)}`);
}

export async function publishInformation(formData: FormData) {
  const { role, userId } = await requireInformations();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;

  const [published] = await db
    .update(informations)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(informations.id, id), eq(informations.status, "draft")))
    .returning({
      id: informations.id,
      title: informations.title,
      body: informations.body,
      imageUrl: informations.imageUrl,
      emailSentAt: informations.emailSentAt,
    });
  if (!published) return;

  await logActivity(`Information publiée : <strong>${published.title}</strong>`, "#1F8A5B");
  revalidateInformationPaths();

  // La diffusion est un choix, pas une conséquence de la publication. Elle est
  // en outre réservée à qui peut déjà écrire aux adhérents : un modérateur
  // publie, il ne diffuse pas.
  if (formData.get("sendEmail") !== "on" || !can(role, "manageEmails")) return;
  // Garde anti-double-diffusion, sur le modèle de `publishPromoShares` : une
  // information dépubliée puis republiée ne repart pas une seconde fois.
  if (published.emailSentAt) return;

  const base = await siteUrl();
  if (!base) {
    // Sans adresse publique, le logo et tous les liens du message seraient
    // cassés : mieux vaut ne rien envoyer et le dire.
    informationRedirect(
      "Information publiée, mais non diffusée : l'adresse publique du site n'est pas renseignée (Backend › Réseaux sociaux).",
      "error"
    );
  }

  const settings = await getSiteSettings();
  const { subject, html } = buildInformationEmail(
    { id: published.id, title: published.title, body: published.body, hasImage: Boolean(published.imageUrl) },
    base,
    emailBrand(settings)
  );
  const text = `${published.title}\n\n${richTextToPlain(published.body)}\n\n${base}/backend/espace/informations`;

  const recipients = await activeMemberRecipients();
  if (recipients.length === 0) {
    informationRedirect("Information publiée, mais aucun adhérent actif n'a d'adresse e-mail utilisable.", "error");
  }

  // Une ligne par destinataire : aucune adresse n'est visible des autres.
  await queueMails(
    recipients.map((recipient) => ({
      kind: "information" as const,
      toAddress: recipient.email,
      toName: recipient.name,
      subject,
      html,
      text,
      replyTo: settings.association_email || null,
      informationId: published.id,
      memberId: recipient.memberId,
      createdById: userId,
    }))
  );
  await db.update(informations).set({ emailSentAt: new Date() }).where(eq(informations.id, published.id));
  await logActivity(
    `Information <strong>${published.title}</strong> diffusée à ${recipients.length} adhérent(s)`,
    "#2C6FB3"
  );
  revalidateInformationPaths();
  informationRedirect(
    `Information publiée et mise en file pour ${recipients.length} adhérent(s).`,
    "ok"
  );
}

export async function unpublishInformation(formData: FormData) {
  await requireInformations();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;

  // Le retrait dépingle : une information invisible ne doit pas garder la
  // place de tête au retour en ligne.
  const [hidden] = await db
    .update(informations)
    .set({ status: "draft", pinned: false, updatedAt: new Date() })
    .where(eq(informations.id, id))
    .returning({ title: informations.title });
  if (!hidden) return;

  await logActivity(`Information retirée : <strong>${hidden.title}</strong>`, "#9A6638");
  revalidateInformationPaths();
}

export async function toggleInformationPin(formData: FormData) {
  await requireInformations();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;

  const [current] = await db
    .select({ pinned: informations.pinned })
    .from(informations)
    .where(eq(informations.id, id));
  if (!current) return;

  const pinned = !current.pinned;
  await db.update(informations).set({ pinned, updatedAt: new Date() }).where(eq(informations.id, id));
  if (pinned) await unpinOthers(id);
  revalidateInformationPaths();
}

export async function deleteInformation(formData: FormData) {
  await requireInformations();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;
  // Les lignes de lecture partent en cascade avec l'information.
  await db.delete(informations).where(eq(informations.id, id));
  revalidateInformationPaths();
}

/**
 * Marque des informations comme lues pour l'utilisateur courant.
 *
 * Appelée par un petit composant client après affichage, plutôt qu'au rendu de
 * la page : l'écriture et le compteur de la barre latérale vivent dans deux
 * composants serveur distincts, dont l'ordre de rendu n'est pas garanti. En
 * passant par une action, les deux pastilles retombent ensemble.
 */
export async function markInformationsRead(ids: number[]) {
  const session = await getSession();
  const userId = Number(session?.user.id);
  if (!Number.isFinite(userId)) return;

  const clean = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (clean.length === 0) return;

  await markRead(userId, clean);
  revalidatePath("/backend/espace/informations");
  revalidatePath("/backend/espace");
  revalidatePath("/backend/espace/promotions");
  revalidatePath("/backend");
}

// ---- Boîte mail de l'association ----

async function requireMailSettings() {
  const access = await requireRole();
  if (!can(access.role, "manageSettings")) throw new Error("Accès refusé");
  return access;
}

function mailRedirect(message: string, tone: "error" | "ok") {
  redirect(`/backend/boite-mail?${tone}=${encodeURIComponent(message)}`);
}

export async function saveMailApp(formData: FormData) {
  await requireMailSettings();
  const provider = String(formData.get("provider")) as MailProvider;
  if (!MAIL_PROVIDERS.includes(provider) || provider === "smtp") return;

  const appId = asString(formData, "appId");
  if (!appId) mailRedirect("L'identifiant de l'application est requis.", "error");
  // Champ secret laissé vide = on garde celui déjà enregistré.
  const appSecret = asString(formData, "appSecret") || null;
  try {
    await saveOAuthApp(provider, appId, appSecret);
  } catch (error) {
    mailRedirect(error instanceof Error ? error.message : "Enregistrement impossible.", "error");
  }
  revalidatePath("/backend/boite-mail");
}

export async function saveMailSmtp(formData: FormData) {
  await requireMailSettings();
  const host = asString(formData, "smtpHost");
  const user = asString(formData, "smtpUser");
  const port = Number(formData.get("smtpPort") ?? 465) || 465;
  if (!host || !user) mailRedirect("Le serveur et l'identifiant sont requis.", "error");

  try {
    await saveSmtpAccount({
      host,
      port: Math.min(65535, Math.max(1, port)),
      secure: formData.get("smtpSecure") === "on",
      user,
      password: asString(formData, "smtpPassword") || null,
      fromAddress: asString(formData, "fromAddress") || user,
      fromName: asString(formData, "fromName"),
    });
  } catch (error) {
    mailRedirect(error instanceof Error ? error.message : "Enregistrement impossible.", "error");
  }
  revalidatePath("/backend/boite-mail");
  mailRedirect("Réglages SMTP enregistrés.", "ok");
}

export async function setMailProvider(formData: FormData) {
  await requireMailSettings();
  const provider = String(formData.get("provider")) as MailProvider;
  if (!MAIL_PROVIDERS.includes(provider)) return;
  await setActiveMailProvider(provider);
  await logActivity(`Boîte mail : expédition via <strong>${MAIL_LABELS[provider]}</strong>`, "#2C6FB3");
  revalidatePath("/backend/boite-mail");
}

export async function disconnectMail(formData: FormData) {
  await requireMailSettings();
  const provider = String(formData.get("provider")) as MailProvider;
  if (!MAIL_PROVIDERS.includes(provider)) return;
  await disconnectMailAccount(provider);
  await logActivity(`Boîte mail déconnectée : <strong>${MAIL_LABELS[provider]}</strong>`, "#d8472b");
  revalidatePath("/backend/boite-mail");
}

/**
 * Envoi de contrôle vers sa propre adresse. Direct et non mis en file : c'est
 * précisément le verdict immédiat qu'on cherche.
 */
export async function sendMailTest() {
  const { userId, name } = await requireMailSettings();
  const recipient = userId ? await selfRecipient(userId) : null;
  if (!recipient) mailRedirect("Votre compte n'a pas d'adresse e-mail utilisable.", "error");

  const settings = await getSiteSettings();
  const base = await siteUrl();
  const { subject, html } = buildGeneralEmail(
    {
      subject: `Test d'envoi — ${settings.association_name}`,
      kicker: settings.association_name,
      title: "La boîte mail répond",
      body: `Bonjour ${name},\n\nCe message confirme que le site sait expédier depuis la boîte de l'association.\n\nSi vous le recevez, les mots de passe temporaires, les invitations aux rencontres et les informations diffusées partiront de la même façon.`,
      buttonLabel: "",
      buttonUrl: "",
      signature: `L'équipe de ${settings.association_name}`,
    },
    base,
    emailBrand(settings)
  );

  const result = await sendNow({
    to: recipient!.email,
    toName: recipient!.name,
    subject,
    html,
    replyTo: settings.association_email || null,
  });
  await logSentMail({
    kind: "test",
    toAddress: recipient!.email,
    subject,
    createdById: userId,
    result: result.ok ? { ok: true } : { ok: false, reason: result.reason },
  });

  revalidatePath("/backend/boite-mail");
  mailRedirect(
    result.ok ? `Message de test envoyé à ${recipient!.email}.` : `Échec de l'envoi : ${result.reason}`,
    result.ok ? "ok" : "error"
  );
}

/** Contrôle la santé des trois fournisseurs à la demande. */
export async function checkMailProvider(formData: FormData) {
  await requireMailSettings();
  const provider = String(formData.get("provider")) as MailProvider;
  if (!MAIL_PROVIDERS.includes(provider)) return;
  await checkMailHealth(provider);
  revalidatePath("/backend/boite-mail");
}

export async function retryMail(formData: FormData) {
  await requireMailSettings();
  const id = Number(formData.get("id") ?? 0);
  if (id) await retryMailMessage(id);
  revalidatePath("/backend/boite-mail");
}

export async function cancelMail(formData: FormData) {
  await requireMailSettings();
  const id = Number(formData.get("id") ?? 0);
  if (id) await cancelMailMessage(id);
  revalidatePath("/backend/boite-mail");
}

// ---- Envois groupés ----

async function requireEmails() {
  const access = await requireRole();
  if (!can(access.role, "manageEmails")) throw new Error("Accès refusé");
  return access;
}

export type QueuedBroadcast = { queued: number; audience: string };

/**
 * Prépare un envoi groupé.
 *
 * Le message est construit **une seule fois** puis recopié par destinataire :
 * une ligne chacun, jamais de copie partagée. Rien ne part dans la requête —
 * la file est vidée par la boucle de fond, sinon la page attendrait autant
 * d'allers-retours que d'adhérents.
 */
async function queueBroadcast(
  message: { subject: string; html: string; text?: string | null },
  audience: Audience,
  meta: { kind: "studio" | "meeting"; meetingId?: number | null; userId: number | null }
): Promise<QueuedBroadcast | ActionError> {
  const recipients = await resolveAudience(audience);
  if (recipients.length === 0) {
    return { error: "Aucun destinataire n'a d'adresse e-mail utilisable pour cette sélection." };
  }
  if (!(await isMailConfigured())) {
    return { error: "Aucune boîte mail n'est configurée : voir Configuration › Boîte mail." };
  }

  const settings = await getSiteSettings();
  await queueMails(
    recipients.map((recipient) => ({
      kind: meta.kind,
      toAddress: recipient.email,
      toName: recipient.name,
      subject: message.subject,
      html: message.html,
      text: message.text ?? null,
      replyTo: settings.association_email || null,
      meetingId: meta.meetingId ?? null,
      memberId: recipient.memberId,
      createdById: meta.userId,
    }))
  );

  revalidatePath("/backend/boite-mail");
  return { queued: recipients.length, audience: describeAudience(audience) };
}

function describeAudience(audience: Audience): string {
  if (audience.kind === "category") return "une catégorie de métier";
  if (audience.kind === "members") return "une sélection d'adhérents";
  if (audience.kind === "meeting") return "les inscrits à la rencontre";
  return "tous les adhérents actifs";
}

/** Envoi de contrôle vers sa propre adresse : direct, pour un verdict immédiat. */
export async function sendSelfTest(
  message: { subject: string; html: string; text?: string | null }
): Promise<QueuedBroadcast | ActionError> {
  const { userId } = await requireEmails();
  const recipient = userId ? await selfRecipient(userId) : null;
  if (!recipient) return { error: "Votre compte n'a pas d'adresse e-mail utilisable." };

  const settings = await getSiteSettings();
  const result = await sendNow({
    to: recipient.email,
    toName: recipient.name,
    subject: message.subject,
    html: message.html,
    text: message.text ?? null,
    replyTo: settings.association_email || null,
  });
  await logSentMail({
    kind: "test",
    toAddress: recipient.email,
    subject: message.subject,
    createdById: userId,
    result: result.ok ? { ok: true } : { ok: false, reason: result.reason },
  });
  if (!result.ok) return { error: result.reason };
  return { queued: 1, audience: `votre adresse (${recipient.email})` };
}

export async function sendStudioEmail(input: {
  content: GeneralEmailContent;
  audience: Audience;
}): Promise<QueuedBroadcast | ActionError> {
  const { userId } = await requireEmails();
  const settings = await getSiteSettings();
  const base = await siteUrl();
  if (!base) {
    return { error: "Renseignez d'abord l'adresse publique du site (Backend › Réseaux sociaux)." };
  }

  const { subject, html } = buildGeneralEmail(input.content, base, emailBrand(settings));
  return queueBroadcast({ subject, html, text: input.content.body }, input.audience, { kind: "studio", userId });
}

export async function sendMeetingInvitations(input: {
  meetingId: number;
  texts: MeetingEmailTexts;
  audience: Audience;
}): Promise<QueuedBroadcast | ActionError> {
  const { userId } = await requireEmails();
  const settings = await getSiteSettings();
  const base = await siteUrl();
  if (!base) {
    return { error: "Renseignez d'abord l'adresse publique du site (Backend › Réseaux sociaux)." };
  }

  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, input.meetingId));
  if (!meeting) return { error: "Cette rencontre n'existe plus." };

  const [count] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(meetingRegistrations)
    .where(eq(meetingRegistrations.meetingId, meeting.id));

  const { subject, html, registrationUrl } = buildMeetingEmail(
    {
      id: meeting.id,
      title: meeting.title,
      startsAt: meeting.startsAt.toISOString(),
      location: meeting.location,
      description: meeting.description,
      capacity: meeting.capacity,
      registered: count?.total ?? 0,
    },
    input.texts,
    base,
    emailBrand(settings)
  );

  return queueBroadcast(
    { subject, html, text: `${input.texts.intro}\n\n${registrationUrl}` },
    input.audience,
    { kind: "meeting", meetingId: meeting.id, userId }
  );
}
