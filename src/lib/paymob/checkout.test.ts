import assert from "node:assert/strict";
import { test } from "node:test";

import { attemptFingerprint, nextPayAttempt, normalizePaymobPhone } from "./checkout.ts";

test("the idempotency key is reused on retry and replaced when amount or phone changes", () => {
  const orderId = "order-1";
  const firstPrint = attemptFingerprint({ orderId, amount: "40.00", phone: "+201001234567" });
  const first = nextPayAttempt(null, firstPrint, () => "key-1");
  const retry = nextPayAttempt(first, firstPrint, () => "key-2");
  assert.equal(retry.key, "key-1");

  const newAmount = attemptFingerprint({ orderId, amount: "20.00", phone: "+201001234567" });
  const afterAmount = nextPayAttempt(retry, newAmount, () => "key-3");
  assert.equal(afterAmount.key, "key-3");

  const newPhone = attemptFingerprint({ orderId, amount: "20.00", phone: "+201009999999" });
  const afterPhone = nextPayAttempt(afterAmount, newPhone, () => "key-4");
  assert.equal(afterPhone.key, "key-4");
});

test("phone keeps an optional plus and 8 to 15 digits", () => {
  assert.equal(normalizePaymobPhone("+20 100-123-4567"), "+201001234567");
  assert.equal(normalizePaymobPhone("1234567"), null);
  assert.equal(normalizePaymobPhone(""), null);
});
