import type { AppRole } from "@/types/next-auth";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrateur",
  moderator: "Modérateur",
  editor: "Éditeur",
  member: "Adhérent",
};

export const LABEL_TO_ROLE: Record<string, AppRole> = {
  Administrateur: "admin",
  Modérateur: "moderator",
  Éditeur: "editor",
  Adhérent: "member",
};

type Capability =
  | "viewDashboard"
  | "manageMembers"
  | "moderatePromos"
  | "publishSocial"
  | "manageAdmins"
  | "manageCategories"
  | "manageMeetings"
  | "manageEmails"
  | "manageSettings"
  | "memberSpace";

const CAPABILITIES: Record<AppRole, Capability[]> = {
  admin: [
    "viewDashboard",
    "manageMembers",
    "moderatePromos",
    "publishSocial",
    "manageAdmins",
    "manageCategories",
    "manageMeetings",
    "manageEmails",
    "manageSettings",
    "memberSpace",
  ],
  moderator: [
    "viewDashboard",
    "manageMembers",
    "moderatePromos",
    "publishSocial",
    "manageMeetings",
  ],
  editor: ["viewDashboard", "manageMembers"],
  member: ["memberSpace"],
};

export function can(role: AppRole | undefined, capability: Capability): boolean {
  if (!role) return false;
  return CAPABILITIES[role]?.includes(capability) ?? false;
}

export const STAFF_ROLES: AppRole[] = ["admin", "moderator", "editor"];

export function isStaff(role: AppRole | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}
