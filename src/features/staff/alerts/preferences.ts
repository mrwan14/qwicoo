"use client";

import { useStaffSession } from "@/components/ops/staff-session";
import { useWorkspace } from "@/stores/workspace";

import { ADMIN_ROLES, OPS_ALERT_ROLES, alertsActive, type AlertRole } from "./diff";

/** Sound for this person: their own choice, else on for ops roles and off for everyone else. */
export function useSoundSetting(): [boolean, (on: boolean) => void] {
  const me = useStaffSession();
  const chosen = useWorkspace((state) => state.soundChosen);
  const enabled = useWorkspace((state) => state.soundEnabled);
  const set = useWorkspace((state) => state.setSoundEnabled);
  const fallback = me ? OPS_ALERT_ROLES.has(me.role as AlertRole) : false;
  return [chosen ? enabled : fallback, set];
}

/** Whether this person gets alerts at all, whether they make a sound, and which controls to show. */
export function useAlertPreferences(): { active: boolean; soundOn: boolean; isAdmin: boolean } {
  const me = useStaffSession();
  const adminOptIn = useWorkspace((state) => state.adminOrderAlerts);
  const [sound] = useSoundSetting();
  if (!me) return { active: false, soundOn: false, isAdmin: false };
  const role = me.role as AlertRole;
  const active = alertsActive({ role, branchId: null, adminOptIn });
  return { active, soundOn: active && sound, isAdmin: ADMIN_ROLES.has(role) };
}
