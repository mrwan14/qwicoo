import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError } from "@/lib/api/error";

import { groupCartLinesByGuest, isCartConflict } from "./cart-client.ts";

test("groups cart lines by nickname then guest_name", () => {
  const groups = groupCartLinesByGuest([
    {
      id: "1",
      guest_name: "Ada",
      nickname: "Ada",
      item_id: "a",
      item_name: "Tea",
      unit_price: "10.00",
      quantity: 1,
      line_total: "10.00",
      added_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "2",
      guest_name: "Bob",
      nickname: null,
      item_id: "b",
      item_name: "Coffee",
      unit_price: "12.00",
      quantity: 1,
      line_total: "12.00",
      added_at: "2026-01-01T00:00:01Z",
    },
    {
      id: "3",
      guest_name: "Ada Lovelace",
      nickname: "Ada",
      item_id: "c",
      item_name: "Cake",
      unit_price: "20.00",
      quantity: 1,
      line_total: "20.00",
      added_at: "2026-01-01T00:00:02Z",
    },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.guestName, "Ada");
  assert.equal(groups[0]?.lines.length, 2);
  assert.equal(groups[1]?.guestName, "Bob");
});

test("isCartConflict detects version and submit conflicts", () => {
  assert.equal(isCartConflict(new ApiError(409, "stale", "CART_VERSION_CONFLICT")), true);
  assert.equal(isCartConflict(new ApiError(409, "stale", "CART_SUBMIT_CONFLICT")), true);
  assert.equal(isCartConflict(new ApiError(409, "other", "ACTIVE_ORDER_EXISTS")), false);
  assert.equal(isCartConflict(new ApiError(400, "bad", "EMPTY_CART")), false);
});
