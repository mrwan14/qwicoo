import { ASSISTANT_ROLES, roleHome, type UserProfile, type UserRole } from "@/lib/auth/roles";
import { homeScopeOf } from "@/lib/auth/scope";
import type { NavLabelKey } from "@/lib/i18n/staff/nav";

export type AppShell = "admin" | "ops";
export type NavGroup = "portfolio" | "brandOps" | "insight";

export type NavItem = {
  href: string;
  labelKey: NavLabelKey;
  group: NavGroup;
  shell: AppShell;
  phase: number;
  roles: readonly UserRole[];
  /** Stable id for icons and bottom-bar order when `href` holds an id. Defaults to `href`. */
  key?: string;
};

export function navKey(item: NavItem): string {
  return item.key ?? item.href;
}

const PLATFORM = ["SUPER_ADMIN"] as const satisfies readonly UserRole[];
const BRAND_SCOPE = ["SUPER_ADMIN", "BRAND_ADMIN", "REGIONAL_MANAGER"] as const satisfies readonly UserRole[];
const BRANCH_OPS = ["SUPER_ADMIN", "BRAND_ADMIN", "REGIONAL_MANAGER", "BRANCH_ADMIN"] as const satisfies readonly UserRole[];
const INVENTORY = ["SUPER_ADMIN", "BRAND_ADMIN", "REGIONAL_MANAGER", "BRANCH_ADMIN", "KITCHEN_STAFF", "CASHIER"] as const satisfies readonly UserRole[];

const HOME = ["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN"] as const satisfies readonly UserRole[];

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/app/home",
    labelKey: "home",
    group: "insight",
    shell: "admin",
    phase: 3,
    roles: [...HOME],
  },
  {
    href: "/app/reports",
    labelKey: "reports",
    group: "insight",
    shell: "admin",
    phase: 9,
    roles: [...BRANCH_OPS],
  },
  {
    href: "/app/settings",
    labelKey: "settings",
    group: "brandOps",
    shell: "admin",
    phase: 7,
    roles: [...HOME],
  },
  {
    href: "/app/brands",
    labelKey: "brands",
    group: "portfolio",
    shell: "admin",
    phase: 5,
    roles: [...PLATFORM],
  },
  {
    href: "/app/invitations",
    labelKey: "people",
    group: "portfolio",
    shell: "admin",
    phase: 7,
    roles: [...PLATFORM],
  },
  {
    href: "/app/features",
    labelKey: "features",
    group: "portfolio",
    shell: "admin",
    phase: 5,
    roles: [...PLATFORM],
  },
  {
    href: "/app/delivery",
    labelKey: "delivery",
    group: "portfolio",
    shell: "admin",
    phase: 5,
    roles: [...PLATFORM],
  },
  {
    href: "/app/partner-leads",
    labelKey: "leads",
    group: "portfolio",
    shell: "admin",
    phase: 6,
    roles: [...PLATFORM],
  },
  {
    href: "/app/mobile-customers",
    labelKey: "qwicooCustomers",
    group: "brandOps",
    shell: "admin",
    phase: 5,
    roles: ["SUPER_ADMIN", "BRAND_ADMIN"],
  },
  {
    href: "/app/menu",
    labelKey: "menu",
    group: "brandOps",
    shell: "admin",
    phase: 2,
    roles: [...BRANCH_OPS],
  },
  {
    href: "/app/inventory",
    labelKey: "inventory",
    group: "brandOps",
    shell: "admin",
    phase: 8,
    roles: [...INVENTORY],
  },
  {
    href: "/app/qr",
    labelKey: "qr",
    group: "brandOps",
    shell: "admin",
    phase: 2,
    roles: ["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN"],
  },
  {
    href: "/app/staff",
    labelKey: "staff",
    group: "brandOps",
    shell: "admin",
    phase: 5,
    roles: ["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN"],
  },
  {
    href: "/app/team",
    labelKey: "team",
    group: "brandOps",
    shell: "admin",
    phase: 7,
    roles: ["BRAND_ADMIN", "BRANCH_ADMIN"],
  },
  {
    href: "/app/floor",
    labelKey: "floor",
    group: "brandOps",
    shell: "ops",
    phase: 3,
    roles: ["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN", "CASHIER", "WAITER"],
  },
  {
    href: "/app/floor/requests",
    labelKey: "requests",
    group: "brandOps",
    shell: "ops",
    phase: 4,
    roles: ["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN", "WAITER", "RUNNER"],
  },
  {
    href: "/app/pos",
    labelKey: "pos",
    group: "brandOps",
    shell: "ops",
    phase: 3,
    roles: [...BRANCH_OPS, "CASHIER"],
  },
  {
    href: "/app/orders",
    labelKey: "orders",
    group: "brandOps",
    shell: "ops",
    phase: 3,
    roles: ["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN", "CASHIER"],
  },
  {
    href: "/app/orders/history",
    labelKey: "history",
    group: "brandOps",
    shell: "ops",
    phase: 4,
    roles: ["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN", "CASHIER"],
  },
  {
    href: "/app/orders/delivery",
    labelKey: "deliveryBoard",
    group: "brandOps",
    shell: "ops",
    phase: 3,
    roles: ["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN", "CASHIER"],
  },
  {
    href: "/app/kds",
    labelKey: "kds",
    group: "brandOps",
    shell: "ops",
    phase: 3,
    roles: ["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN", "KITCHEN_STAFF"],
  },
  {
    href: "/app/kds/expo",
    labelKey: "handover",
    group: "brandOps",
    shell: "ops",
    phase: 3,
    roles: ["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN", "KITCHEN_STAFF", "RUNNER"],
  },
  {
    href: "/app/orders/payments",
    labelKey: "payments",
    group: "brandOps",
    shell: "admin",
    phase: 4,
    roles: ["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN", "CASHIER"],
  },
  {
    href: "/app/offline-orders",
    labelKey: "offlineOrders",
    group: "brandOps",
    shell: "admin",
    phase: 4,
    roles: [...BRANCH_OPS],
  },
  {
    href: "/app/dashboard",
    labelKey: "dashboard",
    group: "insight",
    shell: "admin",
    phase: 6,
    roles: ["BRANCH_ADMIN"],
  },
  {
    href: "/app/analytics",
    labelKey: "analytics",
    group: "insight",
    shell: "admin",
    phase: 6,
    roles: [...BRAND_SCOPE],
  },
  {
    href: "/app/assistant",
    labelKey: "assistant",
    group: "insight",
    shell: "admin",
    phase: 6,
    roles: [...ASSISTANT_ROLES],
  },
  {
    href: "/app/financials",
    labelKey: "till",
    group: "insight",
    shell: "admin",
    phase: 6,
    roles: ["SUPER_ADMIN", "BRANCH_ADMIN"],
  },
  {
    href: "/app/attendance",
    labelKey: "attendance",
    group: "insight",
    shell: "admin",
    phase: 6,
    roles: ["BRANCH_ADMIN", "CASHIER", "WAITER", "KITCHEN_STAFF", "RUNNER"],
  },
  {
    href: "/app/audit",
    labelKey: "audit",
    group: "insight",
    shell: "admin",
    phase: 6,
    roles: [...PLATFORM],
  },
];

/**
 * Nav for this user in this scope. Brand admins get their own brand's
 * dashboard instead of the all-brands grid; branch admins get a link to
 * their active branch's settings.
 */
export function navForUser(me: UserProfile, activeBranchId: string | null): NavItem[] {
  const items = NAV_ITEMS.filter((item) => item.roles.includes(me.role));
  const scope = homeScopeOf(me);
  const extra: NavItem[] = [];
  if (scope === "brand" && me.brand_id) {
    extra.push({
      key: "brand-dashboard",
      href: `/app/brands/${me.brand_id}`,
      labelKey: "dashboard",
      group: "portfolio",
      shell: "admin",
      phase: 5,
      roles: ["BRAND_ADMIN"],
    });
    extra.push({
      key: "brand-settings",
      href: `/app/brands/${me.brand_id}/settings`,
      labelKey: "settings",
      group: "portfolio",
      shell: "admin",
      phase: 5,
      roles: ["BRAND_ADMIN"],
    });
  }
  if (me.role === "BRANCH_ADMIN" && activeBranchId) {
    extra.push({
      key: "branch-settings",
      href: `/app/branches/${activeBranchId}`,
      labelKey: "branchSettings",
      group: "brandOps",
      shell: "admin",
      phase: 5,
      roles: ["BRANCH_ADMIN"],
    });
  }
  return [...extra, ...items];
}

export function getNavItem(href: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.href === href);
}

export function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  if (/^\/app\/brands\/[^/]+$/.test(href)) return false;
  return !NAV_ITEMS.some(
    (item) =>
      item.href !== href &&
      item.href.startsWith(`${href}/`) &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );
}

/** Admin sidebar entries. Each one opens the first page in `members` the user may see. */
export type SidebarKey =
  | "home"
  | "orders"
  | "menu"
  | "stock"
  | "reports"
  | "settings"
  | "brands"
  | "people"
  | "features"
  | "leads"
  | "delivery"
  | "audit";

export type SidebarEntry = {
  key: SidebarKey;
  href: string;
  /** Pinned to the bottom of the sidebar. */
  bottom: boolean;
  /** Nav keys that light this entry up. */
  members: readonly string[];
};

type SidebarDef = { key: SidebarKey; members: readonly string[]; bottom?: boolean };

const BUSINESS_SIDEBAR: readonly SidebarDef[] = [
  { key: "home", members: ["/app/home", "/app/dashboard", "brand-dashboard"] },
  {
    key: "orders",
    members: [
      "/app/orders",
      "/app/orders/delivery",
      "/app/orders/history",
      "/app/orders/payments",
      "/app/floor",
      "/app/floor/requests",
      "/app/offline-orders",
      "/app/pos",
      "/app/kds",
      "/app/kds/expo",
    ],
  },
  { key: "menu", members: ["/app/menu"] },
  { key: "stock", members: ["/app/inventory"] },
  { key: "reports", members: ["/app/reports", "/app/analytics", "/app/financials"] },
  {
    key: "settings",
    bottom: true,
    members: [
      "/app/settings",
      "brand-settings",
      "branch-settings",
      "/app/staff",
      "/app/team",
      "/app/qr",
      "/app/mobile-customers",
      "/app/attendance",
    ],
  },
];

const PLATFORM_SIDEBAR: readonly SidebarDef[] = [
  { key: "home", members: ["/app/home"] },
  { key: "brands", members: ["/app/brands"] },
  { key: "people", members: ["/app/invitations"] },
  { key: "features", members: ["/app/features"] },
  { key: "leads", members: ["/app/partner-leads"] },
  { key: "delivery", members: ["/app/delivery"] },
  { key: "audit", members: ["/app/audit"] },
  { key: "settings", bottom: true, members: ["/app/settings", "/app/mobile-customers"] },
];

/**
 * Sidebar for an admin. Built from `navForUser`, so an entry appears only when
 * the role may open at least one of its pages. App Admin gets the platform list.
 */
export function sidebarForUser(me: UserProfile, activeBranchId: string | null): SidebarEntry[] {
  const allowed = new Map(navForUser(me, activeBranchId).map((item) => [navKey(item), item]));
  const defs = homeScopeOf(me) === "platform" ? PLATFORM_SIDEBAR : BUSINESS_SIDEBAR;
  return defs.flatMap((def) => {
    const members = def.members.filter((key) => allowed.has(key));
    const first = members[0];
    if (!first) return [];
    return [{ key: def.key, href: allowed.get(first)!.href, bottom: def.bottom ?? false, members }];
  });
}

/** The entry whose page best matches `pathname` (longest matching href wins). */
export function activeSidebarKey(
  pathname: string,
  entries: readonly SidebarEntry[],
  items: readonly NavItem[],
): SidebarKey | null {
  const hrefs = new Map(items.map((item) => [navKey(item), item.href]));
  let best: { key: SidebarKey; length: number } | null = null;
  for (const entry of entries) {
    for (const member of entry.members) {
      const href = hrefs.get(member);
      if (!href) continue;
      if (pathname !== href && !pathname.startsWith(`${href}/`)) continue;
      if (!best || href.length > best.length) best = { key: entry.key, length: href.length };
    }
  }
  return best?.key ?? null;
}

/** Roles that work from one screen at a time with a slim top bar and no sidebar. */
const FRONTLINE_ROLES: readonly UserRole[] = ["CASHIER", "WAITER", "KITCHEN_STAFF", "RUNNER"];

export function isFrontlineRole(role: UserRole): boolean {
  return FRONTLINE_ROLES.includes(role);
}

/** Orders tabs: reached from the Orders page itself, not listed as separate screens. */
export const ORDER_TABS: readonly string[] = ["/app/orders/delivery", "/app/orders/history", "/app/orders/payments"];

/** Work screens a front-line role can switch between, their own home first. */
export function frontlineScreens(me: UserProfile, activeBranchId: string | null): NavItem[] {
  const items = navForUser(me, activeBranchId).filter((item) => !ORDER_TABS.includes(item.href));
  const home = roleHome(me.role);
  return [...items.filter((item) => item.href === home), ...items.filter((item) => item.href !== home)];
}
