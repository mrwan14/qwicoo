import assert from "node:assert/strict";
import { test } from "node:test";

import { branchNow, clockOf, minutesSince, nextDay, shiftTimes, splitMinutes, zonedIso } from "./time.ts";

test("a Cairo wall-clock time gets the offset for that date", () => {
  // Egypt is on summer time (UTC+3) in September and UTC+2 in January.
  assert.equal(zonedIso("2026-09-20", "11:10", "Africa/Cairo"), "2026-09-20T11:10:00+03:00");
  assert.equal(zonedIso("2026-01-15", "09:00", "Africa/Cairo"), "2026-01-15T09:00:00+02:00");
});

test("leaving before the arrival time means the next morning", () => {
  assert.deepEqual(shiftTimes("2026-09-20", "22:00", "02:00", "Africa/Cairo"), {
    checkIn: "2026-09-20T22:00:00+03:00",
    checkOut: "2026-09-21T02:00:00+03:00",
  });
  assert.equal(shiftTimes("2026-09-20", "10:00", "", "Africa/Cairo").checkOut, null);
  assert.equal(nextDay("2026-12-31"), "2027-01-01");
});

test("clock, durations and the branch's own day", () => {
  assert.equal(clockOf("2026-09-20T11:10:00+03:00"), "11:10");
  assert.equal(clockOf("2026-11-09T05:02:00Z"), "07:02", "a UTC value still shows Cairo time");
  assert.equal(clockOf(null), "");
  assert.deepEqual(splitMinutes(350), { hours: 5, minutes: 50 });
  assert.equal(minutesSince("2026-09-20T10:00:00+03:00", Date.parse("2026-09-20T11:30:00+03:00")), 90);
  // 23:30 UTC on 20 Sep is already 21 Sep in Cairo.
  assert.deepEqual(branchNow("Africa/Cairo", Date.parse("2026-09-20T23:30:00Z")), { day: "2026-09-21", clock: "02:30" });
});
