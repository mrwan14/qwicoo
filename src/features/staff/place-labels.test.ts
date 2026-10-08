import assert from "node:assert/strict";
import { test } from "node:test";

import { kitchenTicketKind, paymentPlaceLabel, vehicleDetails } from "./place-labels.ts";

test("payments name the channel when there is no pickup number", () => {
  assert.equal(paymentPlaceLabel({ pickup_number: 104 }), "Pickup 104");
  assert.equal(paymentPlaceLabel({ fulfillment_type: "DRIVE_THRU" }), "Drive-thru");
  assert.equal(paymentPlaceLabel({ fulfillment_type: "curbside" }), "Drive-thru");
  assert.equal(paymentPlaceLabel({ fulfillment_type: "POS_TAKEAWAY" }), "Takeaway");
  assert.equal(paymentPlaceLabel({ fulfillment_type: "DINE_IN", display_number: "12" }), "Table 12");
});

test("a drive-thru ticket is not labelled takeaway", () => {
  assert.equal(kitchenTicketKind({ order_type: "TAKEAWAY", order_channel: "DRIVE_THRU" }), "Drive-thru");
  assert.equal(kitchenTicketKind({ order_type: "TAKEAWAY", fulfillment_type: "CURBSIDE" }), "Drive-thru");
  assert.equal(kitchenTicketKind({ order_type: "TAKEAWAY", order_channel: "POS_TAKEAWAY" }), "Takeaway");
  assert.equal(kitchenTicketKind({ order_type: "DINE_IN" }), "Dine in");
});

test("car details use plate, colour, and make", () => {
  assert.equal(vehicleDetails({ colour: "White", make: "Corolla", plate: "ABC 123" }), "White · Corolla · ABC 123");
  assert.equal(vehicleDetails({ color: "White", model: "Corolla", plate_number: "ABC 123" }), "White · Corolla · ABC 123");
  assert.equal(vehicleDetails(null), "");
});
