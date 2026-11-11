import type { UserRole } from "@/lib/auth/roles";

/**
 * Every role rule in the staff app, in one place. Screens, buttons and the nav read from here,
 * so they cannot disagree. The API (order-backend RequireRoles) stays the real guard: when a
 * line here changes, the matching backend check must change too, or the API answers 403.
 *
 * The model:
 * - App Admin runs the platform.
 * - Brand Admin owns the brand: everything in every branch, plus brand settings, card payment
 *   keys, shared (all-branch) menu items, and retiring shared stock items and suppliers.
 * - Branch Admin runs one branch completely: menu, stock, orders, staff, tables, reports.
 *   Shared menu items are price and availability only, so one branch cannot change another.
 * - Regional Manager is on hold: kept exactly as it was until its role is decided.
 * - Cashier, Waiter, Kitchen and Runner see only the screens for their job.
 */

const SA = "SUPER_ADMIN";
const BA = "BRAND_ADMIN";
const RM = "REGIONAL_MANAGER";
const BRA = "BRANCH_ADMIN";
const CA = "CASHIER";
const WA = "WAITER";
const KS = "KITCHEN_STAFF";
const RU = "RUNNER";

export const PERMISSIONS = {
  // Platform
  "platform.manage": [SA],

  // Brand owner only
  "brand.settings": [BA],
  "brand.cardPayments": [BA],
  "paymob.manage": [SA, BA],
  "brand.customers": [SA, BA],
  "assistant.usage": [SA, BA],

  // Admin areas
  "home.view": [SA, BA, BRA],
  "branch.dashboard": [BRA],
  "settings.view": [SA, BA, BRA],
  "branch.settings": [SA, BA, RM, BRA],
  "branch.offline": [SA, BA, RM, BRA],
  "assistant.use": [SA, BA, RM, BRA],

  // Staff
  "staff.manage": [SA, BA, BRA],
  "staff.invite": [SA, BA, BRA],
  "staff.attendance": [BRA],
  "staff.attendanceReview": [SA, BA, BRA],
  "staff.attendanceOverride": [SA, BA, BRA],
  "staff.list": [SA, BA, RM, BRA],
  "attendance.clockIn": [BRA, CA, WA, KS, RU],

  // Tables
  "tables.manage": [SA, BA, BRA],
  "tables.add": [SA, BA, RM, BRA],
  "tables.pin": [SA, BA, BRA],
  // Close a table the guests left. Cashier and waiter only when nothing on it is unpaid.
  "tables.close": [SA, BA, RM, BRA, CA, WA],
  "tables.closeUnpaid": [SA, BA, RM, BRA],
  "branches.list": [SA, BA, RM, BRA, CA, WA],

  // Reports
  "reports.view": [SA, BA, RM, BRA],
  "reports.sales": [SA, BA, RM, BRA],
  // Guest ratings and walk-outs, and the sidebar badge for unhandled low ratings.
  "reports.reviews": [SA, BA, RM, BRA],
  "reports.till": [SA, BA, BRA],
  "reports.payments": [SA, BA, BRA],
  "reports.attendance": [SA, BA, BRA],

  // Menu
  "menu.view": [SA, BA, RM, BRA],
  /** Branch items, categories, stations, branch prices and availability. */
  "menu.manage": [SA, BA, BRA],
  /** Items shared by every branch: create brand-wide, rename, delete, base price, modifiers. */
  "menu.sharedItems": [SA, BA],

  // Work screens
  "floor.view": [SA, BA, BRA, CA, WA],
  "requests.view": [SA, BA, BRA, WA, RU],
  "pos.use": [SA, BA, RM, BRA, CA],
  "store.online": [SA, BA, BRA, CA],
  "orders.view": [SA, BA, BRA, CA],
  "offlineOrders.view": [SA, BA, RM, BRA],
  "kitchen.view": [SA, BA, BRA, KS],
  "handover.view": [SA, BA, BRA, KS, RU],

  // Order actions
  "orders.pendingBadge": [BA, BRA, CA, WA],
  /** Confirm or reject an order waiting for staff. Kitchen never does. */
  "orders.confirm": [SA, BA, RM, BRA, CA, WA],
  /** Move along the kitchen path (Preparing → Ready → Delivered → Closed). */
  "orders.move": [SA, BA, RM, BRA, CA, KS],
  /** Cancel once the kitchen has it. Cashier and waiter see the control locked. */
  "orders.cancel": [SA, BA, RM, BRA],
  // Guests left without paying: the order leaves revenue and the table frees.
  "orders.walkout": [SA, BA, RM, BRA, CA],
  "payments.refund": [SA, BA, RM, BRA, CA],
  /** Confirm cash or a card slip collected at the counter (POST /payments/offline/{id}/verify). */
  "payments.verify": [SA, BA, RM, BRA, CA],

  // Stock
  /** The Stock entry in the nav. Cashier and kitchen land on the pages below that they may use. */
  "stock.open": [SA, BA, RM, BRA, CA, KS],
  /** Items, history, recipes, suppliers, purchase orders, moves. */
  "stock.view": [SA, BA, RM, BRA],
  /** Add and edit stock items, units, recipes, suppliers and packs, and import. */
  "stock.catalogue": [SA, BA, BRA],
  /** Turn a shared stock item or supplier off. Other branches' recipes may depend on it. */
  "stock.retire": [SA, BA],
  /** Adjust, prep, receive, post counts, move stock. */
  "stock.write": [SA, BA, RM, BRA],
  "stock.count": [SA, BA, RM, BRA, KS],
  "stock.waste": [SA, BA, RM, BRA, KS, CA],
  "stock.reports": [SA, BA, RM, BRA],
  "stock.centralKitchen": [SA, BA],
  "stock.approveTransfer": [SA, BA, RM],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: UserRole | null | undefined, permission: Permission): boolean {
  return Boolean(role && (PERMISSIONS[permission] as readonly UserRole[]).includes(role));
}

export function rolesFor(permission: Permission): readonly UserRole[] {
  return PERMISSIONS[permission];
}
