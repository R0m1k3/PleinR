import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import {
  exchangeMailCode,
  getActiveMailAccount,
  getDecryptedAppSecret,
  getMailAccount,
  saveMailConnection,
  setActiveMailProvider,
  MAIL_PROVIDERS,
} from "@/lib/mail-accounts";
import { publicBaseUrl } from "@/lib/social-accounts";
import type { MailProvider } from "@/db/schema";

export const dynamic = "force-dynamic";

const SETTINGS = "/backend/boite-mail";

function back(request: Request, params: Record<string, string>) {
  const url = new URL(SETTINGS, request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = NextResponse.redirect(url);
  // Le state a fait son office, quel que soit le résultat.
  for (const provider of MAIL_PROVIDERS) response.cookies.delete(`plr_mail_oauth_${provider}`);
  return response;
}

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const session = await getSession();
  if (!can(session?.user.role, "manageSettings")) {
    return NextResponse.redirect(new URL("/backend", request.url));
  }

  const { provider: raw } = await params;
  const provider = raw as MailProvider;
  if (!MAIL_PROVIDERS.includes(provider) || provider === "smtp") {
    return back(request, { error: "Fournisseur inconnu." });
  }

  const url = new URL(request.url);
  const failure = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (failure) return back(request, { error: `Autorisation refusée : ${failure}` });

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = request.headers
    .get("cookie")
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`plr_mail_oauth_${provider}=`))
    ?.split("=")[1];

  if (!code || !state || !expected || state !== expected) {
    return back(request, { error: "Requête de retour invalide (state). Relancez la connexion." });
  }

  const account = await getMailAccount(provider);
  const appSecret = await getDecryptedAppSecret(provider);
  if (!account?.appId || !appSecret) {
    return back(request, { error: "Identifiants d'application introuvables." });
  }

  const base = await publicBaseUrl();
  if (!base) return back(request, { error: "Adresse publique du site introuvable." });

  try {
    const result = await exchangeMailCode(provider, account.appId, appSecret, code, base);
    const userId = Number(session?.user.id);
    await saveMailConnection({
      provider,
      ...result,
      connectedById: Number.isFinite(userId) ? userId : null,
    });
    // Première boîte connectée : elle devient l'expéditeur, sinon l'écran
    // afficherait une connexion réussie sans qu'aucun message ne parte. Si un
    // autre fournisseur expédie déjà, on ne le détrône pas dans son dos.
    if (!(await getActiveMailAccount())) await setActiveMailProvider(provider);
    return back(request, { connected: provider });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Échec de la connexion.";
    return back(request, { error: message.slice(0, 400) });
  }
}
