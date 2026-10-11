import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canAddCategory,
  canAddItem,
  canChooseItemScope,
  canDeleteItem,
  canEditItemStructure,
  canEditModifiers,
  canManageStations,
  canSeeStationsTab,
  canToggleAvailability,
  isBrandCatalogItem,
} from "./menu-permissions.ts";

test("brand and super admins manage full menu and stations", () => {
  for (const role of ["SUPER_ADMIN", "BRAND_ADMIN"] as const) {
    assert.equal(canAddCategory(role), true);
    assert.equal(canAddItem(role), true);
    assert.equal(canChooseItemScope(role), true);
    assert.equal(canManageStations(role), true);
    assert.equal(canSeeStationsTab(role), true);
    assert.equal(canEditItemStructure(role, { scope: "ALL_BRANCHES" }), true);
    assert.equal(canEditModifiers(role, { brandCatalog: true }), true);
  }
});

test("branch admin can add branch items and stations but not edit brand catalog structure", () => {
  assert.equal(canAddCategory("BRANCH_ADMIN"), true);
  assert.equal(canAddItem("BRANCH_ADMIN"), true);
  assert.equal(canChooseItemScope("BRANCH_ADMIN"), false);
  assert.equal(canManageStations("BRANCH_ADMIN"), true);
  assert.equal(canToggleAvailability("BRANCH_ADMIN"), true);
  assert.equal(canEditItemStructure("BRANCH_ADMIN", { scope: "ALL_BRANCHES" }), false);
  assert.equal(canEditModifiers("BRANCH_ADMIN", { brandCatalog: true }), false);
  assert.equal(canDeleteItem("BRANCH_ADMIN", { scope: "ALL_BRANCHES" }), false);
  assert.equal(canEditItemStructure("BRANCH_ADMIN", { scope: "SPECIFIC_BRANCHES", brandCatalog: false }), true);
});

test("cashiers and runners cannot open menu admin actions", () => {
  for (const role of ["CASHIER", "RUNNER", "WAITER", "KITCHEN_STAFF"] as const) {
    assert.equal(canAddCategory(role), false);
    assert.equal(canManageStations(role), false);
  }
});

test("brand catalog detection prefers explicit brandCatalog flag", () => {
  assert.equal(isBrandCatalogItem({ scope: "SPECIFIC_BRANCHES", brandCatalog: true }), true);
  assert.equal(isBrandCatalogItem({ scope: "ALL_BRANCHES", brandCatalog: false }), false);
  assert.equal(isBrandCatalogItem({ scope: "ALL_BRANCHES" }), true);
});
