"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signOut } from "@/auth";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { CATEGORY_PALETTE } from "@/db/categories";
import { slugify } from "@/lib/slug";
import { autoTags } from "@/lib/tags";
import {
  activityLog,
  categories,
  contactMessages,
  imageConsents,
  meetingRegistrations,
  meetings,
  members,
  membershipRequests,
  pastMeetingPhotos,
  pastMeetings,
  promotions,
  siteSettings,
  socialPosts,
  users,
} from "@/db/schema";
import { sanitizeActivityMessage } from "@/lib/activity";
import { can, LABEL_TO_ROLE } from "@/lib/rbac";
import {
  isNetworkConfigured,
  publishPromoToNetwork,
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
import { SITE_SETTING_DEFAULTS } from "@/lib/site-settings";
import type { AppRole } from "@/types/next-auth";



async function logActivity(message: string, dot = "#2C6FB3") {
  // Le message agrège des saisies de tiers : on ne laisse passer que <strong>.
  await db.insert(activityLog).values({ message: sanitizeActivityMessage(message), dot });
}

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

function revalidatePromoPaths(memberId?: number | null) {
  revalidatePath("/backend/promotions");
  revalidatePath("/backend/espace");
  revalidatePath("/backend/espace/promotions");
  revalidatePath("/backend");
  revalidatePath("/");
  revalidatePath("/annuaire");
  if (memberId) revalidatePath("/adherents/[id]", "page");
}

/** Réseaux demandés pour une promo, dans l'ordre d'affichage. */
function requestedNetworks(promo: { shareFacebook: boolean; shareLinkedin: boolean }): SocialNetwork[] {
  return SOCIAL_NETWORKS.filter((n) =>
    n === "facebook" ? promo.shareFacebook : promo.shareLinkedin
  );
}

function readShareTargets(formData: FormData) {
  return {
    shareFacebook: formData.get("shareFacebook") === "on",
    shareLinkedin: formData.get("shareLinkedin") === "on",
  };
}

/**
 * Publie une promotion sur les réseaux demandés. Ne lève jamais : un réseau
 * indisponible ne doit pas faire échouer la mise en ligne, l'échec est
 * enregistré dans `social_posts` et rattrapable depuis le backoffice.
 *
 * Un réseau déjà publié avec succès est ignoré : c'est ce qui empêche toute
 * republication, y compris sur un cycle suspension → remise en ligne.
 */
async function publishPromoShares(
  promoId: number,
  networks: SocialNetwork[],
  userId: number | null
) {
  if (networks.length === 0) return;

  const [promo] = await db
    .select({
      title: promotions.title,
      text: promotions.text,
      badge: promotions.badge,
      validUntil: promotions.validUntil,
      imageUrl: promotions.imageUrl,
      memberId: promotions.memberId,
      memberName: members.name,
      memberCity: members.city,
    })
    .from(promotions)
    .leftJoin(members, eq(promotions.memberId, members.id))
    .where(eq(promotions.id, promoId));
  if (!promo) return;

  const done = await db
    .select({ network: socialPosts.network })
    .from(socialPosts)
    .where(and(eq(socialPosts.promotionId, promoId), eq(socialPosts.status, "posted")));
  const alreadyPosted = new Set(done.map((d) => d.network));

  for (const network of networks) {
    if (alreadyPosted.has(network)) continue;

    if (!(await isNetworkConfigured(network))) {
      await db.insert(socialPosts).values({
        promotionId: promoId,
        network,
        status: "failed",
        error: `${SOCIAL_LABELS[network]} n'est pas configuré sur ce serveur.`,
        postedById: userId,
      });
      continue;
    }

    try {
      const result = await publishPromoToNetwork(network, promo);
      await db.insert(socialPosts).values({
        promotionId: promoId,
        network,
        status: "posted",
        externalId: result.externalId,
        url: result.url,
        postedById: userId,
      });
      await logActivity(
        `Promotion « ${promo.title} » publiée sur ${SOCIAL_LABELS[network]}`,
        "#2C6FB3"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      await db.insert(socialPosts).values({
        promotionId: promoId,
        network,
        status: "failed",
        error: message.slice(0, 2000),
        postedById: userId,
      });
    }
  }
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
    await db
      .update(promotions)
      .set({
        status: "live",
        ...targets,
        suspendedBy: null,
        suspendedById: null,
        suspendedAt: null,
      })
      .where(eq(promotions.id, id));
    await logActivity(`Promotion « ${promo.title} » validée et mise en ligne`, "#1f8a5b");
    // Mise en ligne committée avant l'appel réseau : si un réseau répond mal,
    // la promo est quand même publiée sur le site.
    await publishPromoShares(id, requestedNetworks(targets), userId);
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
  const imageUrl = asImageDataUri(formData, "imageUrl");

  // Réseaux souhaités : rien n'est publié ici, la diffusion attend la validation.
  await db.insert(promotions).values({
    title,
    text,
    category,
    badge,
    imageUrl,
    memberId: memberId ?? null,
    status: "pending",
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
export type IssuedCredentials = { email: string; tempPassword: string };

export type CreatedMemberAccount = IssuedCredentials & { memberId: number };

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

export async function addMember(formData: FormData): Promise<CreatedMemberAccount | undefined> {
  const { role } = await requireRole();
  if (!can(role, "manageMembers")) throw new Error("Accès refusé");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return undefined;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) throw new Error("L'e-mail est requis pour créer le compte de l'adhérent.");
  const categoryId = formData.get("categoryId") ? Number(formData.get("categoryId")) : null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const status = (String(formData.get("status") ?? "pending") as "active" | "pending");

  // Un seul compte par e-mail.
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    throw new Error("Un compte existe déjà avec cet e-mail.");
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

  revalidatePath("/backend/adherents");
  revalidatePath("/backend");
  revalidatePath("/");
  return { memberId: newMember.id, email, tempPassword };
}

// Crée des comptes de connexion pour les adhérents existants qui n'en ont pas
// encore (ceux ajoutés avant l'arrivée des comptes adhérent). Chaque compte
// reçoit un mot de passe temporaire à changer à la première connexion. Les
// identifiants sont renvoyés pour un affichage unique : rien n'est conservé.
export async function createMissingMemberAccounts(): Promise<(IssuedCredentials & { name: string })[]> {
  const { role } = await requireRole();
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
    created.push({ name: m.name, email, tempPassword });
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
  const { role } = await requireRole();
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

  revalidatePath(`/backend/adherents/${memberId}`);
  return { email: u.email, tempPassword };
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
export async function inviteAdmin(formData: FormData): Promise<IssuedCredentials | undefined> {
  const { role } = await requireRole();
  if (!can(role, "manageAdmins")) throw new Error("Accès refusé");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return undefined;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return undefined;
  const roleLabel = String(formData.get("role") ?? "Administrateur");
  const newRole: AppRole = LABEL_TO_ROLE[roleLabel] ?? "editor";

  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length > 0) throw new Error("Un compte existe déjà avec cet e-mail.");

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

  await logActivity(`<strong>${name}</strong> a été invité comme ${roleLabel}`, "#2C6FB3");
  revalidatePath("/backend/administrateurs");
  return { email, tempPassword };
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
export async function approveMembershipRequest(formData: FormData): Promise<CreatedMemberAccount | undefined> {
  const { role } = await requireRole();
  if (!can(role, "manageMembers")) throw new Error("Accès refusé");

  const id = Number(formData.get("id"));
  if (!id) return undefined;

  const [req] = await db.select().from(membershipRequests).where(eq(membershipRequests.id, id));
  if (!req) throw new Error("Demande introuvable.");
  // Garde serveur : un double clic ou un onglet resté ouvert ne doit jamais
  // créer un second compte pour la même demande.
  if (req.status === "approved") throw new Error("Cette demande a déjà été approuvée : l'adhérent existe.");

  const email = (req.email ?? "").trim().toLowerCase();
  if (!email) {
    throw new Error("Cette demande n'a pas d'e-mail : impossible de créer le compte. Créez l'adhérent manuellement.");
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    throw new Error("Un compte existe déjà avec cet e-mail.");
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

  revalidatePath("/backend/demandes");
  revalidatePath("/backend/adherents");
  revalidatePath("/backend");
  revalidatePath("/");
  return { memberId: newMember.id, email, tempPassword };
}

// ---- Inbox: membership requests + contact messages ----
export async function setRequestStatus(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMembers")) throw new Error("Accès refusé");
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  if (!id || !["new", "approved", "rejected"].includes(status)) return;
  // Une demande approuvée a produit un adhérent : son statut ne se réécrit plus.
  const [current] = await db.select({ status: membershipRequests.status }).from(membershipRequests).where(eq(membershipRequests.id, id));
  if (!current || current.status === "approved") return;
  await db
    .update(membershipRequests)
    .set({ status: status as "new" | "approved" | "rejected" })
    .where(eq(membershipRequests.id, id));
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
