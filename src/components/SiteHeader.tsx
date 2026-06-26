import Link from "next/link";

const NAV = [
  { key: "accueil", label: "Accueil", href: "/" },
  { key: "annuaire", label: "Annuaire", href: "/annuaire" },
  { key: "promotions", label: "Promotions", href: "/#promotions" },
  { key: "association", label: "L'association", href: "#" },
];

export function SiteHeader({ active }: { active?: string }) {
  return (
    <header
      className="container"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        padding: "18px 56px",
        gap: 20,
      }}
    >
      <nav style={{ display: "flex", alignItems: "center", gap: 30, flexWrap: "wrap" }}>
        {NAV.map((n) => {
          const isActive = active === n.key;
          return (
            <Link
              key={n.key}
              href={n.href}
              style={{
                textDecoration: "none",
                color: isActive ? "#3c3322" : "#6f6450",
                fontWeight: isActive ? 600 : 500,
                fontSize: 15,
              }}
            >
              {n.label}
            </Link>
          );
        })}
        <Link
          href="/backend"
          style={{
            textDecoration: "none",
            color: "#fff",
            background: "#9a6638",
            fontWeight: 600,
            fontSize: 14.5,
            padding: "10px 18px",
            borderRadius: 999,
          }}
        >
          Espace adhérent
        </Link>
      </nav>
    </header>
  );
}
