"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { fetchPushKey, pushSupport, registerStaffServiceWorker, removePushSubscription, syncPushSubscription, type PushSupport } from "@/lib/push/web-push";
import { useScope } from "@/stores/scope";
import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useWorkspace } from "@/stores/workspace";

import { useAlertPreferences } from "./preferences";

/** Wait before suggesting notifications, so the suggestion doesn't land on top of sign-in. */
const PROMPT_DELAY_MS = 20_000;

function usePushKey(active: boolean) {
  return useQuery({ queryKey: ["staff-push-key"], queryFn: fetchPushKey, enabled: active, staleTime: Infinity, retry: false });
}

function useSupport(): PushSupport | null {
  const [support, setSupport] = useState<PushSupport | null>(null);
  useEffect(() => setSupport(pushSupport()), []);
  return support;
}

export type PushState = {
  /** `hidden`: the server has no push, the browser can't, or this role gets no alerts. */
  mode: "hidden" | "ios-install" | "ready";
  on: boolean;
  denied: boolean;
  busy: boolean;
  toggle: () => Promise<void>;
};

/** Web push on this device: whether it can be offered, whether it's on, and the switch. Permission is only asked from `toggle`. */
export function usePushNotifications(): PushState {
  const t = useStaffSection(commonCopy);
  const { active } = useAlertPreferences();
  const support = useSupport();
  const key = usePushKey(active);
  const branchId = useScope((state) => state.branchId);
  const pushEnabled = useWorkspace((state) => state.pushEnabled);
  const setPushEnabled = useWorkspace((state) => state.setPushEnabled);
  const adminOptIn = useWorkspace((state) => state.adminOrderAlerts);
  const [busy, setBusy] = useState(false);

  const mode: PushState["mode"] = !active || !key.data || !support || support === "unsupported" ? "hidden" : support === "ios-install" ? "ios-install" : "ready";
  const denied = typeof Notification !== "undefined" && Notification.permission === "denied";
  const on = mode === "ready" && pushEnabled && !denied;

  async function toggle() {
    if (busy) return;
    if (mode === "ios-install") {
      toast(t.addHome, { description: t.addHomeBody });
      return;
    }
    if (mode !== "ready") return;
    setBusy(true);
    try {
      if (on) {
        await removePushSubscription();
        setPushEnabled(false);
        toast(t.notificationsOff);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast(t.notificationsBlocked, { description: t.notificationsBlockedBody });
        return;
      }
      if (!branchId) {
        toast(t.chooseBranchFirst);
        return;
      }
      const ok = await syncPushSubscription({ branchId, orderAlertsOptIn: adminOptIn });
      if (!ok) {
        toast.error(t.notificationsFailed);
        return;
      }
      setPushEnabled(true);
      toast.success(t.notificationsOn, { description: t.notificationsOnBody });
    } finally {
      setBusy(false);
    }
  }

  return { mode, on, denied, busy, toggle };
}

/** Mounted once from StaffRuntime: registers the worker, keeps the subscription on the current branch, and suggests push once. */
export function StaffPushRuntime() {
  const t = useStaffSection(commonCopy);
  const { active, isAdmin } = useAlertPreferences();
  const branchId = useScope((state) => state.branchId);
  const pushEnabled = useWorkspace((state) => state.pushEnabled);
  const pushPrompted = useWorkspace((state) => state.pushPrompted);
  const setPushPrompted = useWorkspace((state) => state.setPushPrompted);
  const adminOptIn = useWorkspace((state) => state.adminOrderAlerts);
  const key = usePushKey(active);
  const push = usePushNotifications();
  const toggleRef = useRef(push.toggle);
  toggleRef.current = push.toggle;

  useEffect(() => {
    void registerStaffServiceWorker();
  }, []);

  useEffect(() => {
    if (!key.data || !pushEnabled) return;
    if (!active) {
      void removePushSubscription();
      return;
    }
    if (!branchId || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    void syncPushSubscription({ branchId, orderAlertsOptIn: adminOptIn });
  }, [key.data, pushEnabled, active, branchId, adminOptIn]);

  // Frontline staff: suggest notifications once per device, so alerts still arrive when the tab is hidden.
  const canSuggest =
    !isAdmin &&
    push.mode === "ready" &&
    !push.on &&
    !pushPrompted &&
    Boolean(branchId) &&
    typeof Notification !== "undefined" &&
    Notification.permission === "default";
  useEffect(() => {
    if (!canSuggest) return;
    const timer = window.setTimeout(() => {
      setPushPrompted();
      toast(t.pushPrompt, {
        description: t.pushPromptBody,
        duration: 30_000,
        action: { label: t.turnOn, onClick: () => void toggleRef.current() },
        cancel: { label: t.notNow, onClick: () => undefined },
      });
    }, PROMPT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [canSuggest, setPushPrompted, t.pushPrompt, t.pushPromptBody, t.turnOn, t.notNow]);

  return null;
}
