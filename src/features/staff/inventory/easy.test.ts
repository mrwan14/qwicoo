import assert from "node:assert/strict";
import { test } from "node:test";

import { autoSku, foodCostPct, foodCostTone, needsAttention, packPricePerUnit, perPortion, suggestedOrder, unitsFor, validAmount } from "./easy.ts";

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

test("food cost is the share of the price, judged against 35%", () => {
  assert.equal(foodCostPct("27.19", "55"), 49);
  assert.equal(foodCostPct("10", null), null);
  assert.equal(foodCostPct("10", "0"), null);
  assert.equal(foodCostTone(30), "good");
  assert.equal(foodCostTone(40), "watch");
  assert.equal(foodCostTone(49), "high");
  assert.equal(foodCostTone(null), "none");
});

test("a pack price becomes a price for one of the line's unit", () => {
  // A 25 kg sack for 500 → 20 per kilo, or 0.02 per gram.
  assert.equal(packPricePerUnit("500", "25", 1), "20.00");
  assert.equal(packPricePerUnit("500", "25", 0.001), "0.02");
  // 12 pieces for 120, ordered by the box of 50 pieces.
  assert.equal(packPricePerUnit("120", "12", 50), "500.00");
  assert.equal(packPricePerUnit("120", "0", 1), "120.00");
  assert.equal(packPricePerUnit("120", "12", null), null);
});

test("a recipe's cost is split over the portions it makes", () => {
  assert.equal(perPortion("87.762", "500"), 0.175524);
  assert.equal(perPortion("27.19", "1.0000"), 27.19);
  assert.equal(perPortion("10", "0"), 10);
});
