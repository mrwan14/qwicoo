import assert from "node:assert/strict";
import { test } from "node:test";

import { distanceText, problemFromApi, problemFromGeo } from "./punch-problem.ts";

test("browser location errors", () => {
  assert.deepEqual(problemFromGeo({ code: 1 }), { kind: "denied" });
  assert.deepEqual(problemFromGeo({ code: 2 }), { kind: "noFix" });
  assert.deepEqual(problemFromGeo({ code: 3 }), { kind: "noFix" });
  assert.deepEqual(problemFromGeo(null), { kind: "noFix" });
});

test("API refusals keep their numbers, wherever the body puts them", () => {
  const far = { detail: { code: "OUT_OF_GEOFENCE", distance_meters: 412.5, allowed_radius_meters: 100 } };
  assert.deepEqual(problemFromApi("OUT_OF_GEOFENCE", far, "x"), { kind: "far", distance: 412.5, allowed: 100 });
  const weak = { code: "LOCATION_TOO_WEAK", accuracy_meters: 900, allowed_accuracy_meters: 150 };
  assert.deepEqual(problemFromApi("LOCATION_TOO_WEAK", weak, "x"), { kind: "weak", accuracy: 900, allowed: 150 });
  assert.deepEqual(problemFromApi("OUT_OF_GEOFENCE", "OUT_OF_GEOFENCE", "x"), { kind: "far", distance: null, allowed: null });
  assert.deepEqual(problemFromApi("CLOCK_IN_AT_TILL", {}, "x"), { kind: "tillOnly" });
  assert.deepEqual(problemFromApi(null, {}, "Server said no"), { kind: "other", message: "Server said no" });
});

test("distances", () => {
  assert.equal(distanceText(80.4, "en"), "80 m");
  assert.equal(distanceText(1430, "en"), "1.4 km");
  assert.equal(distanceText(80, "ar"), "٨٠ م");
});
