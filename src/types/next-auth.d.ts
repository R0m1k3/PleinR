import type { DefaultSession } from "next-auth";

export type AppRole = "admin" | "moderator" | "editor" | "member";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      memberId: number | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppRole;
    memberId: number | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: AppRole;
    memberId?: number | null;
  }
}
