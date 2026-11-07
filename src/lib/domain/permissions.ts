/**
 * Permissions fines du personnel. Les acheteurs et vendeurs n'ont pas de rôle : leurs
 * droits portent sur leurs propres ressources et sont vérifiés objet par objet dans
 * les services (anti-IDOR/BOLA). Les permissions ci-dessous ne concernent que le
 * back-office. Un agent du support n'a pas les droits financiers d'un administrateur.
 */
export const STAFF_ROLES = ["MODERATOR", "SUPPORT", "FINANCE", "ADMIN", "SUPER_ADMIN"] as const;
export type StaffRoleName = (typeof STAFF_ROLES)[number];

export const PERMISSIONS = [
  "admin.access",
  "stats.read",
  "users.read",
  "users.suspend",
  "users.ban",
  "users.roles.assign",
  "listings.read_all",
  "listings.moderate",
  "reports.handle",
  "messages.read_for_moderation",
  "reviews.moderate",
  "orders.read",
  "orders.manage",
  "disputes.manage",
  "disputes.resolve",
  "payments.read",
  "payments.refund",
  "payouts.manage",
  "finance.export",
  "transport.read",
  "transport.manage",
  "settings.read",
  "settings.write",
  "fees.write",
  "flags.write",
  "compliance.write",
  "audit.read",
  "api_clients.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = PERMISSIONS;

export const ROLE_PERMISSIONS: Record<StaffRoleName, readonly Permission[]> = {
  MODERATOR: [
    "admin.access",
    "users.read",
    "users.suspend",
    "listings.read_all",
    "listings.moderate",
    "reports.handle",
    "messages.read_for_moderation",
    "reviews.moderate",
  ],
  SUPPORT: [
    "admin.access",
    "users.read",
    "listings.read_all",
    "reports.handle",
    "orders.read",
    "orders.manage",
    "disputes.manage",
    "disputes.resolve",
    "transport.read",
  ],
  FINANCE: [
    "admin.access",
    "stats.read",
    "orders.read",
    "payments.read",
    "payments.refund",
    "payouts.manage",
    "finance.export",
    "transport.read",
  ],
  ADMIN: ALL.filter((p) => p !== "api_clients.manage" && p !== "compliance.write"),
  SUPER_ADMIN: ALL,
};

export function permissionsFor(roles: readonly string[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const role of roles) for (const p of ROLE_PERMISSIONS[role as StaffRoleName] ?? []) set.add(p);
  return set;
}

export function hasPermission(roles: readonly string[], permission: Permission): boolean {
  return permissionsFor(roles).has(permission);
}

export function isStaff(roles: readonly string[]): boolean {
  return hasPermission(roles, "admin.access");
}

/** Rôles qu'un membre du personnel peut attribuer : seul un super-administrateur gère les administrateurs. */
export function assignableRoles(actorRoles: readonly string[]): StaffRoleName[] {
  if (actorRoles.includes("SUPER_ADMIN")) return [...STAFF_ROLES];
  if (actorRoles.includes("ADMIN")) return ["MODERATOR", "SUPPORT", "FINANCE"];
  return [];
}
