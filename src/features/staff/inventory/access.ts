/**
 * Inventory visibility. Mirrors RequireRoles in order-backend inventory routes.
 * Hide the tab and deny the URL; do not wait for a 403.
 */

import type { UserRole } from "@/lib/auth/roles";

const READ: readonly UserRole[] = [
  "SUPER_ADMIN",
  "BRAND_ADMIN",
  "REGIONAL_MANAGER",
  "BRANCH_ADMIN",
  "KITCHEN_STAFF",
  "CASHIER",
];
const CATALOGUE_WRITE: readonly UserRole[] = ["SUPER_ADMIN", "BRAND_ADMIN"];
const STOCK_WRITE: readonly UserRole[] = ["SUPER_ADMIN", "BRAND_ADMIN", "REGIONAL_MANAGER", "BRANCH_ADMIN"];
const WASTE: readonly UserRole[] = [...STOCK_WRITE, "KITCHEN_STAFF", "CASHIER"];
const REPORTS: readonly UserRole[] = ["SUPER_ADMIN", "BRAND_ADMIN", "REGIONAL_MANAGER", "BRANCH_ADMIN"];

export const INVENTORY_NAV_ROLES = READ;

export const INVENTORY_HREFS: Record<InventoryPage, string> = {
  overview: "/app/inventory",
  stock: "/app/inventory/stock",
  movements: "/app/inventory/movements",
  ingredients: "/app/inventory/ingredients",
  units: "/app/inventory/units",
  import: "/app/inventory/import",
  recipes: "/app/inventory/recipes",
  suppliers: "/app/inventory/suppliers",
  purchaseOrders: "/app/inventory/purchase-orders",
  counts: "/app/inventory/counts",
  waste: "/app/inventory/waste",
  prep: "/app/inventory/prep",
  reports: "/app/inventory/reports",
  settings: "/app/inventory/settings",
  jobs: "/app/inventory/jobs",
};

export type InventoryPage =
  | "overview"
  | "stock"
  | "movements"
  | "ingredients"
  | "units"
  | "import"
  | "recipes"
  | "suppliers"
  | "purchaseOrders"
  | "counts"
  | "waste"
  | "prep"
  | "reports"
  | "settings"
  | "jobs";

const PAGE_ROLES: Record<InventoryPage, readonly UserRole[]> = {
  overview: READ,
  stock: READ,
  movements: READ,
  ingredients: READ,
  units: READ,
  recipes: READ,
  suppliers: READ,
  purchaseOrders: READ,
  counts: WASTE,
  import: CATALOGUE_WRITE,
  waste: WASTE,
  prep: STOCK_WRITE,
  reports: REPORTS,
  settings: REPORTS,
  jobs: REPORTS,
};

function has(roles: readonly UserRole[], role: UserRole | null | undefined): boolean {
  return Boolean(role && roles.includes(role));
}

export function canOpenInventory(role: UserRole | null | undefined): boolean {
  return has(READ, role);
}

export function canOpenInventoryPage(role: UserRole | null | undefined, page: InventoryPage): boolean {
  return has(PAGE_ROLES[page], role);
}

export function inventoryPagesFor(role: UserRole | null | undefined): InventoryPage[] {
  return (Object.keys(PAGE_ROLES) as InventoryPage[]).filter((page) => canOpenInventoryPage(role, page));
}

export function canWriteCatalogue(role: UserRole | null | undefined): boolean {
  return has(CATALOGUE_WRITE, role);
}

export function canWriteStock(role: UserRole | null | undefined): boolean {
  return has(STOCK_WRITE, role);
}

export function canRecordWaste(role: UserRole | null | undefined): boolean {
  return has(WASTE, role);
}

export function canSeeReports(role: UserRole | null | undefined): boolean {
  return has(REPORTS, role);
}

/** Central-kitchen writes are brand-level. Branch roles may read a kitchen in their brand. */
export function canWriteCentralKitchen(role: UserRole | null | undefined): boolean {
  return has(CATALOGUE_WRITE, role);
}
