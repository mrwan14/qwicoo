/**
 * Inventory visibility. The roles live in `@/lib/auth/permissions`; mirror them in order-backend.
 * Hide the tab and deny the URL; do not wait for a 403.
 */

import { can, rolesFor } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/auth/roles";

const READ = rolesFor("stock.view");
const CATALOGUE_WRITE = rolesFor("stock.catalogue");
const STOCK_WRITE = rolesFor("stock.write");
const COUNT = rolesFor("stock.count");
const WASTE = rolesFor("stock.waste");
const REPORTS = rolesFor("stock.reports");

export const INVENTORY_NAV_ROLES = rolesFor("stock.open");

/** Stock lives under /app/stock; units, import, jobs and rules under Settings → Stock; usage under Reports. */
export const INVENTORY_HREFS: Record<InventoryPage, string> = {
  overview: "/app/stock",
  stock: "/app/stock",
  movements: "/app/stock/movements",
  ingredients: "/app/stock/ingredients",
  units: "/app/settings/stock/units",
  import: "/app/settings/stock/import",
  recipes: "/app/stock/recipes",
  suppliers: "/app/stock/suppliers",
  purchaseOrders: "/app/stock/purchase-orders",
  bills: "/app/stock/bills",
  counts: "/app/stock/counts",
  transfers: "/app/stock/transfers",
  waste: "/app/stock/waste",
  prep: "/app/stock/prep",
  reports: "/app/reports/stock",
  settings: "/app/settings/stock",
  jobs: "/app/settings/stock/jobs",
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
  | "bills"
  | "counts"
  | "transfers"
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
  // Supplier bills and payments: the same roles the API allows (stock managers, not cashiers or kitchen).
  bills: STOCK_WRITE,
  counts: COUNT,
  transfers: READ,
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
  return can(role, "stock.open");
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

/** Turning a shared stock item or supplier off stays with the brand. */
export function canRetireCatalogue(role: UserRole | null | undefined): boolean {
  return can(role, "stock.retire");
}

/** Central-kitchen writes are brand-level. Branch roles may read a kitchen in their brand. */
export function canWriteCentralKitchen(role: UserRole | null | undefined): boolean {
  return can(role, "stock.centralKitchen");
}

export function canApproveTransfer(role: UserRole | null | undefined): boolean {
  return can(role, "stock.approveTransfer");
}

/** GET /api/v1/branches. Mirrors list_branches RequireRoles. Kitchen staff are not on it. */
export function canListBranches(role: UserRole | null | undefined): boolean {
  return can(role, "branches.list");
}

/** GET /branches/{id}/staff. Mirrors STAFF_LIST_ROLES. */
export function canListStaff(role: UserRole | null | undefined): boolean {
  return can(role, "staff.list");
}
