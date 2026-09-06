import Link from "next/link";

function initialsOf(name: string) {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const TABS = [
  { key: "profil", href: "/backend/espace", label: "Mon profil" },
  { key: "promotions", href: "/backend/espace/promotions", label: "Mes promotions" },
] as const;

export type EspaceTab = (typeof TABS)[number]["key"];

/**
 * Bandeau de l'espace adhérent et onglets Profil / Promotions : deux pages
 * distinctes pour que la fiche publique et la vie des promotions ne se
 * mélangent pas dans une seule longue page.
 */
export function EspaceHeader({
  memberName,
  subtitle,
  active,
  publicPath,
  promoBadge,
}: {
  memberName: string;
  subtitle: string;
  active: EspaceTab;
  publicPath?: string | null;
  /** Nombre de promotions en ligne, affiché sur l'onglet. */
  promoBadge?: number;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ background: "#13324F", borderRadius: "16px 16px 0 0", padding: "20px 24px", display: "flex", alignItems: "center", gap: 15, flexWrap: "wrap" }}>
        <span className="font-display" style={{ width: 46, height: 46, borderRadius: 12, background: "#E0A63C", color: "#33291D", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
          {initialsOf(memberName)}
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="font-display" style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>{memberName}</div>
          <div style={{ fontSize: 13, color: "#9bb6cd" }}>{subtitle}</div>
        </div>
        {publicPath && (
          <Link href={publicPath} target="_blank" style={{ color: "#fff", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
            Voir ma fiche publique ↗
          </Link>
        )}
      </div>
      <nav className="espace-tabs" aria-label="Sections de l'espace adhérent">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link key={tab.key} href={tab.href} className={`espace-tab${isActive ? " active" : ""}`} aria-current={isActive ? "page" : undefined}>
              {tab.label}
              {tab.key === "promotions" && promoBadge ? <span className="espace-tab__badge">{promoBadge}</span> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
