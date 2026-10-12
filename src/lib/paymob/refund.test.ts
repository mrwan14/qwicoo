import assert from "node:assert/strict";
import { test } from "node:test";

import { refundableAmount } from "./refund.ts";

test("the refund dialog uses refundable_amount and ignores a zero or empty value", () => {
  assert.equal(refundableAmount("29.99"), "29.99");
  assert.equal(refundableAmount("0.00"), null);
  assert.equal(refundableAmount(null), null);
  assert.equal(refundableAmount("  "), null);
});
