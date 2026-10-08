import assert from "node:assert/strict";
import { test } from "node:test";

import { floorStatusOptions, showAmountDue } from "./order-moves.ts";

test("a waiter cannot move an order from the floor dropdown", () => {
  assert.deepEqual(floorStatusOptions("WAITER", "SUBMITTED", true), []);
  assert.deepEqual(floorStatusOptions("WAITER", "READY", true), []);
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
