import assert from "node:assert/strict";
import { test } from "node:test";

import { dateFilter, presetRange, withPreset } from "./date-range.ts";

// Wednesday 15 October 2025, mid-afternoon local time.
const wednesday = new Date(2025, 9, 15, 15, 30);

test("today and yesterday are single local days", () => {
  assert.deepEqual(presetRange("today", wednesday), { from: "2025-10-15", to: "2025-10-15" });
  assert.deepEqual(presetRange("yesterday", wednesday), { from: "2025-10-14", to: "2025-10-14" });
});

test("this week starts on Saturday by default", () => {
  assert.deepEqual(presetRange("thisWeek", wednesday), { from: "2025-10-11", to: "2025-10-15" });
  const saturday = new Date(2025, 9, 11, 9);
  assert.deepEqual(presetRange("thisWeek", saturday), { from: "2025-10-11", to: "2025-10-11" });
  assert.deepEqual(presetRange("thisWeek", wednesday, 0), { from: "2025-10-12", to: "2025-10-15" });
});

test("this month runs from the first to today", () => {
  assert.deepEqual(presetRange("thisMonth", wednesday), { from: "2025-10-01", to: "2025-10-15" });
});

test("yesterday crosses month and year boundaries", () => {
  assert.deepEqual(presetRange("yesterday", new Date(2026, 0, 1, 8)), { from: "2025-12-31", to: "2025-12-31" });
});

test("custom keeps the range that was showing", () => {
  const week = dateFilter("thisWeek", wednesday);
  assert.deepEqual(withPreset(week, "custom", wednesday), { preset: "custom", from: "2025-10-11", to: "2025-10-15" });
  assert.deepEqual(withPreset(week, "today", wednesday), { preset: "today", from: "2025-10-15", to: "2025-10-15" });
});
