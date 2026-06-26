import type { NextAuthConfig } from "next-auth";

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
  },
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id?: string }).id ?? token.sub;
        token.role = (user as { role?: string }).role;
        token.memberId = (user as { memberId?: number | null }).memberId ?? null;
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
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/backend")) {
        return isLoggedIn;
      }
      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
