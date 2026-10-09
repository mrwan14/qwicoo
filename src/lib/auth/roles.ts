import type { components } from "@/lib/api/schema";
import { currentLocale } from "@/lib/i18n/locale-store";
import type { LocaleCode } from "@/lib/i18n/locale-text";
import { commonCopy } from "@/lib/i18n/staff/common";

export type UserRole = components["schemas"]["UserRole"];
export type UserProfile = components["schemas"]["UserResponse"];

/** Landing screen per role. Brand and platform homes come from `scopeHome`. */
const ROLE_HOME: Record<UserRole, string> = {
  SUPER_ADMIN: "/app/brands",
  BRAND_ADMIN: "/app/brands",
  REGIONAL_MANAGER: "/app/menu",
  BRANCH_ADMIN: "/app/floor",
  CASHIER: "/app/pos",
  WAITER: "/app/floor",
  RUNNER: "/app/kds/expo",
  KITCHEN_STAFF: "/app/kds",
};

export function roleHome(role: UserRole): string {
  return ROLE_HOME[role];
}

/** Roles that may open Ask Qwicoo. Operational roles are intentionally absent. */
export const ASSISTANT_ROLES = ["SUPER_ADMIN", "BRAND_ADMIN", "REGIONAL_MANAGER", "BRANCH_ADMIN"] as const satisfies readonly UserRole[];

export function canAskQwicoo(role: UserRole): boolean {
  return (ASSISTANT_ROLES as readonly UserRole[]).includes(role);
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

export function roleLabel(role: UserRole, locale?: LocaleCode): string {
  return commonCopy[locale ?? currentLocale()].roles[role] ?? role;
}
