import type { components } from "@/lib/api/schema";

export type UserRole = components["schemas"]["UserRole"];
export type UserProfile = components["schemas"]["UserResponse"];

/** Landing screen per role. Brand and platform homes come from `scopeHome`. */
const ROLE_HOME: Record<UserRole, string> = {
  SUPER_ADMIN: "/app/brands",
  BRAND_ADMIN: "/app/brands",
  REGIONAL_MANAGER: "/app/floor",
  BRANCH_ADMIN: "/app/floor",
  CASHIER: "/app/pos",
  WAITER: "/app/floor",
  RUNNER: "/app/floor",
  KITCHEN_STAFF: "/app/kds",
};

export function roleHome(role: UserRole): string {
  return ROLE_HOME[role];
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && value in ROLE_HOME;
}

/**
 * Invitation matrix. Mirrors the API (`invitation_service.py`), which stays
 * the authority: a 403 from the API is shown as-is if this drifts.
 */
const OPERATIONAL_ROLES = ["CASHIER", "WAITER", "KITCHEN_STAFF", "RUNNER"] as const satisfies readonly UserRole[];

const INVITABLE: Partial<Record<UserRole, readonly UserRole[]>> = {
  SUPER_ADMIN: ["BRAND_ADMIN", "REGIONAL_MANAGER", "BRANCH_ADMIN", ...OPERATIONAL_ROLES],
  BRAND_ADMIN: ["BRANCH_ADMIN", "REGIONAL_MANAGER", ...OPERATIONAL_ROLES],
  BRANCH_ADMIN: [...OPERATIONAL_ROLES],
};

export const INVITER_ROLES = Object.keys(INVITABLE) as UserRole[];

export function invitableRoles(actor: UserRole): readonly UserRole[] {
  return INVITABLE[actor] ?? [];
}

/** Roles that must be attached to a branch (the API requires `branch_id`). */
export function isBranchScopedRole(role: UserRole): boolean {
  return role === "BRANCH_ADMIN" || (OPERATIONAL_ROLES as readonly UserRole[]).includes(role);
}

export function roleLabel(role: UserRole): string {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
