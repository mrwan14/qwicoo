import assert from "node:assert/strict";
import { test } from "node:test";

import { customAmountValid, defaultSplit, equalShare, fromCents, splitAmount, toCents } from "./bill-split.ts";

test("cents round-trip", () => {
  assert.equal(toCents("12.345"), 1235);
  assert.equal(toCents("7,5"), 750);
  assert.equal(fromCents(1205), "12.05");
  assert.equal(fromCents(-3), "0.00");
});

test("equal share rounds up and never passes what is left", () => {
  assert.equal(equalShare("100.00", "100.00", 3), "33.34");
  assert.equal(equalShare("100.00", "20.00", 3), "20.00");
  assert.equal(equalShare("80.00", "80.00", 0), "80.00");
});

test("split amount per mode", () => {
  const base = { total: "300.00", remaining: "200.00", myItemsDue: "120.00", people: 4, custom: "" };
  assert.equal(splitAmount({ ...base, mode: "full" }), "200.00");
  assert.equal(splitAmount({ ...base, mode: "mine" }), "120.00");
  assert.equal(splitAmount({ ...base, mode: "equal" }), "75.00");
  assert.equal(splitAmount({ ...base, mode: "custom", custom: "500" }), "200.00");
  assert.equal(splitAmount({ ...base, mode: "mine", myItemsDue: "999" }), "200.00");
  assert.equal(splitAmount({ ...base, remaining: "0.00", mode: "full" }), "0.00");
});

test("custom amounts must be positive, two decimals, within the balance", () => {
  assert.equal(customAmountValid("50", "80.00"), true);
  assert.equal(customAmountValid("50.5", "80.00"), true);
  assert.equal(customAmountValid("0", "80.00"), false);
  assert.equal(customAmountValid("80.01", "80.00"), false);
  assert.equal(customAmountValid("1.234", "80.00"), false);
  assert.equal(customAmountValid("abc", "80.00"), false);
});

test("opens on my items only when I share the table and owe something", () => {
  assert.equal(defaultSplit("40.00", 2), "mine");
  assert.equal(defaultSplit("40.00", 1), "full");
  assert.equal(defaultSplit("0.00", 3), "full");
});
