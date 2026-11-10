import assert from "node:assert/strict";
import { test } from "node:test";

import { isStale, seatedShort } from "./seated.ts";

test("short seated times", () => {
  assert.equal(seatedShort(0, "en"), "0 min");
  assert.equal(seatedShort(45, "en"), "45 min");
  assert.equal(seatedShort(125, "en"), "2 h 05");
  assert.equal(seatedShort(33370, "en"), "23 days");
  assert.equal(seatedShort(1500, "en"), "1 day");
  assert.equal(seatedShort(45, "ar"), "٤٥ د");
  assert.equal(seatedShort(125, "ar"), "٢ س ٠٥");
  assert.equal(seatedShort(33370, "ar"), "٢٣ يومًا");
  assert.equal(seatedShort(3 * 1440, "ar"), "٣ أيام");
});

test("stale after 12 hours", () => {
  assert.equal(isStale(60), false);
  assert.equal(isStale(12 * 60), true);
});
