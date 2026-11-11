import assert from "node:assert/strict";
import { test } from "node:test";

import { comboRegularPrice, comboSaving } from "@/lib/combo-saving.ts";

test("tea 100 + sandwich 100 sold together for 100 saves 100, 50%", () => {
  const regular = comboRegularPrice([
    { price: "100.00", quantity: 1 },
    { price: "100.00", quantity: 1 },
  ]);
  assert.equal(regular, "200.00");
  assert.deepEqual(comboSaving("100.00", regular), { regular: "200.00", saving: "100.00", percent: 50 });
});

test("quantity counts and the percent rounds down", () => {
  const regular = comboRegularPrice([
    { price: "45.50", quantity: 2 },
    { price: "30", quantity: 1 },
  ]);
  assert.equal(regular, "121.00");
  assert.deepEqual(comboSaving("100", regular), { regular: "121.00", saving: "21.00", percent: 17 });
});

test("no saving when the combo is not cheaper or a price is unknown", () => {
  assert.equal(comboSaving("200", "200"), null);
  assert.equal(comboSaving("250", "200"), null);
  assert.equal(comboSaving("100", null), null);
  assert.equal(comboRegularPrice([{ price: "10", quantity: 1 }, { price: undefined, quantity: 1 }]), null);
});
