import assert from "node:assert/strict";
import { test } from "node:test";

import { orderSettled, resultView } from "./result.ts";

test("a paid URL is not paid until the order itself is paid", () => {
  const settled = orderSettled({ id: "order-1", is_paid: false, payments: [] }, "order-1");
  assert.equal(settled, false);
  assert.equal(resultView({ urlStatus: "paid", settled, timedOut: false }), "confirming");
});

test("an order marked paid is paid, including a completed Paymob row", () => {
  assert.equal(orderSettled({ id: "order-1", is_paid: true }, "order-1"), true);
  assert.equal(
    orderSettled(
      { id: "order-1", is_paid: false, payments: [{ payment_method: "PAYMOB", status: "COMPLETED" }] },
      "order-1",
    ),
    true,
  );
  assert.equal(resultView({ urlStatus: "paid", settled: true, timedOut: false }), "paid");
});

test("a timeout stays unconfirmed", () => {
  assert.equal(resultView({ urlStatus: "paid", settled: false, timedOut: true }), "timeout");
  assert.equal(resultView({ urlStatus: "pending", settled: false, timedOut: true }), "timeout");
});

test("a different order is not treated as this payment", () => {
  assert.equal(orderSettled({ id: "other", is_paid: true }, "order-1"), false);
});
