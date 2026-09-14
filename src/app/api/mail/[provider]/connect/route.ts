import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import {
  getDecryptedAppSecret,
  getMailAccount,
  mailAuthorizeUrl,
  MAIL_PROVIDERS,
} from "@/lib/mail-accounts";
import { publicBaseUrl } from "@/lib/social-accounts";
import type { MailProvider } from "@/db/schema";

export const dynamic = "force-dynamic";

const SETTINGS = "/backend/boite-mail";

function back(request: Request, error: string) {
  return NextResponse.redirect(new URL(`${SETTINGS}?error=${encodeURIComponent(error)}`, request.url));
}

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const session = await getSession();
  if (!can(session?.user.role, "manageSettings")) {
    return NextResponse.redirect(new URL("/backend", request.url));
  }

  const { provider: raw } = await params;
  const provider = raw as MailProvider;
  if (!MAIL_PROVIDERS.includes(provider) || provider === "smtp") {
    return back(request, "Fournisseur inconnu.");
  }

  // Réglage enregistré, sinon l'adresse par laquelle l'administrateur est
  // arrivé : c'est celle où le fournisseur nous renverra.
  const base = await publicBaseUrl();
  if (!base) {
    return back(
      request,
      "Impossible de déterminer l'adresse publique du site : renseignez-la dans Backend › Réseaux sociaux."
    );
  }

  const account = await getMailAccount(provider);
  const appSecret = await getDecryptedAppSecret(provider);
  if (!account?.appId || !appSecret) {
    return back(request, "Enregistrez d'abord l'identifiant et le secret de l'application.");
  }

  // `state` en cookie httpOnly : vérifié au retour pour écarter toute requête
  // de rappel forgée. Aucun jeton ne transite jamais par une URL.
  const state = randomBytes(24).toString("hex");
  const response = NextResponse.redirect(await mailAuthorizeUrl(provider, account.appId, state, base));
  response.cookies.set(`plr_mail_oauth_${provider}`, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(base).protocol === "https:",
    path: "/",
    maxAge: 600,
  });
  return response;
}
