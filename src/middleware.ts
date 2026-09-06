import { NextResponse, type NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe auth instance (no providers / db) used only to gate routes.
// The redirect target is derived from AUTH_URL (set it to your public URL when
// running behind a reverse proxy, e.g. AUTH_URL=https://pleinr.ffnancy.fr).
const { auth } = NextAuth(authConfig);

/**
 * Politique de sécurité du contenu, avec un nonce par requête.
 *
 * Next signe ses propres scripts d'hydratation avec le nonce lu dans l'en-tête
 * CSP de la requête : c'est ce qui permet d'interdire les scripts en ligne sans
 * casser l'application.
 *
 * `style-src` garde 'unsafe-inline' : tout le design repose sur des attributs
 * `style` et sur la feuille Google Fonts. C'est un compromis assumé — une
 * injection de style est sans commune mesure avec une injection de script.
 */
function contentSecurityPolicy(nonce: string, isDev: boolean, isHttps: boolean): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    // 'strict-dynamic' laisse les scripts chargés par un script de confiance
    // s'exécuter ; en développement Next a besoin d'eval pour le rafraîchissement.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ""}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // data: pour les images stockées en data-URI, https: pour les vignettes distantes.
    "img-src 'self' data: https:",
    "connect-src 'self'",
    // Carte « Nous situer » de la fiche adhérent.
    "frame-src https://www.google.com https://maps.google.com",
    // Uniquement quand la page est servie en HTTPS : sur une page HTTP (test
    // par IP avant la pose du DNS, accès direct au port), le navigateur
    // basculerait toutes les navigations vers un https:// inexistant.
    isHttps ? "upgrade-insecure-requests" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export default auth((request: NextRequest) => {
  // `btoa` et non `Buffer` : le middleware tourne sur le runtime Edge.
  const nonce = btoa(crypto.randomUUID());
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isHttps = forwardedProto ? forwardedProto === "https" : request.nextUrl.protocol === "https:";
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV !== "production", isHttps);

  // L'en-tête est posé sur la REQUÊTE : Next y lit le nonce pour l'appliquer à
  // ses balises <script>. Il est ensuite renvoyé sur la réponse au navigateur.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}) as unknown as (request: NextRequest) => Response | Promise<Response>;

export const config = {
  // La CSP doit couvrir toutes les pages, pas seulement /backend. On exclut les
  // ressources statiques, qui n'ont pas besoin d'être traitées.
  matcher: ["/((?!_next/static|_next/image|assets|favicon.ico).*)"],
};
