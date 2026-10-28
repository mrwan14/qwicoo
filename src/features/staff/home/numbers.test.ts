import assert from "node:assert/strict";
import { test } from "node:test";

import { analyticsPeriod } from "../reports/period.ts";

import { cairoDate, cairoHour, greetingKey, isOpenOrder, percentChange, salesByHour, signedPercent } from "./numbers.ts";

test("hours are read in Cairo time", () => {
  assert.equal(cairoHour("2026-10-27T05:30:00Z"), 8);
  assert.equal(cairoHour("2026-10-27T21:10:00Z"), 0);
  assert.equal(cairoHour("not a date"), null);
});

test("sales by hour counts paid orders only and fills the gaps", () => {
  const orders = [
    { created_at: "2026-10-27T06:05:00Z", total_amount: "100.00", is_paid: true, status: "CLOSED" },
    { created_at: "2026-10-27T06:40:00Z", total_amount: "50.50", is_paid: true, status: "PAID" },
    { created_at: "2026-10-27T08:15:00Z", total_amount: "80.00", is_paid: false, status: "PREPARING" },
    { created_at: "2026-10-27T08:20:00Z", total_amount: "70.00", is_paid: true, status: "CANCELLED" },
  ];
  const hours = salesByHour(orders, 12);
  assert.equal(hours[0]?.hour, 8);
  assert.equal(hours.at(-1)?.hour, 12);
  assert.equal(hours.find((bucket) => bucket.hour === 9)?.total, 150.5);
  assert.equal(hours.find((bucket) => bucket.hour === 9)?.orders, 2);
  assert.equal(hours.find((bucket) => bucket.hour === 11)?.total, 0);
});

test("an early sale moves the start of the chart", () => {
  const hours = salesByHour([{ created_at: "2026-10-27T03:00:00Z", total_amount: "10", is_paid: true, status: "PAID" }], 7);
  assert.equal(hours[0]?.hour, 6);
  assert.equal(hours.at(-1)?.hour, 7);
});

test("percent change needs something to compare with", () => {
  assert.equal(percentChange("112", "100"), 12);
  assert.equal(percentChange("90", "100"), -10);
  assert.equal(percentChange("50", "0"), null);
  assert.equal(percentChange(undefined, "10"), null);
  assert.equal(signedPercent(12), "+12%");
  assert.equal(signedPercent(-4), "−4%");
});

test("open orders leave once they are paid off or closed", () => {
  assert.equal(isOpenOrder({ status: "PREPARING", is_paid: true }), true);
  assert.equal(isOpenOrder({ status: "SERVED", is_paid: false }), true);
  assert.equal(isOpenOrder({ status: "SERVED", is_paid: true }), false);
  assert.equal(isOpenOrder({ status: "CLOSED", is_paid: true }), false);
  assert.equal(isOpenOrder({ status: "CANCELLED", is_paid: false }), false);
});

test("greeting follows the hour and dates are Cairo days", () => {
  assert.equal(greetingKey(9), "morning");
  assert.equal(greetingKey(14), "afternoon");
  assert.equal(greetingKey(20), "evening");
  assert.equal(cairoDate(new Date("2026-10-27T22:30:00Z")), "2026-10-28");
  assert.equal(cairoDate(new Date("2026-10-27T10:00:00Z"), 7), "2026-10-20");
});

test("analytics periods map presets to the API", () => {
  assert.deepEqual(analyticsPeriod({ preset: "today", from: "2026-10-27", to: "2026-10-27" }), { period: "today" });
  assert.deepEqual(analyticsPeriod({ preset: "thisWeek", from: "2026-10-25", to: "2026-10-27" }), {
    period: "custom",
    start_date: "2026-10-25",
    end_date: "2026-10-27",
  });
});
