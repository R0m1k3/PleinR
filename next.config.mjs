/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    // Les images d'entête/logo sont envoyées en data-URL via server action.
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Empêche l'interprétation d'une réponse selon un type deviné.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Le site ne doit pas être encadré par un tiers (clickjacking).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // frame-ancestors double X-Frame-Options pour les navigateurs récents.
          // Une CSP complète (script-src) demanderait des nonces sur les scripts
          // d'hydratation de Next : à traiter séparément.
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
