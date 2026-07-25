import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authConfig } from "@/auth.config";
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from "@/lib/login-throttle";

// Empreinte bcrypt d'une valeur quelconque : sert de comparaison factice quand
// l'adresse n'existe pas, pour que le temps de réponse reste identique.
const ABSENT_USER_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .toLowerCase()
          .trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        if (isLoginBlocked(email)) return null;

        const rows = await db.select().from(users).where(eq(users.email, email));
        const user = rows[0];

        // Comparaison menée même sans compte correspondant : sans cela, le
        // temps de réponse révélerait quelles adresses existent.
        const hash = user?.passwordHash ?? ABSENT_USER_HASH;
        const valid = await bcrypt.compare(password, hash);

        if (!user || !valid) {
          recordLoginFailure(email);
          return null;
        }

        clearLoginFailures(email);

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
          memberId: user.memberId,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
});
