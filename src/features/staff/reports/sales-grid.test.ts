import assert from "node:assert/strict";
import { test } from "node:test";

import { busiest, heatLevel, hourSpan } from "./sales-grid.ts";

const grid = [
  { weekday: 5, hour: 20, orders: 2, revenue: "150.00" },
  { weekday: 6, hour: 13, orders: 1, revenue: "30.00" },
];

test("busiest cell, and nothing when nothing sold", () => {
  assert.deepEqual(busiest(grid), grid[0]);
  assert.equal(busiest([]), null);
});

test("hour span covers only hours with sales", () => {
  assert.deepEqual(hourSpan(grid), [13, 20]);
  assert.deepEqual(hourSpan([]), [8, 23]);
});

test("heat level is 0 for nothing and 1-4 by share", () => {
  assert.equal(heatLevel(0, 150), 0);
  assert.equal(heatLevel(30, 150), 1);
  assert.equal(heatLevel(150, 150), 4);
});
