import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

const CHANGE_PW_PATH = "/backend/changer-mot-de-passe";

/**
 * Edge-safe Auth.js configuration (no database / bcrypt imports here).
 * Shared between the middleware (edge runtime) and the full auth instance.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    // 7 jours et non 30 : un jeton dérobé sur un poste partagé vaut d'autant
    // moins longtemps. La révocation immédiate reste assurée par
    // `users.session_version` (src/lib/session.ts).
    maxAge: 7 * 24 * 60 * 60,
  },
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id?: string }).id ?? token.sub;
        token.role = (user as { role?: string }).role;
        token.memberId = (user as { memberId?: number | null }).memberId ?? null;
        token.mustChangePassword =
          (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
        token.sessionVersion = (user as { sessionVersion?: number }).sessionVersion ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? "";
        session.user.role = token.role as
          | "admin"
          | "moderator"
          | "editor"
          | "member";
        session.user.memberId = (token.memberId as number | null) ?? null;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
        // Exposé pour la revalidation en base (src/lib/session.ts).
        session.sessionVersion = Number(token.sessionVersion ?? 0);
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname, origin } = request.nextUrl;
      if (pathname.startsWith("/backend")) {
        if (!isLoggedIn) return false;
        const mustChange = Boolean(
          (auth?.user as { mustChangePassword?: boolean } | undefined)?.mustChangePassword,
        );
        if (mustChange && pathname !== CHANGE_PW_PATH) {
          return NextResponse.redirect(new URL(CHANGE_PW_PATH, origin));
        }
        return true;
      }
      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
