import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { AppRole } from "@/types/next-auth";

/**
 * Session revalidée en base à chaque requête.
 *
 * Auth.js fige le rôle dans le jeton JWT : sans cette relecture, supprimer un
 * administrateur ou le rétrograder ne coupait pas sa session en cours, qui
 * restait valide jusqu'à expiration. On relit donc l'utilisateur à chaque appel
 * et on refuse le jeton si le compte a disparu ou si sa version de session a
 * changé (mot de passe modifié ou réinitialisé).
 */

export type AppSession = {
  user: {
    id: string;
    name: string;
    email: string;
    role: AppRole;
    memberId: number | null;
    mustChangePassword: boolean;
  };
};

export async function getSession(): Promise<AppSession | null> {
  const session = await auth();
  const rawId = session?.user?.id;
  if (!rawId) return null;

  const userId = Number(rawId);
  if (!Number.isFinite(userId)) return null;

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  // Compte supprimé : le jeton ne vaut plus rien.
  if (!user) return null;

  const tokenVersion = Number(
    (session as { sessionVersion?: number }).sessionVersion ?? 0
  );
  if ((user.sessionVersion ?? 0) !== tokenVersion) return null;

  // Le rôle et le rattachement adhérent viennent de la base, jamais du jeton.
  return {
    user: {
      id: String(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      memberId: user.memberId,
      mustChangePassword: user.mustChangePassword,
    },
  };
}
