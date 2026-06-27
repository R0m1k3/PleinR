"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import {
  activityLog,
  categories,
  contactMessages,
  members,
  membershipRequests,
  promotions,
  users,
} from "@/db/schema";
import { can, LABEL_TO_ROLE } from "@/lib/rbac";
import type { AppRole } from "@/types/next-auth";

const CATEGORY_PALETTE = [
  { accent: "#E0A63C", tint: "#f6efdc" },
  { accent: "#6FB0C6", tint: "#e7f0f3" },
  { accent: "#9a6638", tint: "#f4ebda" },
  { accent: "#2C6FB3", tint: "#eaf0f6" },
  { accent: "#5a7a5a", tint: "#eef0ec" },
  { accent: "#7a6f9c", tint: "#efe9f3" },
  { accent: "#c98a2e", tint: "#f7efe0" },
  { accent: "#3f8aa3", tint: "#e6eff2" },
];

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

async function logActivity(message: string, dot = "#2C6FB3") {
  await db.insert(activityLog).values({ message, dot });
}

// Mot de passe temporaire lisible (sans caractères ambigus).
function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function requireRole(): Promise<{ role: AppRole; memberId: number | null; name: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  return {
    role: session.user.role,
    memberId: session.user.memberId,
    name: session.user.name ?? "Adhérent",
  };
}

// ---- Promotion moderation ----
export async function moderatePromo(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "moderatePromos")) throw new Error("Accès refusé");

  const id = Number(formData.get("id"));
  const action = String(formData.get("action"));
  if (!id) return;

  if (action === "approve") {
    await db.update(promotions).set({ status: "live" }).where(eq(promotions.id, id));
    const [p] = await db.select().from(promotions).where(eq(promotions.id, id));
    if (p) await logActivity(`Promotion « ${p.title} » validée et mise en ligne`, "#1f8a5b");
  } else if (action === "reject" || action === "remove") {
    await db.delete(promotions).where(eq(promotions.id, id));
  }

  revalidatePath("/backend/promotions");
  revalidatePath("/backend");
  revalidatePath("/");
}

// ---- Member space: publish a promotion ----
export async function publishPromo(formData: FormData) {
  const { memberId, name } = await requireRole();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const text = String(formData.get("text") ?? "").slice(0, 240);
  const category = String(formData.get("category") ?? "");
  const badge = String(formData.get("badge") ?? "").trim() || null;
  const imageUrl = String(formData.get("imageUrl") ?? "") || null;

  await db.insert(promotions).values({
    title,
    text,
    category,
    badge,
    imageUrl,
    memberId: memberId ?? null,
    status: "pending",
  });

  await logActivity(`<strong>${name}</strong> a soumis une promotion « ${title} »`, "#E0A63C");

  revalidatePath("/backend/espace");
  revalidatePath("/backend");
  revalidatePath("/backend/promotions");
}

// ---- Members CRUD ----
export async function addMember(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMembers")) throw new Error("Accès refusé");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
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

  const [newMember] = await db
    .insert(members)
    .values({ name, email, categoryId, city, status })
    .returning({ id: members.id });

  // Compte de connexion adhérent avec mot de passe temporaire à changer.
  const tempPassword = generateTempPassword();
  await db.insert(users).values({
    name,
    email,
    role: "member",
    memberId: newMember.id,
    passwordHash: await bcrypt.hash(tempPassword, 10),
    tempPassword,
    mustChangePassword: true,
  });

  await logActivity(`Nouvel adhérent ajouté : <strong>${name}</strong>`, "#2C6FB3");

  revalidatePath("/backend/adherents");
  revalidatePath("/backend");
  revalidatePath("/");
}

// Crée des comptes de connexion pour les adhérents existants qui n'en ont pas
// encore (ceux ajoutés avant l'arrivée des comptes adhérent). Chaque compte
// reçoit un mot de passe temporaire à changer à la première connexion.
export async function createMissingMemberAccounts() {
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

  let created = 0;
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
      tempPassword,
      mustChangePassword: true,
    });
    takenEmails.add(email);
    created++;
  }

  if (created > 0) {
    await logActivity(`${created} compte(s) adhérent créé(s) pour les fiches existantes`, "#2C6FB3");
  }
  revalidatePath("/backend/adherents");
}

// Réinitialise le mot de passe d'un adhérent : nouveau mot de passe temporaire
// visible par l'admin jusqu'à la prochaine connexion de l'adhérent.
export async function resetMemberPassword(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMembers")) throw new Error("Accès refusé");

  const memberId = Number(formData.get("memberId"));
  if (!memberId) return;

  const [u] = await db.select().from(users).where(eq(users.memberId, memberId));
  if (!u) throw new Error("Aucun compte de connexion lié à cet adhérent.");

  const tempPassword = generateTempPassword();
  await db
    .update(users)
    .set({
      passwordHash: await bcrypt.hash(tempPassword, 10),
      tempPassword,
      mustChangePassword: true,
    })
    .where(eq(users.id, u.id));

  revalidatePath(`/backend/adherents/${memberId}`);
}

export async function updateMember(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMembers")) throw new Error("Accès refusé");

  const id = Number(formData.get("id"));
  if (!id) return;

  await db
    .update(members)
    .set({
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      categoryId: formData.get("categoryId") ? Number(formData.get("categoryId")) : null,
      city: String(formData.get("city") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      description: String(formData.get("description") ?? "").trim() || null,
      postalCode: String(formData.get("postalCode") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      website: String(formData.get("website") ?? "").trim() || null,
      memberSince: formData.get("memberSince") ? Number(formData.get("memberSince")) : null,
      coverUrl: String(formData.get("coverUrl") ?? "").trim() || null,
      logoUrl: String(formData.get("logoUrl") ?? "").trim() || null,
      tags: String(formData.get("tags") ?? "").trim() || null,
      hours: String(formData.get("hours") ?? "").trim() || null,
      status: String(formData.get("status") ?? "pending") as "active" | "pending",
      highlighted: formData.get("highlighted") === "on",
    })
    .where(eq(members.id, id));

  revalidatePath("/backend/adherents");
  revalidatePath(`/adherents/${id}`);
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
export async function inviteAdmin(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageAdmins")) throw new Error("Accès refusé");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;
  const roleLabel = String(formData.get("role") ?? "Administrateur");
  const newRole: AppRole = LABEL_TO_ROLE[roleLabel] ?? "editor";

  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length > 0) return;

  // Temporary password — the invitee resets it on first login (out of scope here).
  const tempPassword = Math.random().toString(36).slice(2, 12);
  await db.insert(users).values({
    name,
    email,
    role: newRole,
    passwordHash: await bcrypt.hash(tempPassword, 10),
  });

  await logActivity(`<strong>${name}</strong> a été invité comme ${roleLabel}`, "#2C6FB3");
  revalidatePath("/backend/administrateurs");
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

// ---- Self password change (forced at first login) ----
export async function changeOwnPassword(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  const userId = Number(session.user.id);

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) throw new Error("Le mot de passe doit faire au moins 8 caractères.");
  if (password !== confirm) throw new Error("Les deux mots de passe ne correspondent pas.");

  await db
    .update(users)
    .set({
      passwordHash: await bcrypt.hash(password, 10),
      tempPassword: null,
      mustChangePassword: false,
    })
    .where(eq(users.id, userId));

  // Force une nouvelle session (jeton sans le drapeau « mot de passe à changer »).
  await signOut({ redirectTo: "/login" });
}

// ---- Member: edit own profile ----
export async function updateOwnProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié");
  const memberId = session.user.memberId;
  if (!memberId) throw new Error("Aucune fiche adhérent liée à votre compte.");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await db
    .update(members)
    .set({
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      postalCode: String(formData.get("postalCode") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      website: String(formData.get("website") ?? "").trim() || null,
      hours: String(formData.get("hours") ?? "").trim() || null,
      tags: String(formData.get("tags") ?? "").trim() || null,
      coverUrl: String(formData.get("coverUrl") ?? "").trim() || null,
      logoUrl: String(formData.get("logoUrl") ?? "").trim() || null,
    })
    // Sécurité : on ne touche que SA propre fiche, jamais statut/catégorie/mise à l'honneur.
    .where(eq(members.id, memberId));

  revalidatePath("/backend/espace");
  revalidatePath(`/adherents/${memberId}`);
  revalidatePath("/annuaire");
  revalidatePath("/");
}

// ---- Inbox: membership requests + contact messages ----
export async function setRequestStatus(formData: FormData) {
  const { role } = await requireRole();
  if (!can(role, "manageMembers")) throw new Error("Accès refusé");
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  if (!id || !["new", "approved", "rejected"].includes(status)) return;
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

// ---- Sign out ----
export async function doSignOut() {
  await signOut({ redirectTo: "/" });
}
