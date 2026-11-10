/**
 * Why a clock-in or clock-out didn't go through, in a shape the panel can explain and offer a fix for.
 * Pure, so the mapping from browser and API errors is tested on its own.
 */
export type PunchProblem =
  | { kind: "offline" }
  | { kind: "denied" }
  | { kind: "noFix" }
  | { kind: "weak"; accuracy: number | null; allowed: number | null }
  | { kind: "far"; distance: number | null; allowed: number | null }
  | { kind: "tillOnly" }
  | { kind: "other"; message: string };

/** GeolocationPositionError codes: 1 permission denied, 2 unavailable, 3 timeout. */
export function problemFromGeo(error: { code?: number } | null | undefined): PunchProblem {
  return error?.code === 1 ? { kind: "denied" } : { kind: "noFix" };
}

/** A number the API put somewhere in its error body (top level, `detail` or `errors`). */
function numberIn(body: unknown, key: string): number | null {
  const seen: unknown[] = [body];
  for (let depth = 0; depth < 3; depth++) {
    const next: unknown[] = [];
    for (const node of seen) {
      if (!node || typeof node !== "object") continue;
      const value = (node as Record<string, unknown>)[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      next.push(...Object.values(node as Record<string, unknown>));
    }
    seen.splice(0, seen.length, ...next);
  }
  return null;
}

/** The API refused the punch: known codes become a problem the panel can explain. */
export function problemFromApi(code: string | null, body: unknown, message: string): PunchProblem {
  if (code === "OUT_OF_GEOFENCE") return { kind: "far", distance: numberIn(body, "distance_meters"), allowed: numberIn(body, "allowed_radius_meters") };
  if (code === "LOCATION_TOO_WEAK") return { kind: "weak", accuracy: numberIn(body, "accuracy_meters"), allowed: numberIn(body, "allowed_accuracy_meters") };
  if (code === "CLOCK_IN_AT_TILL") return { kind: "tillOnly" };
  return { kind: "other", message };
}

/** "80 m" or "1.4 km", in the locale's digits. */
export function distanceText(meters: number, locale: string): string {
  const format = (value: number, digits: number) => value.toLocaleString(locale === "ar" ? "ar-EG" : "en-GB", { maximumFractionDigits: digits });
  return meters < 1000 ? `${format(Math.round(meters), 0)} ${locale === "ar" ? "م" : "m"}` : `${format(meters / 1000, 1)} ${locale === "ar" ? "كم" : "km"}`;
}
