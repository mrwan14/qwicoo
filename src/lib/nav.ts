import type { UserProfile, UserRole } from "@/lib/auth/roles";
import { homeScopeOf } from "@/lib/auth/scope";

export type AppShell = "admin" | "ops";
export type NavGroup = "Portfolio" | "Brand ops" | "Insight";

export type NavItem = {
  href: string;
  label: string;
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
    label: "Brands",
    group: "Portfolio",
    shell: "admin",
    phase: 5,
    roles: [...PLATFORM],
  },
  {
    href: "/app/invitations",
    label: "People",
    group: "Portfolio",
    shell: "admin",
    phase: 7,
    roles: [...PLATFORM],
  },
  {
    href: "/app/features",
    label: "Features",
    group: "Portfolio",
    shell: "admin",
    phase: 5,
    roles: [...PLATFORM],
  },
  {
    href: "/app/delivery",
    label: "Delivery",
    group: "Portfolio",
    shell: "admin",
    phase: 5,
    roles: [...PLATFORM],
  },
  {
    href: "/app/menu",
    label: "Menu",
    group: "Brand ops",
    shell: "admin",
    phase: 2,
    roles: [...BRANCH_OPS],
  },
  {
    href: "/app/qr",
    label: "QR",
    group: "Brand ops",
    shell: "admin",
    phase: 2,
    roles: [...BRANCH_OPS],
  },
  {
    href: "/app/staff",
    label: "Staff",
    group: "Brand ops",
    shell: "admin",
    phase: 5,
    roles: [...BRANCH_OPS],
  },
  {
    href: "/app/team",
    label: "Team",
    group: "Brand ops",
    shell: "admin",
    phase: 7,
    roles: ["BRAND_ADMIN", "BRANCH_ADMIN"],
  },
  {
    href: "/app/floor",
    label: "Floor",
    group: "Brand ops",
    shell: "ops",
    phase: 3,
    roles: [...BRANCH_OPS, "CASHIER", "WAITER", "RUNNER"],
  },
  {
    href: "/app/floor/requests",
    label: "Requests",
    group: "Brand ops",
    shell: "ops",
    phase: 4,
    roles: [...BRANCH_OPS, "WAITER", "RUNNER"],
  },
  {
    href: "/app/pos",
    label: "POS",
    group: "Brand ops",
    shell: "ops",
    phase: 3,
    roles: [...BRANCH_OPS, "CASHIER"],
  },
  {
    href: "/app/kds",
    label: "KDS",
    group: "Brand ops",
    shell: "ops",
    phase: 3,
    roles: [...BRANCH_OPS, "KITCHEN_STAFF"],
  },
  {
    href: "/app/kds/expo",
    label: "Handover",
    group: "Brand ops",
    shell: "ops",
    phase: 3,
    roles: [...BRANCH_OPS, "KITCHEN_STAFF", "RUNNER"],
  },
  {
    href: "/app/payments",
    label: "Payments",
    group: "Brand ops",
    shell: "admin",
    phase: 4,
    roles: [...BRANCH_OPS, "CASHIER"],
  },
  {
    href: "/app/offline-orders",
    label: "Offline orders",
    group: "Brand ops",
    shell: "admin",
    phase: 4,
    roles: [...BRANCH_OPS],
  },
  {
    href: "/app/dashboard",
    label: "Dashboard",
    group: "Insight",
    shell: "admin",
    phase: 6,
    roles: ["BRANCH_ADMIN"],
  },
  {
    href: "/app/analytics",
    label: "Analytics",
    group: "Insight",
    shell: "admin",
    phase: 6,
    roles: [...BRAND_SCOPE],
  },
  {
    href: "/app/financials",
    label: "Till",
    group: "Insight",
    shell: "admin",
    phase: 6,
    roles: ["SUPER_ADMIN", "BRANCH_ADMIN"],
  },
  {
    href: "/app/attendance",
    label: "Attendance",
    group: "Insight",
    shell: "admin",
    phase: 6,
    roles: ["REGIONAL_MANAGER", "BRANCH_ADMIN", "CASHIER", "WAITER", "KITCHEN_STAFF", "RUNNER"],
  },
  {
    href: "/app/audit",
    label: "Audit",
    group: "Insight",
    shell: "admin",
    phase: 6,
    roles: [...PLATFORM],
  },
];

const BOTTOM_PRIORITY: Record<UserRole, readonly string[]> = {
  SUPER_ADMIN: ["/app/brands", "/app/menu", "/app/floor", "/app/analytics"],
  BRAND_ADMIN: ["brand-dashboard", "/app/menu", "/app/staff", "brand-settings"],
  REGIONAL_MANAGER: ["/app/menu", "/app/analytics", "/app/offline-orders", "/app/floor"],
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
      label: "Dashboard",
      group: "Portfolio",
      shell: "admin",
      phase: 5,
      roles: ["BRAND_ADMIN"],
    });
    extra.push({
      key: "brand-settings",
      href: `/app/brands/${me.brand_id}/settings`,
      label: "Settings",
      group: "Portfolio",
      shell: "admin",
      phase: 5,
      roles: ["BRAND_ADMIN"],
    });
  }
  if (me.role === "BRANCH_ADMIN" && activeBranchId) {
    extra.push({
      key: "branch-settings",
      href: `/app/branches/${activeBranchId}`,
      label: "Branch settings",
      group: "Brand ops",
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
