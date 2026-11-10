import assert from "node:assert/strict";
import { test } from "node:test";

import { cleanAmount } from "./amount.ts";

test("cash amounts as staff type them", () => {
  assert.equal(cleanAmount("1250"), "1250.00");
  assert.equal(cleanAmount(" 1,250.5 "), "1250.50");
  assert.equal(cleanAmount("1250,50"), "1250.50");
  assert.equal(cleanAmount("1 250"), "1250.00");
  assert.equal(cleanAmount("0"), "0.00");
  assert.equal(cleanAmount(""), null);
  assert.equal(cleanAmount("-5"), null);
  assert.equal(cleanAmount("12.345"), null);
});
