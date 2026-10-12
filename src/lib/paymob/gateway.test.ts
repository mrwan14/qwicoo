import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canManagePaymobGateway,
  canRefundPaymob,
  paymobUpsertBody,
  secretForUpsert,
  setupChecklist,
  type PaymobDraft,
} from "./gateway.ts";

const draft: PaymobDraft = {
  secretKey: "",
  publicKey: "",
  hmacSecret: "",
  card: "1",
  wallet: "",
  kiosk: "",
  currency: "EGP",
  isLive: false,
  isActive: true,
};

test("an empty secret is omitted and a typed secret is sent", () => {
  assert.equal(secretForUpsert(""), undefined);
  assert.equal(secretForUpsert("   "), undefined);
  const saved = paymobUpsertBody({ ...draft, secretKey: "egy_sk_test_typed" }, true);
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.body.secret_key, "egy_sk_test_typed");
  assert.equal("public_key" in saved.body, false);
  assert.equal("hmac_secret" in saved.body, false);
});

test("masked secret text is never submitted", () => {
  assert.equal(secretForUpsert("****1234"), undefined);
  const saved = paymobUpsertBody(
    { ...draft, secretKey: "****1234", publicKey: "****wxyz", hmacSecret: "****abcd" },
    true,
  );
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.body.secret_key, undefined);
  assert.equal(saved.body.public_key, undefined);
  assert.equal(saved.body.hmac_secret, undefined);
});

test("a single setup error marks earlier checks passed and later ones unchecked", () => {
  assert.deepEqual(setupChecklist("PAYMOB_HMAC_SECRET_MISSING"), {
    secret: "passed",
    public: "passed",
    hmac: "failed",
    integration: "pending",
  });
});

test("brand settings stay with super admin and brand admin", () => {
  assert.equal(canManagePaymobGateway("SUPER_ADMIN"), true);
  assert.equal(canManagePaymobGateway("BRAND_ADMIN"), true);
  for (const role of ["REGIONAL_MANAGER", "BRANCH_ADMIN", "CASHIER", "WAITER", "KITCHEN_STAFF", "RUNNER", null]) {
    assert.equal(canManagePaymobGateway(role), false, role ?? "signed out");
  }
});

test("refund stays hidden below cashier", () => {
  for (const role of ["CASHIER", "BRANCH_ADMIN", "REGIONAL_MANAGER", "BRAND_ADMIN", "SUPER_ADMIN"]) {
    assert.equal(canRefundPaymob(role), true, role);
  }
  for (const role of ["WAITER", "KITCHEN_STAFF", "RUNNER", null]) {
    assert.equal(canRefundPaymob(role), false, role ?? "signed out");
  }
});
