import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo";

// La page de connexion est un composant client : ses métadonnées vivent ici.
export const metadata: Metadata = {
  title: "Connexion à l'espace adhérent",
  robots: NOINDEX,
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
