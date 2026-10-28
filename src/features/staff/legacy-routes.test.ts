import assert from "node:assert/strict";
import { test } from "node:test";

import type { UserRole } from "@/lib/auth/roles.ts";

import { LEGACY_ROUTES, legacyTarget } from "./legacy-routes.ts";

const BRAND = "00000000-0000-4000-8000-0000000000b1";

/** Every old URL, who opens it, and where they land. Keep this list in step with LEGACY_ROUTES. */
const OLD_ROUTES: readonly { path: string; role: UserRole; lands: string | null }[] = [
  { path: "/app/dashboard", role: "BRANCH_ADMIN", lands: "/app/home" },
  { path: `/app/brands/${BRAND}`, role: "BRAND_ADMIN", lands: "/app/home" },
  { path: `/app/brands/${BRAND}`, role: "SUPER_ADMIN", lands: null },
  { path: "/app/payments", role: "CASHIER", lands: "/app/orders/payments" },
  { path: "/app/payments", role: "BRANCH_ADMIN", lands: "/app/orders/payments" },
  { path: "/app/floor", role: "BRANCH_ADMIN", lands: "/app/orders?view=tables" },
  { path: "/app/floor", role: "WAITER", lands: null },
  { path: "/app/floor", role: "CASHIER", lands: null },
  { path: "/app/floor/requests", role: "BRAND_ADMIN", lands: "/app/orders?view=tables" },
  { path: "/app/floor/requests", role: "RUNNER", lands: null },
  { path: "/app/menu/overrides", role: "BRANCH_ADMIN", lands: "/app/menu" },
];

test("every old route lands on its new home", () => {
  for (const route of OLD_ROUTES) assert.equal(legacyTarget(route.path, "", route.role), route.lands, `${route.role} ${route.path}`);
});

test("every legacy rule is covered by the list above", () => {
  const covered = new Set(OLD_ROUTES.map((route) => route.path.replace(BRAND, ":brandId")));
  for (const route of LEGACY_ROUTES) {
    const sample = route.from.replace(/:(\w+)/g, (_, name: string) => `:${name}`);
    assert.ok([...covered].some((path) => path === sample || path.split("/").length === sample.split("/").length && sample.split("/").every((part, index) => part.startsWith(":") || part === path.split("/")[index])), route.from);
  }
});

test("old query parameters survive the move, the new tab wins", () => {
  assert.equal(legacyTarget("/app/dashboard", "?x=1", "BRANCH_ADMIN"), "/app/home?x=1");
  assert.equal(legacyTarget("/app/dashboard/", "", "BRANCH_ADMIN"), "/app/home");
  assert.equal(legacyTarget("/app/home", "", "BRANCH_ADMIN"), null);
  assert.equal(legacyTarget("/app/floor", "view=list&table=4", "BRANCH_ADMIN"), "/app/orders?view=tables&table=4");
});
