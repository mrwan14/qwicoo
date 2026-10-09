import { ASSISTANT_ROLES, type UserProfile, type UserRole } from "@/lib/auth/roles";
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

export const NAV_ITEMS: readonly NavItem[] = [
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
    href: "/app/menu",
    labelKey: "menu",
    group: "brandOps",
    shell: "admin",
    phase: 2,
    roles: [...BRANCH_OPS],
  },
  {
    href: "/app/qr",
    labelKey: "qr",
    group: "brandOps",
    shell: "admin",
    phase: 2,
    roles: [...BRANCH_OPS],
  },
  {
    href: "/app/staff",
    labelKey: "staff",
    group: "brandOps",
    shell: "admin",
    phase: 5,
    roles: [...BRANCH_OPS],
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
    roles: [...BRANCH_OPS, "CASHIER", "WAITER", "RUNNER"],
  },
  {
    href: "/app/floor/requests",
    labelKey: "requests",
    group: "brandOps",
    shell: "ops",
    phase: 4,
    roles: [...BRANCH_OPS, "WAITER", "RUNNER"],
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
    href: "/app/kds",
    labelKey: "kds",
    group: "brandOps",
    shell: "ops",
    phase: 3,
    roles: [...BRANCH_OPS, "KITCHEN_STAFF"],
  },
  {
    href: "/app/kds/expo",
    labelKey: "handover",
    group: "brandOps",
    shell: "ops",
    phase: 3,
    roles: [...BRANCH_OPS, "KITCHEN_STAFF", "RUNNER"],
  },
  {
    href: "/app/payments",
    labelKey: "payments",
    group: "brandOps",
    shell: "admin",
    phase: 4,
    roles: [...BRANCH_OPS, "CASHIER"],
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
    roles: ["REGIONAL_MANAGER", "BRANCH_ADMIN", "CASHIER", "WAITER", "KITCHEN_STAFF", "RUNNER"],
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

const BOTTOM_PRIORITY: Record<UserRole, readonly string[]> = {
  SUPER_ADMIN: ["/app/brands", "/app/menu", "/app/floor", "/app/analytics"],
  BRAND_ADMIN: ["brand-dashboard", "/app/menu", "/app/staff", "brand-settings"],
  REGIONAL_MANAGER: ["/app/floor", "/app/menu", "/app/staff", "/app/analytics"],
  BRANCH_ADMIN: ["/app/dashboard", "/app/floor", "/app/pos", "/app/payments"],
  CASHIER: ["/app/pos", "/app/payments", "/app/floor", "/app/attendance"],
  WAITER: ["/app/floor", "/app/floor/requests", "/app/attendance"],
  KITCHEN_STAFF: ["/app/kds", "/app/kds/expo", "/app/attendance"],
  RUNNER: ["/app/kds/expo", "/app/floor/requests", "/app/floor", "/app/attendance"],
};

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

export function splitBottomNav(role: UserRole, items: readonly NavItem[]) {
  const byKey = new Map(items.map((item) => [navKey(item), item]));
  const primary = BOTTOM_PRIORITY[role]
    .map((key) => byKey.get(key))
    .filter((item): item is NavItem => Boolean(item));
  const primaryKeys = new Set(primary.map(navKey));
  const overflow = items.filter((item) => !primaryKeys.has(navKey(item)));
  return { primary, overflow };
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
