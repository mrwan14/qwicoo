import type { UserRole } from "@/lib/auth/roles";

export type AppShell = "admin" | "ops";
export type NavGroup = "Portfolio" | "Brand ops" | "Insight";

export type NavItem = {
  href: string;
  label: string;
  group: NavGroup;
  shell: AppShell;
  phase: number;
  roles: readonly UserRole[];
};

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
    roles: [...BRAND_SCOPE],
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
    label: "Expo",
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
    href: "/app/analytics",
    label: "Analytics",
    group: "Insight",
    shell: "admin",
    phase: 6,
    roles: [...BRAND_SCOPE],
  },
  {
    href: "/app/financials",
    label: "Financials",
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
    roles: [...BRAND_SCOPE, "BRANCH_ADMIN", "CASHIER"],
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
  BRAND_ADMIN: ["/app/brands", "/app/menu", "/app/staff", "/app/analytics"],
  REGIONAL_MANAGER: ["/app/brands", "/app/menu", "/app/staff", "/app/analytics"],
  BRANCH_ADMIN: ["/app/floor", "/app/pos", "/app/kds", "/app/payments"],
  CASHIER: ["/app/pos", "/app/payments", "/app/floor", "/app/attendance"],
  WAITER: ["/app/floor", "/app/floor/requests"],
  KITCHEN_STAFF: ["/app/kds", "/app/kds/expo"],
  RUNNER: ["/app/kds/expo", "/app/floor/requests", "/app/floor"],
};

export function navForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function getNavItem(href: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.href === href);
}

export function splitBottomNav(role: UserRole, items: readonly NavItem[]) {
  const allowed = new Set(items.map((item) => item.href));
  const primary = BOTTOM_PRIORITY[role]
    .filter((href) => allowed.has(href))
    .map((href) => items.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item));
  const primaryHrefs = new Set(primary.map((item) => item.href));
  const overflow = items.filter((item) => !primaryHrefs.has(item.href));
  return { primary, overflow };
}

export function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  return !NAV_ITEMS.some(
    (item) =>
      item.href !== href &&
      item.href.startsWith(`${href}/`) &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );
}
