import type { DefaultSession } from "next-auth";

export type AppRole = "admin" | "moderator" | "editor" | "member";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      memberId: number | null;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
    /** Version du jeton, comparée à la base pour révoquer les sessions. */
    sessionVersion?: number;
  }

  interface User {
    role: AppRole;
    memberId: number | null;
    mustChangePassword?: boolean;
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: AppRole;
    memberId?: number | null;
    mustChangePassword?: boolean;
    sessionVersion?: number;
  }
}
