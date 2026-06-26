"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/backend",
    });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      return "E-mail ou mot de passe incorrect.";
    }
    // Re-throw redirect (and any other) errors so navigation works.
    throw error;
  }
}
