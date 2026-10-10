/**
 * Menu admin capability matrix (mirrors backend staff menu + catalog RBAC).
 * Hide controls the role cannot use; do not rely on 403s.
 */

import type { UserRole } from "@/lib/auth/roles";
import type { components } from "@/lib/api/schema";

export type MenuItemScope = components["schemas"]["MenuItemScope"];

export type MenuItemFlags = {
  /** From branch menu when available; brand catalog is typically ALL_BRANCHES with a brand_id. */
  scope?: MenuItemScope | null;
  /** True when the item belongs to the brand catalog (not a branch-only staff item). */
  brandCatalog?: boolean;
};

const MENU_ADMIN_ROLES: ReadonlySet<UserRole> = new Set(["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN"]);

export function canOpenMenuAdmin(role: UserRole | null | undefined): boolean {
  return Boolean(role && MENU_ADMIN_ROLES.has(role));
}

export function canManageStations(role: UserRole | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "BRAND_ADMIN" || role === "BRANCH_ADMIN";
}

export function canAddCategory(role: UserRole | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "BRAND_ADMIN" || role === "BRANCH_ADMIN";
}

export function canAddItem(role: UserRole | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "BRAND_ADMIN" || role === "BRANCH_ADMIN";
}

/** Brand admins choose catalog scope; branch admins only create branch-local items. */
export function canChooseItemScope(role: UserRole | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "BRAND_ADMIN";
}

export function isBrandCatalogItem(flags: MenuItemFlags | null | undefined): boolean {
  if (!flags) return false;
  if (flags.brandCatalog === true) return true;
  if (flags.brandCatalog === false) return false;
  // Prefer explicit scope when the tree/API exposes it.
  return flags.scope === "ALL_BRANCHES";
}

/** Structural edit: name, delete, modifiers, base catalog price. */
export function canEditItemStructure(role: UserRole | null | undefined, flags?: MenuItemFlags | null): boolean {
  if (role === "SUPER_ADMIN" || role === "BRAND_ADMIN") return true;
  if (role === "BRANCH_ADMIN") return !isBrandCatalogItem(flags);
  return false;
}

export function canEditModifiers(role: UserRole | null | undefined, flags?: MenuItemFlags | null): boolean {
  return canEditItemStructure(role, flags);
}

export function canDeleteItem(role: UserRole | null | undefined, flags?: MenuItemFlags | null): boolean {
  return canEditItemStructure(role, flags);
}

export function canDeleteCategory(role: UserRole | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "BRAND_ADMIN" || role === "BRANCH_ADMIN";
}

/** Availability / 86 and branch price overrides stay available to branch admins on brand items. */
export function canToggleAvailability(role: UserRole | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "BRAND_ADMIN" || role === "BRANCH_ADMIN";
}

export function canEditBranchPrice(role: UserRole | null | undefined, flags?: MenuItemFlags | null): boolean {
  if (role === "SUPER_ADMIN" || role === "BRAND_ADMIN") return true;
  if (role === "BRANCH_ADMIN") return true; // override or staff price path
  return false;
}

/** Show the Stations tab at all. */
export function canSeeStationsTab(role: UserRole | null | undefined): boolean {
  return canManageStations(role);
}
