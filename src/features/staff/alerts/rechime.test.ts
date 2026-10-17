import assert from "node:assert/strict";
import { test } from "node:test";

import { MAX_RECHIMES, RECHIME_MS, rechimeKey, tickRechimes, type ChimeEntry } from "./rechime.ts";

function entry(last: number, count = 0, ackId = "order-1"): ChimeEntry {
  return { ackId, last, count };
}

test("a live store order chimes at 45s and 90s, then stops", () => {
  const key = rechimeKey("store", "order-1");
  const pending = new Map<string, ChimeEntry>([[key, entry(0)]]);
  const live = new Set([key]);
  const acknowledged = new Set<string>();
  assert.equal(tickRechimes(pending, live, acknowledged, RECHIME_MS), true);
  assert.equal(pending.get(key)?.count, 1);
  assert.equal(tickRechimes(pending, live, acknowledged, RECHIME_MS * 2), true);
  assert.equal(pending.get(key)?.count, MAX_RECHIMES);
  assert.equal(tickRechimes(pending, live, acknowledged, RECHIME_MS * 3), false);
  assert.equal(pending.has(key), false);
});

test("leaving the new list or acknowledging stops further chimes", () => {
  const key = rechimeKey("store", "order-1");
  const gone = new Map<string, ChimeEntry>([[key, entry(0)]]);
  assert.equal(tickRechimes(gone, new Set(), new Set(), RECHIME_MS), false);
  assert.equal(gone.has(key), false);

  const acked = new Map<string, ChimeEntry>([[key, entry(0)]]);
  assert.equal(tickRechimes(acked, new Set([key]), new Set(["order-1"]), RECHIME_MS), false);
  assert.equal(acked.has(key), false);
});

test("a kitchen ticket still chimes from its sub-ticket and stops when the order is opened", () => {
  const key = rechimeKey("kitchen", "ticket-1");
  const pending = new Map<string, ChimeEntry>([[key, { ackId: "order-9", last: 0, count: 0 }]]);
  assert.equal(tickRechimes(pending, new Set([key]), new Set(), RECHIME_MS), true);
  assert.equal(tickRechimes(pending, new Set([key]), new Set(["order-9"]), RECHIME_MS * 2), false);
});
