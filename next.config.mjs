/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Pas d'en-tête X-Powered-By : inutile de renseigner un attaquant sur la pile.
  poweredByHeader: false,
  experimental: {
    // Les images d'entête/logo sont envoyées en data-URL via server action.
    serverActions: { bodySizeLimit: "4mb" },
  },
  // `instrumentation.ts` est compilé pour les deux runtimes dès qu'un
  // middleware existe. Son chargement du libérateur de publications est déjà
  // conditionné à `NEXT_RUNTIME === "nodejs"`, mais webpack suit quand même
  // l'import et tente d'embarquer `pg` (donc `fs`, `path`, `stream`) dans le
  // bundle edge, où ces modules n'existent pas. On coupe la branche à la
  // source : côté edge, le module Node n'est tout simplement pas résolu.
  webpack: (config, { nextRuntime, webpack }) => {
    if (nextRuntime === "edge") {
      config.plugins.push(
        new webpack.IgnorePlugin({ resourceRegExp: /^\.\/instrumentation-node$/ })
      );
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // HSTS : une fois le site vu en HTTPS, le navigateur refuse le HTTP
          // clair pendant un an. Sans effet tant que le site est servi en HTTP.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Empêche l'interprétation d'une réponse selon un type deviné.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Le site ne doit pas être encadré par un tiers (clickjacking).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // La CSP complète est posée par le middleware : elle a besoin d'un
          // nonce différent à chaque requête, ce qu'une valeur statique ne peut
          // pas fournir.
        ],
      },
    ];
  },
};

export default nextConfig;
