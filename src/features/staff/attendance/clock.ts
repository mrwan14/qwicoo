"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { attendanceCopy } from "@/lib/i18n/staff/attendance";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export const MY_ATTENDANCE_KEY = ["attendance-me"] as const;

/**
 * The signed-in person's own attendance and the check-in / check-out calls.
 * Shared by the Attendance screen and the front-line top bar.
 */
export function useMyAttendance({ enabled = true }: { enabled?: boolean } = {}) {
  const t = useStaffSection(attendanceCopy);
  const client = useQueryClient();
  const [punching, setPunching] = useState(false);
  const status = useQuery({
    queryKey: MY_ATTENDANCE_KEY,
    enabled,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/attendance/my-status");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.statusFailed);
      return result.data;
    },
  });

  /** Asks for the device location: the API checks the person is at the branch. */
  async function punch(kind: "in" | "out"): Promise<boolean> {
    if (punching) return false;
    // A till-only branch refuses phone punches: say so instead of asking for the location.
    if (status.data?.clock_mode === "TILL_ONLY") {
      toast.error(t.my.tillOnly);
      return false;
    }
    setPunching(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 });
      }).catch(() => null);
      if (!position) {
        toast.error(t.locationNeeded);
        return false;
      }
      const body: components["schemas"]["CheckInRequest"] = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        // The API refuses a vague fix (LOCATION_TOO_WEAK) instead of guessing.
        accuracy_meters: Number.isFinite(position.coords.accuracy) ? Math.round(position.coords.accuracy) : null,
      };
      const result =
        kind === "in"
          ? await browserApi.POST("/api/v1/attendance/check-in", { body })
          : await browserApi.POST("/api/v1/attendance/check-out", { body });
      if (!result.response.ok) {
        const error = asApiError(result.error, result.response, t.attendanceFailed);
        toast.error(error.code === "OUT_OF_GEOFENCE" ? t.outsideBranch : error.message);
        return false;
      }
      toast.success(kind === "in" ? t.checkedIn : t.checkedOut);
      void client.invalidateQueries({ queryKey: MY_ATTENDANCE_KEY });
      return true;
    } finally {
      setPunching(false);
    }
  }

  const record = status.data?.attendance;
  const clockedIn = Boolean(record?.check_in && !record.check_out);
  return { status, punch, punching, clockedIn, checkInAt: clockedIn ? (record?.check_in ?? null) : null };
}
