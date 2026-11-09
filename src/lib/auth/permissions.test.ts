import assert from "node:assert/strict";
import { test } from "node:test";

import { can, PERMISSIONS, type Permission } from "@/lib/auth/permissions.ts";

test("branch admin runs the whole branch", () => {
  const branch: Permission[] = [
    "menu.manage",
    "stock.catalogue",
    "stock.write",
    "stock.count",
    "stock.waste",
    "stock.reports",
    "orders.view",
    "orders.confirm",
    "orders.move",
    "orders.cancel",
    "payments.refund",
    "floor.view",
    "pos.use",
    "kitchen.view",
    "handover.view",
    "staff.manage",
    "staff.invite",
    "staff.attendanceOverride",
    "tables.manage",
    "tables.add",
    "tables.pin",
    "branch.settings",
    "reports.sales",
    "reports.till",
    "reports.payments",
    "reports.attendance",
    "assistant.use",
  ];
  for (const permission of branch) assert.equal(can("BRANCH_ADMIN", permission), true, permission);
});

test("brand-wide things stay with the brand admin", () => {
  for (const permission of ["menu.sharedItems", "stock.retire", "stock.centralKitchen", "brand.settings", "brand.cardPayments", "paymob.manage"] as Permission[]) {
    assert.equal(can("BRANCH_ADMIN", permission), false, permission);
    assert.equal(can("BRAND_ADMIN", permission), true, permission);
  }
});

test("brand admin can do everything a branch admin can, except the branch dashboard and clock-in", () => {
  for (const [permission, roles] of Object.entries(PERMISSIONS) as [Permission, readonly string[]][]) {
    if (permission === "branch.dashboard" || permission === "attendance.clockIn" || permission === "staff.attendance") continue;
    if (roles.includes("BRANCH_ADMIN")) assert.equal(can("BRAND_ADMIN", permission), true, permission);
  }
});

test("front-line roles only get their job", () => {
  assert.equal(can("CASHIER", "stock.waste"), true);
  assert.equal(can("CASHIER", "stock.view"), false);
  assert.equal(can("CASHIER", "stock.count"), false);
  assert.equal(can("KITCHEN_STAFF", "stock.count"), true);
  assert.equal(can("KITCHEN_STAFF", "stock.view"), false);
  assert.equal(can("WAITER", "pos.use"), false);
  assert.equal(can("RUNNER", "orders.confirm"), false);
  assert.equal(can(null, "home.view"), false);
});
