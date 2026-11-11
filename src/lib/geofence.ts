export const GEOFENCE_MIN = 5;
export const GEOFENCE_MAX = 5000;

/** Geofence radius in metres, kept inside what the server accepts (never negative). */
export function clampGeofence(value: number): number {
  if (!Number.isFinite(value)) return GEOFENCE_MIN;
  return Math.min(GEOFENCE_MAX, Math.max(GEOFENCE_MIN, Math.round(value)));
}
