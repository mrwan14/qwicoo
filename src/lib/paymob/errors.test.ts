import assert from "node:assert/strict";
import { test } from "node:test";

import { friendlyMessage } from "../api/error.ts";
import { paymobError } from "./errors.ts";

const CODES = [
  "PAYMOB_PHONE_REQUIRED",
  "PAYMOB_AUTH_FAILED",
  "PAYMOB_INTEGRATION_INVALID",
  "PAYMOB_REJECTED",
  "PUBLIC_API_BASE_URL_UNSET",
  "PAYMOB_REFUND_EXCEEDS_CAPTURED",
  "ACCESS_FORBIDDEN_BRAND_MISMATCH",
  "PAYMOB_SECRET_KEY_FORMAT",
  "PAYMOB_PUBLIC_KEY_FORMAT",
  "PAYMOB_HMAC_SECRET_MISSING",
  "PAYMOB_INTEGRATION_REQUIRED",
  "PAYMOB_GATEWAY_NOT_CONFIGURED",
  "PAYMOB_SECRETS_REQUIRED",
  "PAYMOB_GATEWAY_INACTIVE",
  "PAYMOB_PHONE_INVALID",
  "PAYMOB_REFUND_NOT_CAPTURABLE",
  "PAYMOB_PAYMENT_IN_PROGRESS",
  "IDEMPOTENCY_KEY_MISMATCH",
] as const;

test("currency mismatch names both currencies in English and Arabic", () => {
  const body = { detail: { code: "PAYMOB_CURRENCY_MISMATCH", gateway_currency: "USD", branch_currency: "EGP" } };
  const response = new Response(null, { status: 422 });
  const en = paymobError(body, response, "fallback", "en");
  const ar = paymobError(body, response, "fallback", "ar");
  assert.match(en.message, /USD/);
  assert.match(en.message, /EGP/);
  assert.match(ar.message, /USD/);
  assert.match(ar.message, /EGP/);
  assert.notEqual(en.message, ar.message);
});

test("listed Paymob codes map to English and Arabic", () => {
  for (const code of CODES) {
    const en = friendlyMessage(code, "fallback", "en");
    const ar = friendlyMessage(code, "fallback", "ar");
    assert.notEqual(en, "fallback", code);
    assert.notEqual(ar, "fallback", code);
    assert.notEqual(en, ar, code);
  }
});
