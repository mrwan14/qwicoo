import assert from "node:assert/strict";
import { test } from "node:test";

import { daysIn, percentChange, pointChange, previousPeriod, spanDays } from "./compare";
import { readFilter, filterQuery } from "./filter-query";

test("a day or a week compares with the same days last week", () => {
  assert.deepEqual(previousPeriod({ preset: "today", from: "2026-11-09", to: "2026-11-09" }), { from: "2026-11-02", to: "2026-11-02", kind: "week", days: 1 });
  assert.deepEqual(previousPeriod({ preset: "thisWeek", from: "2026-11-07", to: "2026-11-09" }), { from: "2026-10-31", to: "2026-11-02", kind: "week", days: 3 });
});

test("this month compares with the same days last month, clamped to its length", () => {
  assert.deepEqual(previousPeriod({ preset: "thisMonth", from: "2026-11-01", to: "2026-11-09" }), { from: "2026-10-01", to: "2026-10-09", kind: "month", days: 9 });
  assert.deepEqual(previousPeriod({ preset: "thisMonth", from: "2027-03-01", to: "2027-03-31" }), { from: "2027-02-01", to: "2027-02-28", kind: "month", days: 31 });
  assert.deepEqual(previousPeriod({ preset: "thisMonth", from: "2027-01-01", to: "2027-01-05" }), { from: "2026-12-01", to: "2026-12-05", kind: "month", days: 5 });
});

test("a longer custom range compares with the days just before", () => {
  assert.deepEqual(previousPeriod({ preset: "custom", from: "2026-10-01", to: "2026-10-14" }), { from: "2026-09-17", to: "2026-09-30", kind: "days", days: 14 });
  assert.equal(spanDays("2026-10-01", "2026-10-14"), 14);
});

test("daysIn lists every day, across a month end", () => {
  assert.deepEqual(daysIn("2026-10-30", "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  assert.deepEqual(daysIn("2026-11-09", "2026-11-09"), ["2026-11-09"]);
});

test("changes", () => {
  assert.equal(percentChange(112, 100), 12);
  assert.equal(percentChange("50", "0"), null);
  assert.equal(pointChange(3.26, 2), 1.3);
  assert.equal(pointChange(null, 2), null);
});

function params(query: string) {
  return new URLSearchParams(query);
}

test("filters read from the URL; presets stay current, custom keeps its days", () => {
  const now = new Date(2026, 10, 9);
  assert.deepEqual(readFilter(params("range=yesterday"), "today", now), { preset: "yesterday", from: "2026-11-08", to: "2026-11-08" });
  assert.deepEqual(readFilter(params("range=custom&from=2026-10-01&to=2026-10-14"), "today", now), { preset: "custom", from: "2026-10-01", to: "2026-10-14" });
  assert.deepEqual(readFilter(params("range=custom&from=2026-10-14&to=2026-10-01"), "today", now), { preset: "today", from: "2026-11-09", to: "2026-11-09" });
  assert.deepEqual(readFilter(params("range=nonsense"), "yesterday", now), { preset: "yesterday", from: "2026-11-08", to: "2026-11-08" });
});

test("filters write back to the URL", () => {
  assert.equal(filterQuery(params("x=1"), { range: { preset: "thisWeek", from: "2026-11-07", to: "2026-11-09" } }), "x=1&range=thisWeek");
  assert.equal(filterQuery(params("range=today"), { range: { preset: "custom", from: "2026-10-01", to: "2026-10-14" }, branch: "all" }), "range=custom&from=2026-10-01&to=2026-10-14");
  assert.equal(filterQuery(params(""), { branch: "b1" }), "branch=b1");
});
