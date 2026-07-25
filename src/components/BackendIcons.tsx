import type { ReactNode } from "react";

/**
 * Icônes de la navigation d'administration. Les anciens carrés / ronds /
 * losanges ne portaient aucun sens : une icône par rubrique rend le menu
 * lisible d'un coup d'œil.
 */
export type BackendIconName =
  | "dashboard"
  | "members"
  | "inbox"
  | "promos"
  | "meetings"
  | "registrations"
  | "gallery"
  | "emails"
  | "social"
  | "categories"
  | "settings"
  | "admins"
  | "space"
  | "menu"
  | "close";

const PATHS: Record<BackendIconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </>
  ),
  members: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.8 20c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6" />
      <path d="M16.4 5.2a3.2 3.2 0 0 1 0 6M18 14.8c2 .7 3.2 2.4 3.2 5.2" />
    </>
  ),
  inbox: (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m4 6.5 8 6 8-6" />
    </>
  ),
  promos: (
    <>
      <path d="M11.6 2.8H20a1.2 1.2 0 0 1 1.2 1.2v8.4a1.6 1.6 0 0 1-.5 1.1l-7.4 7.4a1.6 1.6 0 0 1-2.3 0l-7-7a1.6 1.6 0 0 1 0-2.3l7.4-7.4a1.6 1.6 0 0 1 1.1-.5Z" />
      <circle cx="16.6" cy="7.4" r="1.4" />
    </>
  ),
  meetings: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 9.5h18M8 3v4M16 3v4" />
    </>
  ),
  registrations: (
    <>
      <path d="M8 4.5H6.5A2.5 2.5 0 0 0 4 7v12a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 19V7a2.5 2.5 0 0 0-2.5-2.5H16" />
      <rect x="8" y="2.5" width="8" height="4" rx="1.4" />
      <path d="m8.6 12.4 1.7 1.7 3.4-3.4M8.6 17.2h6.8" />
    </>
  ),
  gallery: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.6" cy="9.6" r="1.7" />
      <path d="m4 17 4.8-4.4a1.8 1.8 0 0 1 2.4 0L16 17M14 14.4l1.6-1.5a1.8 1.8 0 0 1 2.4 0L21 15.6" />
    </>
  ),
  emails: (
    <>
      <path d="M20.5 3.5 10.8 13.2M20.5 3.5 14.3 21l-3.5-7.8L3 9.7l17.5-6.2Z" />
    </>
  ),
  social: (
    <>
      <circle cx="18" cy="5.4" r="2.9" />
      <circle cx="6" cy="12" r="2.9" />
      <circle cx="18" cy="18.6" r="2.9" />
      <path d="m8.5 10.6 7-3.8M8.5 13.4l7 3.8" />
    </>
  ),
  categories: (
    <>
      <rect x="3" y="3.5" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13" width="7.5" height="7.5" rx="2" />
      <circle cx="17.2" cy="7.2" r="3.8" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2.4" />
      <circle cx="8" cy="17" r="2.4" />
    </>
  ),
  admins: (
    <>
      <path d="M12 2.6 4.5 5.8V11c0 4.7 3.1 8.6 7.5 10.4 4.4-1.8 7.5-5.7 7.5-10.4V5.8L12 2.6Z" />
      <path d="m8.8 11.8 2.2 2.2 4.2-4.2" />
    </>
  ),
  space: (
    <>
      <circle cx="12" cy="8.2" r="3.6" />
      <path d="M4.8 20.4c0-3.7 3.2-6 7.2-6s7.2 2.3 7.2 6" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
};

export function BackendIcon({ name, size = 18 }: { name: BackendIconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0 }}
    >
      {PATHS[name]}
    </svg>
  );
}
