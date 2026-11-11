import assert from "node:assert/strict";
import { test } from "node:test";

import { billTotalsMatch, cairoDay, moneyInput, priceChange } from "./bills.ts";

test("amounts go to the API with two decimals", () => {
  assert.equal(moneyInput("1,250.5"), "1250.50");
  assert.equal(moneyInput(220.8), "220.80");
  assert.equal(moneyInput("abc"), "0.00");
});

test("before VAT plus VAT must equal the total", () => {
  assert.ok(billTotalsMatch("220.00", "30.80", "250.80"));
  assert.ok(!billTotalsMatch("220.00", "30.80", "999.00"));
});

test("price change compares billed with ordered", () => {
  assert.equal(priceChange("20.0000", "22.0000"), 1);
  assert.equal(priceChange("20", "18.5"), -1);
  assert.equal(priceChange("20.0000", "20"), 0);
});

test("Cairo day is a date string", () => {
  assert.equal(cairoDay(new Date("2026-11-11T23:30:00Z")), "2026-11-12");
});
