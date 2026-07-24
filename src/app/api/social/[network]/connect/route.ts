import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import {
  authorizeUrl,
  getDecryptedAppSecret,
  getSocialAccount,
  siteUrl,
  SOCIAL_NETWORKS,
  type SocialNetwork,
} from "@/lib/social-accounts";

export const dynamic = "force-dynamic";

const SETTINGS = "/backend/reseaux";

function back(request: Request, error: string) {
  return NextResponse.redirect(new URL(`${SETTINGS}?error=${encodeURIComponent(error)}`, request.url));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ network: string }> }
) {
  const session = await auth();
  if (!can(session?.user.role, "manageSettings")) {
    return NextResponse.redirect(new URL("/backend", request.url));
  }

  const { network: raw } = await params;
  const network = raw as SocialNetwork;
  if (!SOCIAL_NETWORKS.includes(network)) {
    return back(request, "Réseau inconnu.");
  }

  if (!siteUrl()) {
    return back(
      request,
      "L'URL publique du site n'est pas configurée (NEXT_PUBLIC_SITE_URL) : impossible de construire l'adresse de retour."
    );
  }

  const account = await getSocialAccount(network);
  const appSecret = await getDecryptedAppSecret(network);
  if (!account?.appId || !appSecret) {
    return back(request, "Enregistrez d'abord l'identifiant et le secret de l'application.");
  }

  // `state` en cookie httpOnly : vérifié au retour pour écarter toute requête
  // de rappel forgée.
  const state = randomBytes(24).toString("hex");
  const response = NextResponse.redirect(authorizeUrl(network, account.appId, state));
  response.cookies.set(`plr_oauth_${network}`, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(siteUrl()).protocol === "https:",
    path: "/",
    maxAge: 600,
  });
  return response;
}
