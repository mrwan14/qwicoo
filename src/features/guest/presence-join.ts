/**
 * Pure join decisions for the guest presence form.
 * No React, no fetch — unit-tested so geofence / PIN / location failures stay consistent.
 */

export type GeoOutcome =
  | { kind: "ok"; latitude: number; longitude: number; accuracy: number | null }
  | { kind: "denied" }
  | { kind: "timeout" }
  | { kind: "unavailable" }
  | { kind: "unsupported" };

export type JoinAction = "verify" | "join";

export type JoinUiEffect =
  | { type: "submit"; action: JoinAction; coords: { latitude: number; longitude: number; accuracy_m: number | null } }
  | { type: "submit_pin"; action: JoinAction }
  | { type: "show_outside"; revealPin: true }
  | { type: "location_blocked"; reason: "denied" | "timeout" | "unavailable" | "unsupported"; revealPin: boolean }
  | { type: "api_error"; code: string; revealPin: boolean };

/** Geolocation PositionError codes (1 denied, 2 unavailable, 3 timeout). */
export function geoOutcomeFromPositionError(code: number | undefined): Exclude<GeoOutcome, { kind: "ok" | "unsupported" }> {
  if (code === 1) return { kind: "denied" };
  if (code === 3) return { kind: "timeout" };
  return { kind: "unavailable" };
}

export function geoOutcomeFromPosition(coords: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}): GeoOutcome {
  const accuracy = typeof coords.accuracy === "number" && Number.isFinite(coords.accuracy) ? coords.accuracy : null;
  return { kind: "ok", latitude: coords.latitude, longitude: coords.longitude, accuracy };
}

/**
 * After a geolocation attempt for verify/join with location.
 * Never submits without coordinates.
 */
export function decideAfterGeolocation(action: JoinAction, outcome: GeoOutcome, pinTrimmed: string): JoinUiEffect {
  if (outcome.kind === "ok") {
    return {
      type: "submit",
      action,
      coords: {
        latitude: outcome.latitude,
        longitude: outcome.longitude,
        accuracy_m: outcome.accuracy,
      },
    };
  }
  if (pinTrimmed) {
    return { type: "submit_pin", action };
  }
  return { type: "location_blocked", reason: outcome.kind, revealPin: true };
}

/**
 * User tapped "Join with PIN" — only allowed when a PIN is typed.
 */
export function decidePinJoin(pinTrimmed: string): JoinUiEffect | { type: "noop" } {
  if (!pinTrimmed) return { type: "noop" };
  return { type: "submit_pin", action: "join" };
}

/** API error handling for presence verify/join. Never retries without coords. */
export function decideAfterApiError(code: string | null | undefined, pinTrimmed: string): JoinUiEffect {
  const normalized = (code ?? "").trim() || "UNKNOWN";
  if (normalized === "OUT_OF_GEOFENCE" || normalized === "GEOLOCATION_REQUIRED") {
    return { type: "show_outside", revealPin: true };
  }
  if (
    normalized === "LOCATION_OR_PIN_REQUIRED" ||
    normalized === "LOCATION_TOO_INACCURATE" ||
    normalized === "PIN_LOCKED"
  ) {
    return { type: "api_error", code: normalized, revealPin: true };
  }
  if (normalized === "INVALID_OR_EXPIRED_PIN") {
    return { type: "api_error", code: normalized, revealPin: Boolean(pinTrimmed) || true };
  }
  return { type: "api_error", code: normalized, revealPin: false };
}

export function pinJoinEnabled(pin: string): boolean {
  return pin.trim().length > 0;
}
