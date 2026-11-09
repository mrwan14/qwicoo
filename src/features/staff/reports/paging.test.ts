import assert from "node:assert/strict";
import { test } from "node:test";

import { loadSince, monthsIn, weightedCancelRate } from "./paging";

type Row = { day: string };

function source(days: string[]) {
  const calls: number[] = [];
  return {
    calls,
    load: async (offset: number, limit: number) => {
      calls.push(offset);
      return { rows: days.slice(offset, offset + limit).map((day) => ({ day })), total: days.length };
    },
  };
}

test("loadSince stops once a newest-first page passes the start day", async () => {
  const days = ["2026-11-09", "2026-11-08", "2026-11-07", "2026-11-06", "2026-11-05", "2026-11-04"];
  const api = source(days);
  const result = await loadSince<Row>({ from: "2026-11-07", dayOf: (row) => row.day, load: api.load, limit: 2 });
  assert.deepEqual(api.calls, [0, 2]);
  assert.equal(result.complete, true);
  assert.equal(result.rows.length, 4);
});

test("loadSince reads an oldest-first list to the end", async () => {
  const days = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"];
  const api = source(days);
  const result = await loadSince<Row>({ from: "2026-11-04", dayOf: (row) => row.day, load: api.load, limit: 2 });
  assert.deepEqual(api.calls, [0, 2, 4]);
  assert.equal(result.rows.length, 5);
  assert.equal(result.complete, true);
});

test("loadSince reports a cut-short list", async () => {
  const days = Array.from({ length: 10 }, () => "2026-11-09");
  const api = source(days);
  const result = await loadSince<Row>({ from: "2026-11-01", dayOf: (row) => row.day, load: api.load, limit: 2, maxPages: 2 });
  assert.equal(result.complete, false);
  assert.equal(result.rows.length, 4);
});

test("monthsIn spans year ends", () => {
  assert.deepEqual(monthsIn("2026-11-28", "2026-11-30"), ["2026-11-01"]);
  assert.deepEqual(monthsIn("2026-12-29", "2027-01-04"), ["2026-12-01", "2027-01-01"]);
});

test("weightedCancelRate weighs by orders", () => {
  // 3 paid at 50% = 6 orders, 3 cancelled; 990 paid at 1% = 1000 orders, 10 cancelled.
  const rate = weightedCancelRate([
    { paid: 3, ratePct: 50 },
    { paid: 990, ratePct: 1 },
  ]);
  assert.ok(Math.abs(rate - (13 / 1006) * 100) < 1e-9);
  assert.equal(weightedCancelRate([]), 0);
});
