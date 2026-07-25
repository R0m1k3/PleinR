"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BackendIcon, type BackendIconName } from "@/components/BackendIcons";
import { can, ROLE_LABELS } from "@/lib/rbac";
import type { AppRole } from "@/types/next-auth";
import { doSignOut } from "./actions";

const TITLES: Record<string, [string, string]> = {
  "/backend": ["Tableau de bord", "Vue d'ensemble de l'association"],
  "/backend/adherents": ["Adhérents", "Gérer les commerçants et entreprises"],
  "/backend/demandes": ["Demandes & messages", "Demandes d'adhésion et messages de contact"],
  "/backend/promotions": [
    "Modération des promotions",
    "Validez les offres soumises par les adhérents",
  ],
  "/backend/rencontres": ["Rencontres", "Gérer les prochaines dates"],
  "/backend/inscriptions": ["Inscriptions", "Gérer les participants aux rencontres"],
  "/backend/rencontres-passees": ["Rencontres passées", "Publier les archives et leurs photos"],
  "/backend/emails": ["Création d'e-mails", "Composer des messages aux couleurs de Plein R"],
  "/backend/reseaux": ["Réseaux sociaux", "Connecter les pages Facebook et LinkedIn"],
  "/backend/administrateurs": ["Administrateurs", "Gérer les accès à l'administration"],
  "/backend/categories": ["Catégories", "Gérer les métiers de l'annuaire"],
  "/backend/parametres": ["Paramètres du site", "Configurer l'association et les mentions légales"],
  "/backend/espace": ["Mon espace adhérent", "Publiez et suivez vos promotions"],
  "/backend/changer-mot-de-passe": ["Mot de passe", "Sécurisez votre compte"],
};

type Capability = Parameters<typeof can>[1];
type BadgeKey = "inbox" | "promos";

type NavItem = {
  href: string;
  label: string;
  icon: BackendIconName;
  capability?: Capability;
  badge?: BadgeKey;
  /** Les fiches adhérent sont des sous-routes : l'entrée doit rester active. */
  prefix?: boolean;
};

type NavSection = { label: string; items: NavItem[] };

/**
 * Menu groupé par usage plutôt qu'en une seule pile : on distingue le quotidien
 * (réseau, rencontres) de ce qu'on ne touche qu'occasionnellement (configuration).
 */
const SECTIONS: NavSection[] = [
  {
    label: "Pilotage",
    items: [{ href: "/backend", label: "Tableau de bord", icon: "dashboard", capability: "viewDashboard" }],
  },
  {
    label: "Vie du réseau",
    items: [
      { href: "/backend/adherents", label: "Adhérents", icon: "members", capability: "manageMembers", prefix: true },
      { href: "/backend/demandes", label: "Demandes & messages", icon: "inbox", capability: "manageMembers", badge: "inbox" },
      { href: "/backend/promotions", label: "Promotions", icon: "promos", capability: "moderatePromos", badge: "promos" },
    ],
  },
  {
    label: "Rencontres",
    items: [
      { href: "/backend/rencontres", label: "Prochaines dates", icon: "meetings", capability: "manageMeetings" },
      { href: "/backend/inscriptions", label: "Inscriptions", icon: "registrations", capability: "manageMeetings" },
      { href: "/backend/rencontres-passees", label: "Archives & photos", icon: "gallery", capability: "manageMeetings" },
    ],
  },
  {
    label: "Communication",
    items: [
      { href: "/backend/emails", label: "E-mails", icon: "emails", capability: "manageEmails" },
      { href: "/backend/reseaux", label: "Réseaux sociaux", icon: "social", capability: "manageSettings" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/backend/categories", label: "Catégories", icon: "categories", capability: "manageCategories" },
      { href: "/backend/parametres", label: "Paramètres du site", icon: "settings", capability: "manageSettings" },
      { href: "/backend/administrateurs", label: "Administrateurs", icon: "admins", capability: "manageAdmins" },
    ],
  },
  {
    label: "Côté adhérent",
    items: [{ href: "/backend/espace", label: "Mon espace", icon: "space" }],
  },
];

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Badge({ value }: { value: number }) {
  return (
    <span
      style={{
        marginLeft: "auto",
        background: "#E0A63C",
        color: "#33291D",
        fontSize: 11,
        fontWeight: 800,
        borderRadius: 999,
        padding: "1px 8px",
      }}
    >
      {value}
    </span>
  );
}

export function BackendShell({
  user,
  pendingCount,
  inboxCount = 0,
  children,
}: {
  user: { name: string; role: AppRole };
  pendingCount: number;
  inboxCount?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const [title, sub] =
    TITLES[pathname] ??
    (pathname.startsWith("/backend/adherents")
      ? TITLES["/backend/adherents"]
      : ["Administration", "Plein R"]);

  // Le tiroir se referme dès qu'on navigue.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Pas de défilement de la page derrière le tiroir ouvert.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const badges: Record<BadgeKey, number> = { inbox: inboxCount, promos: pendingCount };

  const sections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.capability || can(user.role, item.capability)),
  })).filter((section) => section.items.length > 0);

  const siteLink = (
    <Link href="/" className="backend-action">
      ← Voir le site
    </Link>
  );
  const signOut = (
    <form action={doSignOut}>
      <button type="submit" className="backend-action backend-action--strong">
        Déconnexion
      </button>
    </form>
  );

  return (
    <div className="backend" style={{ fontFamily: "'Public Sans',sans-serif", color: "#33291D" }}>
      {menuOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="sidebar-backdrop"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`sidebar${menuOpen ? " is-open" : ""}`} id="backend-nav">
        <div className="sidebar-brand">
          <span style={{ display: "inline-flex", background: "#F6F2E8", borderRadius: 11, padding: 6 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo.png" alt="Plein R" style={{ height: 34, width: "auto", display: "block" }} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="font-display" style={{ fontWeight: 800, fontSize: 17, color: "#fff", lineHeight: 1 }}>
              Plein R
            </div>
            <div style={{ fontSize: 11, color: "#7f9bb4", marginTop: 3 }}>Administration</div>
          </div>
          <button
            type="button"
            className="sidebar-close"
            aria-label="Fermer le menu"
            onClick={() => setMenuOpen(false)}
          >
            <BackendIcon name="close" size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {sections.map((section) => (
            <div key={section.label}>
              <div className="sidebar-section">{section.label}</div>
              {section.items.map((item) => {
                const active = item.prefix ? pathname.startsWith(item.href) : pathname === item.href;
                const badge = item.badge ? badges[item.badge] : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-btn${active ? " active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <BackendIcon name={item.icon} />
                    {item.label}
                    {item.badge && badge > 0 && <Badge value={badge} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-user">
          <span
            className="font-display"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#E0A63C",
              color: "#33291D",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            {initialsOf(user.name)}
          </span>
          <div style={{ lineHeight: 1.2, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user.name}
            </div>
            <div style={{ fontSize: 11, color: "#7f9bb4" }}>{ROLE_LABELS[user.role]}</div>
          </div>
        </div>

        {/* Sur téléphone, l'entête n'a pas la place : les actions vivent ici. */}
        <div className="sidebar-actions">
          {siteLink}
          {signOut}
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header className="backend-header">
          <button
            type="button"
            className="backend-burger"
            aria-label="Ouvrir le menu"
            aria-expanded={menuOpen}
            aria-controls="backend-nav"
            onClick={() => setMenuOpen(true)}
          >
            <BackendIcon name="menu" size={22} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="font-display backend-header__title">{title}</h1>
            <div className="backend-header__sub">{sub}</div>
          </div>
          <div className="backend-header__actions">
            {siteLink}
            {signOut}
          </div>
        </header>

        <div className="backend-content">{children}</div>
      </main>
    </div>
  );
}
