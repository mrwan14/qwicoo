/**
 * Menu admin capabilities. Roles live in `@/lib/auth/permissions` (mirror them in the backend).
 * Hide controls the role cannot use; do not rely on 403s.
 */

import { can } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/auth/roles";
import type { components } from "@/lib/api/schema";

export type MenuItemScope = components["schemas"]["MenuItemScope"];

export type MenuItemFlags = {
  /** From branch menu when available; brand catalog is typically ALL_BRANCHES with a brand_id. */
  scope?: MenuItemScope | null;
  /** True when the item belongs to the brand catalog (not a branch-only staff item). */
  brandCatalog?: boolean;
};

export function canOpenMenuAdmin(role: UserRole | null | undefined): boolean {
  return can(role, "menu.manage");
}

/** Promo codes belong to the brand; the API lets only super and brand admins manage them. */
export function canManagePromos(role: UserRole | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "BRAND_ADMIN";
}

export function canManageStations(role: UserRole | null | undefined): boolean {
  return can(role, "menu.manage");
}

export function canAddCategory(role: UserRole | null | undefined): boolean {
  return can(role, "menu.manage");
}

export function canAddItem(role: UserRole | null | undefined): boolean {
  return can(role, "menu.manage");
}

/** Brand admins choose catalog scope; branch admins only create branch-local items. */
export function canChooseItemScope(role: UserRole | null | undefined): boolean {
  return can(role, "menu.sharedItems");
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
  if (can(role, "menu.sharedItems")) return true;
  if (can(role, "menu.manage")) return !isBrandCatalogItem(flags);
  return false;
}

export function canEditModifiers(role: UserRole | null | undefined, flags?: MenuItemFlags | null): boolean {
  return canEditItemStructure(role, flags);
}

export function canDeleteItem(role: UserRole | null | undefined, flags?: MenuItemFlags | null): boolean {
  return canEditItemStructure(role, flags);
}

export function canDeleteCategory(role: UserRole | null | undefined): boolean {
  return can(role, "menu.manage");
}

/** Availability / 86 and branch price overrides stay available to branch admins on brand items. */
export function canToggleAvailability(role: UserRole | null | undefined): boolean {
  return can(role, "menu.manage");
}

export function canEditBranchPrice(role: UserRole | null | undefined, _flags?: MenuItemFlags | null): boolean {
  return can(role, "menu.manage");
}

/** Show the Stations tab at all. */
export function canSeeStationsTab(role: UserRole | null | undefined): boolean {
  return canManageStations(role);
}
