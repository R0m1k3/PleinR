/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    // Les images d'entête/logo sont envoyées en data-URL via server action.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
