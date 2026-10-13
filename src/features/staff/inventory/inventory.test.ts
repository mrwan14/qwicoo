import assert from "node:assert/strict";
import { test } from "node:test";

import { friendlyMessage } from "@/lib/api/error.ts";
import {
  canApproveTransfer,
  canOpenInventory,
  canOpenInventoryPage,
  INVENTORY_HREFS,
  inventoryPagesFor,
} from "@/features/staff/inventory/access.ts";
import { countReview } from "@/features/staff/inventory/counts.ts";
import { importCommitAllowed } from "@/features/staff/inventory/csv.ts";
import { formatPlateCost } from "@/features/staff/inventory/cost.ts";
import { previewPrepConsumption } from "@/features/staff/inventory/prep.ts";
import { purchaseCancel } from "@/features/staff/inventory/purchasing.ts";
import { canReceiveTransfer, transferTargets, warehouseLabel } from "@/features/staff/inventory/transfers.ts";
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

test("count review shows the payload variance, including an empty count", () => {
  const review = countReview({
    expected_qty: "10",
    counted_qty: "8",
    variance_qty: "-2",
    variance_value: "-4.00",
  });
  assert.equal(review.expected, "10");
  assert.equal(review.counted, "8");
  assert.equal(review.varianceQty, "-2");
  assert.equal(review.varianceValue, "-4.00");
  const open = countReview({ expected_qty: "3", counted_qty: null, variance_qty: null, variance_value: null });
  assert.equal(open.counted, null);
  assert.equal(open.varianceQty, null);
});

test("suppliers and purchase orders follow catalogue and stock roles", () => {
  assert.equal(canOpenInventoryPage("KITCHEN_STAFF", "suppliers"), true);
  assert.equal(canOpenInventoryPage("KITCHEN_STAFF", "purchaseOrders"), true);
  assert.equal(canOpenInventoryPage("WAITER", "purchaseOrders"), false);
  assert.ok(Object.values(INVENTORY_HREFS).includes("/app/inventory/purchase-orders"));
  assert.equal(canOpenInventoryPage("KITCHEN_STAFF", "counts"), true);
  assert.equal(canOpenInventoryPage("CASHIER", "counts"), true);
  assert.equal(canOpenInventoryPage("WAITER", "counts"), false);
  assert.ok(Object.values(INVENTORY_HREFS).includes("/app/inventory/counts"));
  assert.equal(canOpenInventoryPage("KITCHEN_STAFF", "transfers"), true);
  assert.equal(canApproveTransfer("BRANCH_ADMIN"), false);
  assert.equal(canApproveTransfer("REGIONAL_MANAGER"), true);
  assert.ok(Object.values(INVENTORY_HREFS).includes("/app/inventory/transfers"));
});

test("a purchase with receipts closes instead of cancelling", () => {
  assert.deepEqual(purchaseCancel("DRAFT", 0), { closeRemaining: false });
  assert.deepEqual(purchaseCancel("SENT", 0), { closeRemaining: false });
  assert.deepEqual(purchaseCancel("SENT", 2), { closeRemaining: true });
  assert.deepEqual(purchaseCancel("PARTIALLY_RECEIVED", 2), { closeRemaining: true });
  assert.equal(purchaseCancel("RECEIVED", 4), null);
  assert.equal(purchaseCancel("CANCELLED", 0), null);
  assert.equal(purchaseCancel("CLOSED", 1), null);
});

test("csv preview blocks commit while any row is an error", () => {
  assert.equal(importCommitAllowed([{ action: "create" }, { action: "update" }]), true);
  assert.equal(importCommitAllowed([{ action: "create" }, { action: "error" }]), false);
  assert.equal(importCommitAllowed([]), false);
});

test("warehouse labels use the branch name and the translated store type", () => {
  const labels = { branchStore: "Branch store", centralKitchen: "Central kitchen" };
  const arabic = { branchStore: "مخزن الفرع", centralKitchen: "مطبخ مركزي" };
  const branch = { name: "Branch store", branch_name: { en: "Zamalek", ar: "الزمالك" }, is_central: false };
  assert.equal(warehouseLabel(branch, "en", labels), "\u2068Zamalek\u2069 · \u2068Branch store\u2069");
  assert.equal(warehouseLabel(branch, "ar", arabic), "\u2068الزمالك\u2069 · \u2068مخزن الفرع\u2069");
  assert.equal(
    warehouseLabel({ name: "Branch store", kind: "BRANCH_STORE", branchName: { en: "Zamalek", ar: "الزمالك" } }, "en", labels),
    "\u2068Zamalek\u2069 · \u2068Branch store\u2069",
  );
  assert.equal(warehouseLabel({ name: "Branch store", kind: "BRANCH_STORE", branch_name: null }, "en", { ...labels, branchStore: "Store" }), "\u2068Store\u2069");
  assert.equal(
    warehouseLabel({ name: "Commissary", kind: "CENTRAL_KITCHEN", branchName: null }, "en", labels),
    "\u2068Commissary\u2069 · \u2068Central kitchen\u2069",
  );
  assert.equal(
    warehouseLabel({ name: "المطبخ", is_central: true, branch_name: null }, "ar", arabic),
    "\u2068المطبخ\u2069 · \u2068مطبخ مركزي\u2069",
  );
  const choices = transferTargets(
    [
      { id: "store-a" },
      { id: "store-b" },
      { id: "kitchen" },
    ],
    "store-a",
  );
  assert.deepEqual(choices.map((item) => item.id), ["store-b", "kitchen"]);
});

test("receive stays on the destination branch", () => {
  const warehouses = [
    { id: "store-a", branchId: "branch-a", central: false },
    { id: "store-b", branchId: "branch-b", central: false },
    { id: "kitchen", branchId: null, central: true },
  ];
  const sent = { status: "SENT", focusedBranchId: "branch-a", warehouses };
  assert.equal(canReceiveTransfer({ ...sent, role: "BRANCH_ADMIN", toWarehouseId: "store-b" }), false);
  assert.equal(canReceiveTransfer({ ...sent, role: "BRANCH_ADMIN", toWarehouseId: "store-a" }), true);
  assert.equal(canReceiveTransfer({ ...sent, role: "BRANCH_ADMIN", toWarehouseId: "kitchen" }), false);
  assert.equal(canReceiveTransfer({ ...sent, role: "BRANCH_ADMIN", toWarehouseId: "store-a", status: "APPROVED" }), false);
  assert.equal(canReceiveTransfer({ ...sent, role: "KITCHEN_STAFF", toWarehouseId: "store-a" }), false);
  assert.equal(canReceiveTransfer({ ...sent, role: "REGIONAL_MANAGER", toWarehouseId: "store-a" }), true);
  assert.equal(canReceiveTransfer({ ...sent, role: "REGIONAL_MANAGER", toWarehouseId: "kitchen" }), false);
  assert.equal(canReceiveTransfer({ ...sent, role: "BRAND_ADMIN", toWarehouseId: "kitchen" }), true);
  assert.equal(canReceiveTransfer({ ...sent, role: "BRAND_ADMIN", toWarehouseId: "store-b" }), false);
});
