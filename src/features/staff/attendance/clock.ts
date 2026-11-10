"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { cairoTime } from "@/features/staff/home/numbers";

import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { attendanceCopy } from "@/lib/i18n/staff/attendance";
import { clockCopy } from "@/lib/i18n/staff/clock";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import { problemFromApi, problemFromGeo, type PunchProblem } from "./punch-problem";

export const MY_ATTENDANCE_KEY = ["attendance-me"] as const;

/** Where a punch is: finding the location, then waiting for the API. */
export type PunchPhase = "idle" | "locating" | "sending";

/**
 * The signed-in person's own attendance and the check-in / check-out calls.
 * Shared by the Attendance screen and the front-line top bar.
 */
export function useMyAttendance({ enabled = true }: { enabled?: boolean } = {}) {
  const t = useStaffSection(attendanceCopy);
  const client = useQueryClient();
  const clock = useStaffSection(clockCopy);
  const { locale } = useLocale();
  const [phase, setPhase] = useState<PunchPhase>("idle");
  const [problem, setProblem] = useState<PunchProblem | null>(null);
  const status = useQuery({
    queryKey: MY_ATTENDANCE_KEY,
    enabled,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/attendance/my-status");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.statusFailed);
      return result.data;
    },
  });

  /**
   * Asks for the device location (the API checks the person is at the branch), then punches.
   * Failures are kept in `problem` for the panel to explain, with a way to fix them.
   */
  async function punch(kind: "in" | "out"): Promise<boolean> {
    if (phase !== "idle") return false;
    setProblem(null);
    if (status.data?.clock_mode === "TILL_ONLY") {
      setProblem({ kind: "tillOnly" });
      return false;
    }
    // No offline punches: a delayed punch with a device time is easy to fake.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setProblem({ kind: "offline" });
      return false;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setProblem({ kind: "noFix" });
      return false;
    }
    setPhase("locating");
    try {
      const located = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 });
      }).then(
        (position) => ({ position, error: null }),
        (error: GeolocationPositionError) => ({ position: null, error }),
      );
      if (!located.position) {
        setProblem(problemFromGeo(located.error));
        return false;
      }
      const { coords } = located.position;
      const body: components["schemas"]["CheckInRequest"] = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        // The API refuses a vague fix (LOCATION_TOO_WEAK) instead of guessing.
        accuracy_meters: Number.isFinite(coords.accuracy) ? Math.round(coords.accuracy) : null,
      };
      setPhase("sending");
      const result =
        kind === "in"
          ? await browserApi.POST("/api/v1/attendance/check-in", { body })
          : await browserApi.POST("/api/v1/attendance/check-out", { body });
      if (!result.response.ok) {
        const error = asApiError(result.error, result.response, t.attendanceFailed);
        setProblem(problemFromApi(error.code, result.error, error.message));
        return false;
      }
      const at = kind === "in" ? result.data?.attendance?.check_in : result.data?.attendance?.check_out;
      toast.success(fill(kind === "in" ? clock.clockedIn : clock.clockedOut, { time: cairoTime(at ?? new Date().toISOString(), locale) }));
      client.setQueryData(MY_ATTENDANCE_KEY, result.data);
      void client.invalidateQueries({ queryKey: MY_ATTENDANCE_KEY });
      return true;
    } catch {
      setProblem({ kind: "offline" });
      return false;
    } finally {
      setPhase("idle");
    }
  }

  const record = status.data?.attendance;
  const clockedIn = Boolean(record?.check_in && !record.check_out);
  return {
    status,
    punch,
    phase,
    punching: phase !== "idle",
    problem,
    clearProblem: () => setProblem(null),
    clockedIn,
    checkInAt: clockedIn ? (record?.check_in ?? null) : null,
  };
}
