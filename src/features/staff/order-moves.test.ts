import assert from "node:assert/strict";
import { test } from "node:test";

import { floorStatusOptions, showAmountDue } from "./order-moves.ts";

test("a waiter only serves ready food", () => {
  assert.deepEqual(floorStatusOptions("WAITER", "SUBMITTED", true), []);
  assert.deepEqual(floorStatusOptions("WAITER", "PREPARING", true, true), []);
  assert.deepEqual(floorStatusOptions("WAITER", "READY", true), ["DELIVERED"]);
  assert.deepEqual(floorStatusOptions("WAITER", "READY", false, true), ["DELIVERED"], "dine-in, before paying");
  assert.deepEqual(floorStatusOptions("WAITER", "READY", false, false), [], "takeaway waits for payment");
  assert.deepEqual(floorStatusOptions("WAITER", "DELIVERED", true, true), [], "closing is the cashier's");
  assert.deepEqual(floorStatusOptions("RUNNER", "READY", true), []);
});

test("kitchen path offers only the next legal status", () => {
  assert.deepEqual(floorStatusOptions("CASHIER", "SUBMITTED", false), ["PREPARING"]);
  assert.deepEqual(floorStatusOptions("BRANCH_ADMIN", "PREPARING", false), ["READY"]);
  assert.deepEqual(floorStatusOptions("CASHIER", "READY", false), []);
  assert.deepEqual(floorStatusOptions("CASHIER", "READY", true), ["DELIVERED"]);
});

test("served is never offered, and closed waits for payment", () => {
  assert.deepEqual(floorStatusOptions("CASHIER", "DELIVERED", false), []);
  assert.deepEqual(floorStatusOptions("CASHIER", "DELIVERED", true), ["CLOSED"]);
  assert.deepEqual(floorStatusOptions("SUPER_ADMIN", "SERVED", true), []);
  assert.deepEqual(floorStatusOptions("CASHIER", "CLOSED", true), []);
});

test("amount due replaces a blocked handover or close", () => {
  assert.equal(showAmountDue("READY", false), true);
  assert.equal(showAmountDue("DELIVERED", false), true);
  assert.equal(showAmountDue("SERVED", false), true);
  assert.equal(showAmountDue("READY", true), false);
  assert.equal(showAmountDue("SUBMITTED", false), false);
});

test("a dine-in order can be served before it is paid, but not closed", () => {
  assert.deepEqual(floorStatusOptions("CASHIER", "READY", false, true), ["DELIVERED"]);
  assert.deepEqual(floorStatusOptions("CASHIER", "DELIVERED", false, true), []);
  assert.deepEqual(floorStatusOptions("CASHIER", "DELIVERED", true, true), ["CLOSED"]);
  assert.deepEqual(floorStatusOptions("CASHIER", "READY", false, false), [], "takeaway still waits for payment");
});
