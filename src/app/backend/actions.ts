"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import {
  activityLog,
  members,
  promotions,
  users,
} from "@/db/schema";
import { can, LABEL_TO_ROLE } from "@/lib/rbac";
import type { AppRole } from "@/types/next-auth";

async function logActivity(message: string, dot = "#2C6FB3") {
  await db.insert(activityLog).values({ message, dot });
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
  const email = String(formData.get("email") ?? "").trim();
  const categoryId = formData.get("categoryId") ? Number(formData.get("categoryId")) : null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const status = (String(formData.get("status") ?? "pending") as "active" | "pending");

  await db.insert(members).values({ name, email, categoryId, city, status });
  await logActivity(`Nouvel adhérent ajouté : <strong>${name}</strong>`, "#2C6FB3");

  revalidatePath("/backend/adherents");
  revalidatePath("/backend");
  revalidatePath("/");
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
      status: String(formData.get("status") ?? "pending") as "active" | "pending",
      highlighted: formData.get("highlighted") === "on",
    })
    .where(eq(members.id, id));

  revalidatePath("/backend/adherents");
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

// ---- Sign out ----
export async function doSignOut() {
  await signOut({ redirectTo: "/" });
}
