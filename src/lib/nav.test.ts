import assert from "node:assert/strict";
import { test } from "node:test";

import type { UserProfile, UserRole } from "@/lib/auth/roles.ts";
import { scopeHome } from "@/lib/auth/scope.ts";
import { activeSidebarKey, frontlineScreens, isFrontlineRole, navForUser, sidebarForUser } from "@/lib/nav.ts";

const BRAND = "00000000-0000-4000-8000-0000000000b1";
const BRANCH = "00000000-0000-4000-8000-0000000000c1";

function person(role: UserRole, home_scope = "branch"): UserProfile {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    tenant_id: "00000000-0000-4000-8000-000000000002",
    email: "someone@example.com",
    full_name: "Someone",
    role,
    is_active: true,
    home_scope,
    brand_id: role === "SUPER_ADMIN" ? null : BRAND,
    accessible_branches: role === "SUPER_ADMIN" ? [] : [{ id: BRANCH, name: "Maadi" }],
  };
}

const keys = (me: UserProfile) => sidebarForUser(me, me.role === "SUPER_ADMIN" ? null : BRANCH).map((entry) => entry.key);

test("App Admin sees only the platform list", () => {
  assert.deepEqual(keys(person("SUPER_ADMIN", "platform")), [
    "home",
    "brands",
    "people",
    "features",
    "leads",
    "delivery",
    "audit",
    "settings",
  ]);
});

test("brand and branch admins get Home, Orders, Menu, Stock, Reports and Settings", () => {
  const business = ["home", "orders", "menu", "stock", "reports", "settings"];
  assert.deepEqual(keys(person("BRAND_ADMIN", "brand")), business);
  assert.deepEqual(keys(person("BRANCH_ADMIN")), business);
});

test("every sidebar link is a page the role could already open", () => {
  for (const role of ["SUPER_ADMIN", "BRAND_ADMIN", "REGIONAL_MANAGER", "BRANCH_ADMIN"] as const) {
    const me = person(role, role === "SUPER_ADMIN" ? "platform" : role === "BRAND_ADMIN" ? "brand" : "branch");
    const allowed = new Set(navForUser(me, BRANCH).map((item) => item.href));
    for (const entry of sidebarForUser(me, BRANCH)) assert.ok(allowed.has(entry.href), `${role} → ${entry.href}`);
  }
});

test("the regional manager keeps their pages without Home or Settings", () => {
  assert.deepEqual(keys(person("REGIONAL_MANAGER")), ["orders", "menu", "stock", "reports"]);
  assert.equal(scopeHome(person("REGIONAL_MANAGER")), "/app/menu");
});

test("admins land on Home", () => {
  assert.equal(scopeHome(person("SUPER_ADMIN", "platform")), "/app/home");
  assert.equal(scopeHome(person("BRAND_ADMIN", "brand")), "/app/home");
  assert.equal(scopeHome(person("BRANCH_ADMIN")), "/app/home");
});

test("the deepest matching page picks the active entry", () => {
  const me = person("BRAND_ADMIN", "brand");
  const items = navForUser(me, BRANCH);
  const entries = sidebarForUser(me, BRANCH);
  assert.equal(activeSidebarKey(`/app/brands/${BRAND}/settings`, entries, items), "settings");
  assert.equal(activeSidebarKey(`/app/brands/${BRAND}`, entries, items), "home");
  assert.equal(activeSidebarKey("/app/orders/delivery", entries, items), "orders");
  assert.equal(activeSidebarKey("/app/kds/expo", entries, items), "orders");
  assert.equal(activeSidebarKey("/app/stock/counts", entries, items), "stock");
  assert.equal(activeSidebarKey("/app/no-such-page", entries, items), null);
});

test("cashier, waiter, kitchen and runner use the front-line bar with their own screen first", () => {
  for (const role of ["CASHIER", "WAITER", "KITCHEN_STAFF", "RUNNER"] as const) assert.equal(isFrontlineRole(role), true);
  for (const role of ["SUPER_ADMIN", "BRAND_ADMIN", "REGIONAL_MANAGER", "BRANCH_ADMIN"] as const) assert.equal(isFrontlineRole(role), false);
  assert.equal(frontlineScreens(person("CASHIER"), BRANCH)[0]?.href, "/app/pos");
  assert.equal(frontlineScreens(person("WAITER"), BRANCH)[0]?.href, "/app/floor");
  assert.equal(frontlineScreens(person("KITCHEN_STAFF"), BRANCH)[0]?.href, "/app/kds");
  assert.equal(frontlineScreens(person("RUNNER"), BRANCH)[0]?.href, "/app/kds/expo");
});
