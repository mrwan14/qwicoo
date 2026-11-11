import assert from "node:assert/strict";
import { test } from "node:test";

import { clampGeofence } from "./geofence.ts";

test("geofence stays between 5 and 5000 metres", () => {
  assert.equal(clampGeofence(-50), 5);
  assert.equal(clampGeofence(0), 5);
  assert.equal(clampGeofence(150), 150);
  assert.equal(clampGeofence(99999), 5000);
  assert.equal(clampGeofence(Number.NaN), 5);
});
