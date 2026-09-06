import Link from "next/link";

const NAV = [
  { key: "accueil", label: "Accueil", href: "/" },
  { key: "annuaire", label: "Annuaire", href: "/annuaire" },
  { key: "promotions", label: "Promotions", href: "/promotions" },
  { key: "association", label: "L'association", href: "/association" },
];

export function SiteHeader({ active, logo = false }: { active?: string; logo?: boolean }) {
  return (
    <header className="container site-header">
      {/* Sur téléphone le logo est toujours visible : c'est le seul retour à
          l'accueil, la page d'accueil ne l'affichant qu'en grand dans le hero. */}
      <Link
        href="/"
        aria-label="Plein R — accueil"
        className={`site-header__brand${logo ? "" : " is-desktop-hidden"}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo.png" alt="Plein R" />
      </Link>

      <nav className="site-header__nav">
        {NAV.map((n) => {
          const isActive = active === n.key;
          return (
            <Link
              key={n.key}
              href={n.href}
              aria-current={isActive ? "page" : undefined}
              className={`site-header__link${isActive ? " is-active" : ""}`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      <Link href="/backend" className="site-header__cta">
        Espace adhérent
      </Link>
    </header>
  );
}
