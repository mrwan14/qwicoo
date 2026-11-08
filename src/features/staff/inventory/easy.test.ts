import assert from "node:assert/strict";
import { test } from "node:test";

import { autoSku, needsAttention, suggestedOrder, unitsFor, validAmount } from "./easy.ts";

const row = (status: "ok" | "low" | "out" | "negative", on_hand = "0", par_level = "10", reorder_level = "4") => ({ status, on_hand, par_level, reorder_level });

test("items needing attention come out of stock first", () => {
  const list = needsAttention([row("low"), row("ok"), row("out"), row("negative")]);
  assert.deepEqual(list.map((item) => item.status), ["negative", "out", "low"]);
});

test("the suggested order fills back up to the order-up-to level", () => {
  assert.equal(suggestedOrder(row("low", "2", "12", "4")), 10);
  assert.equal(suggestedOrder(row("out", "-3", "12", "4")), 12);
  assert.equal(suggestedOrder(row("low", "1", "0", "4")), 3);
  assert.equal(suggestedOrder(row("ok", "20", "12", "4")), 0);
});

test("only units the item converts to are offered, base unit first", () => {
  const units = [{ id: "g" }, { id: "kg" }, { id: "pcs" }, { id: "l" }];
  const edges = [{ ingredientId: null, fromUnitId: "kg", toUnitId: "g", factor: "1000" }];
  assert.deepEqual(unitsFor(units, edges, "flour", "g").map((unit) => unit.id), ["g", "kg"]);
  assert.deepEqual(unitsFor(units, edges, "flour", undefined).length, 4);
});

test("item codes come from the name and stay unique", () => {
  assert.equal(autoSku("Oat milk", []), "OAT-MILK");
  assert.equal(autoSku("Oat milk", ["oat-milk"]), "OAT-MILK-2");
  assert.equal(autoSku("حليب", []), "ITEM");
  assert.equal(autoSku("Café crème brûlée extra", []), "CAFE-CREME-BRULEE");
});

test("amounts must be positive with up to three decimals", () => {
  assert.equal(validAmount("2.5"), true);
  assert.equal(validAmount("0"), false);
  assert.equal(validAmount("1.2345"), false);
  assert.equal(validAmount("-1"), false);
});
