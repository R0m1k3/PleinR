import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe auth instance (no providers / db) used only to gate routes.
// The redirect target is derived from AUTH_URL (set it to your public URL when
// running behind a reverse proxy, e.g. AUTH_URL=https://pleinr.ffnancy.fr).
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  matcher: ["/backend/:path*"],
};
