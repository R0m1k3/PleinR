"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activityLog, contactMessages, membershipRequests } from "@/db/schema";

export type SubmitResult = { ok: boolean; error?: string };

const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

async function logActivity(message: string, dot: string) {
  await db.insert(activityLog).values({ message, dot });
}

// ---- Demande pour devenir membre (public, sans authentification) ----
export async function submitMembershipRequest(formData: FormData): Promise<SubmitResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const note = String(formData.get("message") ?? "").trim();

  if (!name) return { ok: false, error: "Le nom est requis." };
  if (email && !isEmail(email)) return { ok: false, error: "Adresse e-mail invalide." };

  // Pas de colonne téléphone dédiée : on l'intègre au message.
  const message = [phone ? `Téléphone : ${phone}` : null, note || null]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);

  await db.insert(membershipRequests).values({
    name,
    email: email || null,
    message: message || null,
    status: "new",
  });

  await logActivity(
    `<strong>${name}</strong> souhaite devenir adhérent`,
    "#9a6638",
  );

  revalidatePath("/backend");
  return { ok: true };
}

// ---- Message via le formulaire de contact (public) ----
export async function submitContactMessage(formData: FormData): Promise<SubmitResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name) return { ok: false, error: "Le nom est requis." };
  if (!isEmail(email)) return { ok: false, error: "Adresse e-mail invalide." };
  if (!message) return { ok: false, error: "Le message est requis." };

  await db.insert(contactMessages).values({
    name,
    email,
    subject: subject ? subject.slice(0, 200) : null,
    message: message.slice(0, 4000),
    status: "new",
  });

  await logActivity(
    `Nouveau message de contact de <strong>${name}</strong>`,
    "#2C6FB3",
  );

  revalidatePath("/backend");
  return { ok: true };
}
