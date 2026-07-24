import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import {
  exchangeCode,
  getDecryptedAppSecret,
  getSocialAccount,
  saveConnection,
  SOCIAL_NETWORKS,
  type SocialNetwork,
} from "@/lib/social-accounts";

export const dynamic = "force-dynamic";

const SETTINGS = "/backend/reseaux";

function back(request: Request, params: Record<string, string>) {
  const url = new URL(SETTINGS, request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = NextResponse.redirect(url);
  // Le state a fait son office, quel que soit le résultat.
  for (const network of SOCIAL_NETWORKS) response.cookies.delete(`plr_oauth_${network}`);
  return response;
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
    return back(request, { error: "Réseau inconnu." });
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (error) {
    return back(request, { error: `Autorisation refusée : ${error}` });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`plr_oauth_${network}=`))
    ?.split("=")[1];

  if (!code || !state || !expected || state !== expected) {
    return back(request, { error: "Requête de retour invalide (state). Relancez la connexion." });
  }

  const account = await getSocialAccount(network);
  const appSecret = await getDecryptedAppSecret(network);
  if (!account?.appId || !appSecret) {
    return back(request, { error: "Identifiants d'application introuvables." });
  }

  try {
    const result = await exchangeCode(network, account.appId, appSecret, code);
    const userId = Number(session?.user.id);

    // Une seule page administrée : on la sélectionne d'office. Sinon on laisse
    // choisir, en conservant le jeton utilisateur le temps de la sélection.
    if (result.targets.length === 1) {
      await saveConnection(network, result, result.targets[0], Number.isFinite(userId) ? userId : null);
      return back(request, { connected: network });
    }

    // Plusieurs pages : on garde le jeton utilisateur, l'écran relistera les
    // cibles côté serveur. Rien de sensible ne transite par l'URL.
    await saveConnection(network, result, null, Number.isFinite(userId) ? userId : null);
    return back(request, { choose: network });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Échec de la connexion.";
    return back(request, { error: message.slice(0, 400) });
  }
}
