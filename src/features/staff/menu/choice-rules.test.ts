import assert from "node:assert/strict";
import { test } from "node:test";

import { cleanPrice, limitsOf, ruleOf } from "./choice-rules.ts";

test("API limits read as staff rules", () => {
  assert.deepEqual(ruleOf(1, 1), { required: true, several: false, max: 1 });
  assert.deepEqual(ruleOf(0, 1), { required: false, several: false, max: 1 });
  assert.deepEqual(ruleOf(0, 3), { required: false, several: true, max: 3 });
  assert.deepEqual(ruleOf(0, 0), { required: false, several: false, max: 1 }, "0 max is treated as one");
  assert.equal(ruleOf(0, 50).max, 10, "capped");
});

test("rules go back to API limits", () => {
  assert.deepEqual(limitsOf({ required: true, several: false, max: 7 }), { min_choices: 1, max_choices: 1, is_required: true });
  assert.deepEqual(limitsOf({ required: false, several: true, max: 1 }), { min_choices: 0, max_choices: 2, is_required: false }, "several means at least 2");
  assert.deepEqual(limitsOf({ required: true, several: true, max: 4 }), { min_choices: 1, max_choices: 4, is_required: true });
});

test("extra prices", () => {
  assert.equal(cleanPrice(""), "0.00");
  assert.equal(cleanPrice("10"), "10.00");
  assert.equal(cleanPrice(" 7,5 "), "7.50");
  assert.equal(cleanPrice("-3"), null);
  assert.equal(cleanPrice("abc"), null);
  assert.equal(cleanPrice("1.234"), null);
});
