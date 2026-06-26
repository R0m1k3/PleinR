import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plein R — Commerçants & entreprises du Bassin de Pompey",
  description:
    "Association des commerçants et entreprises du Bassin de Pompey. Réseau · Rencontre · Réussite.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Public+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/assets/logo.png" type="image/png" />
        {/* Fallback: if JS is disabled, never keep revealed content hidden. */}
        <noscript>
          <style>{`.reveal,.reveal-stagger>*{opacity:1!important}`}</style>
        </noscript>
      </head>
      <body>{children}</body>
    </html>
  );
}
