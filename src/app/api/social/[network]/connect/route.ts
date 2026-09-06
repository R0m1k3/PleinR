import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import {
  authorizeUrl,
  getDecryptedAppSecret,
  getSocialAccount,
  publicBaseUrl,
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
  const session = await getSession();
  if (!can(session?.user.role, "manageSettings")) {
    return NextResponse.redirect(new URL("/backend", request.url));
  }

  const { network: raw } = await params;
  const network = raw as SocialNetwork;
  if (!SOCIAL_NETWORKS.includes(network)) {
    return back(request, "Réseau inconnu.");
  }

  // Réglage enregistré, sinon l'adresse par laquelle l'administrateur est
  // arrivé : c'est celle où le réseau nous renverra.
  const base = await publicBaseUrl();
  if (!base) {
    return back(
      request,
      "Impossible de déterminer l'adresse publique du site : renseignez-la dans la section « URL publique du site »."
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
  const response = NextResponse.redirect(await authorizeUrl(network, account.appId, state));
  response.cookies.set(`plr_oauth_${network}`, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(base).protocol === "https:",
    path: "/",
    maxAge: 600,
  });
  return response;
}
