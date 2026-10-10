import assert from "node:assert/strict";
import { test } from "node:test";

import {
  decideAfterApiError,
  decideAfterGeolocation,
  decidePinJoin,
  geoOutcomeFromPosition,
  geoOutcomeFromPositionError,
  pinJoinEnabled,
} from "./presence-join.ts";

test("geolocation ok submits coords and accuracy_m", () => {
  const effect = decideAfterGeolocation(
    "verify",
    geoOutcomeFromPosition({ latitude: 30.1, longitude: 31.2, accuracy: 12 }),
    "",
  );
  assert.deepEqual(effect, {
    type: "submit",
    action: "verify",
    coords: { latitude: 30.1, longitude: 31.2, accuracy_m: 12 },
  });
});

test("denied location does not submit without a PIN", () => {
  const effect = decideAfterGeolocation("join", { kind: "denied" }, "");
  assert.deepEqual(effect, { type: "location_blocked", reason: "denied", revealPin: true });
});

test("timeout with a PIN falls back to PIN submit", () => {
  const effect = decideAfterGeolocation("join", { kind: "timeout" }, "123456");
  assert.deepEqual(effect, { type: "submit_pin", action: "join" });
});

test("unsupported geolocation blocks submit", () => {
  const effect = decideAfterGeolocation("verify", { kind: "unsupported" }, "");
  assert.equal(effect.type, "location_blocked");
});

test("OUT_OF_GEOFENCE reveals PIN and never retries without coords", () => {
  const effect = decideAfterApiError("OUT_OF_GEOFENCE", "");
  assert.deepEqual(effect, { type: "show_outside", revealPin: true });
});

test("LOCATION_OR_PIN_REQUIRED, LOCATION_TOO_INACCURATE, PIN_LOCKED map to api_error with PIN", () => {
  for (const code of ["LOCATION_OR_PIN_REQUIRED", "LOCATION_TOO_INACCURATE", "PIN_LOCKED"] as const) {
    const effect = decideAfterApiError(code, "");
    assert.deepEqual(effect, { type: "api_error", code, revealPin: true });
  }
});

test("Join with PIN is disabled until a PIN is typed", () => {
  assert.equal(pinJoinEnabled(""), false);
  assert.equal(pinJoinEnabled("  "), false);
  assert.equal(pinJoinEnabled("1234"), true);
  assert.equal(decidePinJoin("").type, "noop");
  assert.deepEqual(decidePinJoin("999999"), { type: "submit_pin", action: "join" });
});

test("PositionError codes map to denied, unavailable, timeout", () => {
  assert.equal(geoOutcomeFromPositionError(1).kind, "denied");
  assert.equal(geoOutcomeFromPositionError(2).kind, "unavailable");
  assert.equal(geoOutcomeFromPositionError(3).kind, "timeout");
});
