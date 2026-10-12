import assert from "node:assert/strict";
import { test } from "node:test";

import { friendlyMessage } from "@/lib/api/error.ts";
import {
  canOpenInventory,
  canOpenInventoryPage,
  INVENTORY_HREFS,
  inventoryPagesFor,
} from "@/features/staff/inventory/access.ts";
import { importCommitAllowed } from "@/features/staff/inventory/csv.ts";
import { formatPlateCost } from "@/features/staff/inventory/cost.ts";
import { previewPrepConsumption } from "@/features/staff/inventory/prep.ts";
import { conversionFactor } from "@/features/staff/inventory/units.ts";
import type { UserRole } from "@/lib/auth/roles.ts";

const ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "BRAND_ADMIN",
  "REGIONAL_MANAGER",
  "BRANCH_ADMIN",
  "CASHIER",
  "WAITER",
  "KITCHEN_STAFF",
  "RUNNER",
];

test("waiter and runner have no inventory pages", () => {
  for (const role of ["WAITER", "RUNNER"] as const) {
    assert.equal(canOpenInventory(role), false);
    assert.deepEqual(inventoryPagesFor(role), []);
    assert.equal(canOpenInventoryPage(role, "stock"), false);
    assert.equal(canOpenInventoryPage(role, "waste"), false);
  }
});

test("inventory pages follow the API role sets", () => {
  assert.equal(canOpenInventoryPage("KITCHEN_STAFF", "stock"), true);
  assert.equal(canOpenInventoryPage("KITCHEN_STAFF", "movements"), true);
  assert.equal(canOpenInventoryPage("KITCHEN_STAFF", "waste"), true);
  assert.equal(canOpenInventoryPage("KITCHEN_STAFF", "prep"), false);
  assert.equal(canOpenInventoryPage("KITCHEN_STAFF", "import"), false);
  assert.equal(canOpenInventoryPage("KITCHEN_STAFF", "reports"), false);
  assert.equal(canOpenInventoryPage("CASHIER", "stock"), true);
  assert.equal(canOpenInventoryPage("CASHIER", "waste"), true);
  assert.equal(canOpenInventoryPage("CASHIER", "prep"), false);
  assert.equal(canOpenInventoryPage("BRANCH_ADMIN", "prep"), true);
  assert.equal(canOpenInventoryPage("BRANCH_ADMIN", "import"), false);
  assert.equal(canOpenInventoryPage("BRAND_ADMIN", "import"), true);
  assert.equal(canOpenInventoryPage("REGIONAL_MANAGER", "reports"), true);
  assert.equal(canOpenInventoryPage("REGIONAL_MANAGER", "import"), false);
  for (const role of ROLES) {
    if (canOpenInventory(role)) assert.ok(inventoryPagesFor(role).includes("stock"));
  }
});

test("an ingredient pack beats a brand conversion", () => {
  const edges = [
    { ingredientId: "flour", fromUnitId: "pack", toUnitId: "unit", factor: "12" },
    { ingredientId: null, fromUnitId: "pack", toUnitId: "unit", factor: "10" },
  ];
  assert.equal(conversionFactor(edges, "flour", "unit", "pack"), 1 / 12);
  assert.equal(conversionFactor(edges, "sugar", "unit", "pack"), 0.1);
  assert.equal(conversionFactor(edges, "flour", "pack", "unit"), 12);
  assert.equal(conversionFactor(edges, "flour", "missing", "unit"), null);
});

test("plate cost formats money and margin", () => {
  const en = formatPlateCost({ cost: "12.5", price: "40", marginPct: "68.75" }, "EGP", "en");
  assert.match(en.cost, /12\.50/);
  assert.match(en.cost, /EGP/);
  assert.equal(en.margin, "68.75%");
  const ar = formatPlateCost({ cost: "12.5", price: null, marginPct: null }, "EGP", "ar");
  assert.equal(ar.price, null);
  assert.equal(ar.margin, null);
  assert.match(ar.cost, /12\.50/);
});

test("prep preview explodes to leaves and does not consume the prep sku", () => {
  const gram = "g";
  const ingredients = [
    { id: "flour", sku: "FLOUR", isPrep: false, baseUnitId: gram },
    { id: "dough", sku: "DOUGH", isPrep: true, baseUnitId: gram },
    { id: "sauce", sku: "SAUCE", isPrep: true, baseUnitId: gram },
  ];
  const recipes = [
    {
      id: "dough-recipe",
      prepIngredientId: "dough",
      yieldQty: "1",
      isActive: true,
      lines: [{ ingredientId: "flour", qty: "100", unitId: gram, wastePct: "0" }],
    },
    {
      id: "sauce-recipe",
      prepIngredientId: "sauce",
      yieldQty: "1",
      isActive: true,
      lines: [{ ingredientId: "dough", qty: "2", unitId: gram, wastePct: "0" }],
    },
  ];
  const preview = previewPrepConsumption(recipes[1], 3, recipes, ingredients, []);
  assert.equal(preview.ok, true);
  if (!preview.ok) return;
  assert.deepEqual(preview.leaves.map((leaf) => leaf.sku), ["FLOUR"]);
  assert.equal(preview.leaves[0]?.qty, 600);
  const cycle = previewPrepConsumption(
    {
      id: "loop",
      prepIngredientId: "sauce",
      yieldQty: "1",
      isActive: true,
      lines: [{ ingredientId: "sauce", qty: "1", unitId: gram, wastePct: "0" }],
    },
    1,
    [
      {
        id: "loop",
        prepIngredientId: "sauce",
        yieldQty: "1",
        isActive: true,
        lines: [{ ingredientId: "sauce", qty: "1", unitId: gram, wastePct: "0" }],
      },
    ],
    ingredients,
    [],
  );
  assert.equal(cycle.ok, false);
  if (!cycle.ok) assert.equal(cycle.code, "RECIPE_CYCLE");
});

test("inventory errors have english and arabic copy", () => {
  for (const code of ["INSUFFICIENT_STOCK", "REASON_REQUIRED", "WASTE_REASON", "NOTE_REQUIRED", "SKU_TAKEN", "RECIPE_CYCLE"]) {
    const en = friendlyMessage(code, "fallback", "en");
    const ar = friendlyMessage(code, "fallback", "ar");
    assert.notEqual(en, code);
    assert.notEqual(ar, "fallback");
    assert.notEqual(en, ar);
  }
});

test("purchasing screens stay out of this slice", () => {
  const hrefs = Object.values(INVENTORY_HREFS);
  assert.equal(hrefs.some((href) => /supplier|purchase|count|transfer/i.test(href)), false);
  assert.ok(hrefs.includes("/app/inventory/waste"));
  assert.ok(hrefs.includes("/app/inventory/prep"));
});

test("csv preview blocks commit while any row is an error", () => {
  assert.equal(importCommitAllowed([{ action: "create" }, { action: "update" }]), true);
  assert.equal(importCommitAllowed([{ action: "create" }, { action: "error" }]), false);
  assert.equal(importCommitAllowed([]), false);
});
