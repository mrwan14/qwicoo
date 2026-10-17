import assert from "node:assert/strict";
import { test } from "node:test";

import { isRetailType, storeStockView } from "./store.ts";

test("available stock is on hand minus what is held", () => {
  assert.deepEqual(storeStockView(8, 2), { available: 6, badge: null });
  assert.deepEqual(storeStockView(6, 2), { available: 4, badge: "low" });
  assert.deepEqual(storeStockView(5, 0), { available: 5, badge: "low" });
  assert.deepEqual(storeStockView(2, 2), { available: 0, badge: "out" });
  assert.deepEqual(storeStockView(1, 3), { available: -2, badge: "out" });
});

test("only RETAIL is a Store item", () => {
  assert.equal(isRetailType("RETAIL"), true);
  assert.equal(isRetailType("retail"), true);
  assert.equal(isRetailType("PREPARED"), false);
  assert.equal(isRetailType(null), false);
});
