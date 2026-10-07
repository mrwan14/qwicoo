"use client";

import { useStaffSession } from "@/components/ops/staff-session";
import { useWorkspace } from "@/stores/workspace";

import { alertsActive, type AlertRole } from "./diff";

/** Whether this person gets alerts at all, and whether they make a sound. */
export function useAlertPreferences(): { active: boolean; soundOn: boolean } {
  const me = useStaffSession();
  const soundEnabled = useWorkspace((state) => state.soundEnabled);
  if (!me) return { active: false, soundOn: false };
  const active = alertsActive({ role: me.role as AlertRole, branchId: null, adminOptIn: false });
  return { active, soundOn: active && soundEnabled };
}
