"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
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
  "/backend/administrateurs": ["Administrateurs", "Gérer les accès à l'administration"],
  "/backend/categories": ["Catégories", "Gérer les métiers de l'annuaire"],
  "/backend/espace": ["Mon espace adhérent", "Publiez et suivez vos promotions"],
  "/backend/changer-mot-de-passe": ["Mot de passe", "Sécurisez votre compte"],
};

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`nav-btn${active ? " active" : ""}`}>
      {children}
    </Link>
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
  const [title, sub] =
    TITLES[pathname] ??
    (pathname.startsWith("/backend/adherents")
      ? TITLES["/backend/adherents"]
      : ["Administration", "Plein R"]);

  const dot = (
    <span style={{ width: 18, height: 18, border: "2px solid currentColor", borderRadius: 5, display: "inline-block" }} />
  );
  const dotRound = (
    <span style={{ width: 18, height: 18, border: "2px solid currentColor", borderRadius: "50%", display: "inline-block" }} />
  );
  const dotDiamond = (
    <span style={{ width: 18, height: 18, border: "2px solid currentColor", borderRadius: 5, display: "inline-block", transform: "rotate(45deg)" }} />
  );

  return (
    <div className="backend" style={{ fontFamily: "'Public Sans',sans-serif", color: "#33291D" }}>
      {/* sidebar */}
      <aside className="sidebar">
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "6px 8px 22px" }}>
          <span style={{ display: "inline-flex", background: "#F6F2E8", borderRadius: 11, padding: 6 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo.png" alt="Plein R" style={{ height: 34, width: "auto", display: "block" }} />
          </span>
          <div>
            <div className="font-display" style={{ fontWeight: 800, fontSize: 17, color: "#fff", lineHeight: 1 }}>
              Plein R
            </div>
            <div style={{ fontSize: 11, color: "#7f9bb4", marginTop: 3 }}>Administration</div>
          </div>
        </div>

        <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", minWidth: 200 }}>
          {can(user.role, "viewDashboard") && (
            <>
              <div style={sectionLabel}>Pilotage</div>
              <NavLink href="/backend" active={pathname === "/backend"}>
                {dot}Tableau de bord
              </NavLink>
              {can(user.role, "manageMembers") && (
                <NavLink href="/backend/adherents" active={pathname.startsWith("/backend/adherents")}>
                  {dotRound}Adhérents
                </NavLink>
              )}
              {can(user.role, "manageMembers") && (
                <NavLink href="/backend/demandes" active={pathname === "/backend/demandes"}>
                  {dot}Demandes &amp; messages
                  {inboxCount > 0 && (
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
                      {inboxCount}
                    </span>
                  )}
                </NavLink>
              )}
              {can(user.role, "moderatePromos") && (
                <NavLink href="/backend/promotions" active={pathname === "/backend/promotions"}>
                  {dotDiamond}Promotions
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
                    {pendingCount}
                  </span>
                </NavLink>
              )}
              {can(user.role, "manageCategories") && (
                <NavLink href="/backend/categories" active={pathname === "/backend/categories"}>
                  {dotDiamond}Catégories
                </NavLink>
              )}
              {can(user.role, "manageAdmins") && (
                <NavLink href="/backend/administrateurs" active={pathname === "/backend/administrateurs"}>
                  {dot}Administrateurs
                </NavLink>
              )}
            </>
          )}

          <div style={sectionLabel}>Côté adhérent</div>
          <NavLink href="/backend/espace" active={pathname === "/backend/espace"}>
            {dotRound}Mon espace
          </NavLink>
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: 11,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 12,
            padding: "11px 12px",
          }}
        >
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
      </aside>

      {/* main */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 32px",
            background: "#F6F2E8",
            borderBottom: "1px solid #e2d6bd",
            position: "sticky",
            top: 0,
            zIndex: 5,
            gap: 16,
          }}
        >
          <div>
            <h1 className="font-display" style={{ fontWeight: 800, fontSize: 22, margin: 0, color: "#26201a" }}>
              {title}
            </h1>
            <div style={{ fontSize: 13, color: "#9a8d72", marginTop: 2 }}>{sub}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link
              href="/"
              style={{
                textDecoration: "none",
                fontSize: 13.5,
                fontWeight: 600,
                color: "#6f6450",
                border: "1px solid #d8cdb4",
                padding: "9px 15px",
                borderRadius: 10,
              }}
            >
              ← Voir le site
            </Link>
            <form action={doSignOut}>
              <button
                type="submit"
                style={{
                  background: "#fff",
                  border: "1px solid #d8cdb4",
                  color: "#9a6638",
                  fontSize: 13.5,
                  fontWeight: 700,
                  padding: "9px 15px",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                Déconnexion
              </button>
            </form>
          </div>
        </header>

        <div style={{ padding: "28px 32px 44px", flex: 1 }}>{children}</div>
      </main>
    </div>
  );
}

const sectionLabel = {
  fontSize: 10.5,
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  color: "#5f7d97",
  fontWeight: 700,
  padding: "20px 10px 8px",
};
