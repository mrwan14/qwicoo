import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cancelOffer,
  deliveredCashCollected,
  deliveryStatusLabel,
  matchesOrderChannel,
  parseDeliveryOrders,
  staffOrderStatus,
} from "./delivery.ts";

test("delivery wording follows the driver step", () => {
  assert.equal(deliveryStatusLabel("awaiting_dispatch", "en"), "Ready, waiting for the driver");
  assert.equal(deliveryStatusLabel("on_the_way", "ar"), "في الطريق");
  assert.equal(deliveryStatusLabel("delivered", "en"), "Delivered");
  assert.equal(
    staffOrderStatus({
      fulfillmentType: "DELIVERY",
      deliveryStatus: "on_the_way",
      fallback: "Collected",
      locale: "en",
    }),
    "On the way",
  );
  assert.equal(
    staffOrderStatus({
      fulfillmentType: "DELIVERY",
      deliveryStatus: "",
      fallback: "Collected",
      locale: "en",
    }),
    "Collected",
  );
  assert.equal(
    staffOrderStatus({
      fulfillmentType: "DINE_IN",
      deliveryStatus: "on_the_way",
      fallback: "Ready",
      locale: "en",
    }),
    "Ready",
  );
});

test("cancel stays with a branch admin once the kitchen has the order", () => {
  assert.equal(cancelOffer("CASHIER", "PENDING_STAFF_CONFIRMATION"), "reject");
  assert.equal(cancelOffer("WAITER", "PENDING_STAFF_CONFIRMATION"), "reject");
  assert.equal(cancelOffer("CASHIER", "SUBMITTED"), "locked");
  assert.equal(cancelOffer("CASHIER", "PREPARING"), "locked");
  assert.equal(cancelOffer("BRANCH_ADMIN", "PREPARING"), "cancel");
  assert.equal(cancelOffer("BRAND_ADMIN", "SUBMITTED"), "cancel");
  assert.equal(cancelOffer("KITCHEN_STAFF", "SUBMITTED"), "hidden");
  assert.equal(cancelOffer("CASHIER", "READY"), "hidden");
});

test("cash is collected only for an unpaid delivery", () => {
  assert.equal(deliveredCashCollected(false), true);
  assert.equal(deliveredCashCollected(true), false);
});

test("order filters use the fields the history API already returns", () => {
  const mobile = { order_source: "TAKE_A_WAY_APP", fulfillment_type: "DELIVERY" };
  const table = { order_source: "QR_CUSTOMER", fulfillment_type: "DINE_IN" };
  assert.equal(matchesOrderChannel(mobile, "mobile"), true);
  assert.equal(matchesOrderChannel(table, "mobile"), false);
  assert.equal(matchesOrderChannel(mobile, "delivery"), true);
  assert.equal(matchesOrderChannel(table, "delivery"), false);
  assert.equal(matchesOrderChannel(table, ""), true);
});

test("a delivery card keeps today's fields and hides extras the payload does not send", () => {
  const [order] = parseDeliveryOrders([
    {
      id: "66666666-6666-6666-6666-666666666666",
      display_number: "14",
      status: "READY",
      delivery_status: "awaiting_dispatch",
      address: { street: "12 Nile Street", phone: "+201001234567", latitude: "30.04", longitude: "31.23" },
      total: "55.00",
      is_paid: false,
      created_at: "2026-10-16T12:00:00Z",
    },
  ]);
  assert.equal(order?.displayNumber, "14");
  assert.equal(order?.address?.street, "12 Nile Street");
  assert.equal(order?.customerName, null);
  assert.equal(order?.items, null);
  assert.equal(order?.deliveryFee, null);
});
