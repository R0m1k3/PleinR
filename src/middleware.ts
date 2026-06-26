import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe auth instance (no providers / db) used only to gate routes.
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  matcher: ["/backend/:path*"],
};
