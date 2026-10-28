import type { UserRole } from "@/lib/auth/roles";

/**
 * Old staff URLs and where they live now. `:name` segments carry over.
 * `roles` limits a move to the roles that changed home; everyone else stays on the old page
 * (a waiter still works on /app/floor, App Admin still opens a brand at /app/brands/:id).
 */
export type LegacyRoute = { from: string; to: string; roles?: readonly UserRole[] };

const ADMINS: readonly UserRole[] = ["SUPER_ADMIN", "BRAND_ADMIN", "REGIONAL_MANAGER", "BRANCH_ADMIN"];

export const LEGACY_ROUTES: readonly LegacyRoute[] = [
  { from: "/app/dashboard", to: "/app/home" },
  { from: "/app/brands/:brandId", to: "/app/home", roles: ["BRAND_ADMIN"] },
  { from: "/app/payments", to: "/app/orders/payments" },
  // Waiters (and cashiers at the till) keep the floor as their own work screen.
  { from: "/app/floor", to: "/app/orders?view=tables", roles: ["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN"] },
  { from: "/app/floor/requests", to: "/app/orders?view=tables", roles: ["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN"] },
  // Branch prices now live in the item panel (Per branch).
  { from: "/app/menu/overrides", to: "/app/menu" },
  { from: "/app/inventory", to: "/app/stock" },
  { from: "/app/inventory/stock", to: "/app/stock" },
  ...["movements", "recipes", "ingredients", "prep", "suppliers", "purchase-orders", "transfers", "counts", "waste"].map((page) => ({
    from: `/app/inventory/${page}`,
    to: `/app/stock/${page}`,
  })),
  { from: "/app/inventory/settings", to: "/app/settings/stock" },
  { from: "/app/inventory/units", to: "/app/settings/stock/units" },
  { from: "/app/inventory/import", to: "/app/settings/stock/import" },
  { from: "/app/inventory/jobs", to: "/app/settings/stock/jobs" },
  { from: "/app/inventory/reports", to: "/app/reports/stock" },
];

export { ADMINS as LEGACY_ADMIN_ROLES };

function match(pattern: string, pathname: string): Record<string, string> | null {
  const want = pattern.split("/");
  const have = pathname.replace(/\/+$/, "").split("/");
  if (want.length !== have.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < want.length; index += 1) {
    const part = want[index];
    if (part.startsWith(":")) {
      if (!have[index]) return null;
      params[part.slice(1)] = have[index];
    } else if (part !== have[index]) return null;
  }
  return params;
}

/** Cheap check so only old URLs cost an /auth/me lookup in the middleware. */
export function isLegacyPath(pathname: string): boolean {
  return LEGACY_ROUTES.some((route) => match(route.from, pathname) !== null);
}

/**
 * Where an old URL goes for this role, or null to stay. The target's own query (e.g. `?tab=`)
 * wins over the old one; every other old parameter is kept.
 */
export function legacyTarget(pathname: string, search: string | URLSearchParams, role?: UserRole | null): string | null {
  for (const route of LEGACY_ROUTES) {
    const params = match(route.from, pathname);
    if (!params) continue;
    if (route.roles && (!role || !route.roles.includes(role))) return null;
    const filled = route.to.replace(/:(\w+)/g, (_, name: string) => params[name] ?? "");
    const [path, ownQuery = ""] = filled.split("?");
    const query = new URLSearchParams(ownQuery);
    for (const [key, value] of new URLSearchParams(search)) if (!query.has(key)) query.append(key, value);
    const text = query.toString();
    return text ? `${path}?${text}` : path;
  }
  return null;
}
