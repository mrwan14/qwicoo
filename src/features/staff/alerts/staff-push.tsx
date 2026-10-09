"use client";

import { useQuery } from "@tanstack/react-query";
import { BellRing, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { fetchPushKey, pushSupport, registerStaffServiceWorker, removePushSubscription, syncPushSubscription, type PushSupport } from "@/lib/push/web-push";
import { useScope } from "@/stores/scope";
import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useWorkspace } from "@/stores/workspace";

import { useAlertPreferences } from "./preferences";

const chip =
  "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function usePushKey(active: boolean) {
  return useQuery({ queryKey: ["staff-push-key"], queryFn: fetchPushKey, enabled: active, staleTime: Infinity, retry: false });
}

function useSupport(): PushSupport | null {
  const [support, setSupport] = useState<PushSupport | null>(null);
  useEffect(() => setSupport(pushSupport()), []);
  return support;
}

/** Mounted once from StaffRuntime: registers the worker and keeps the subscription on the current branch. */
export function StaffPushRuntime() {
  const { active } = useAlertPreferences();
  const branchId = useScope((state) => state.branchId);
  const pushEnabled = useWorkspace((state) => state.pushEnabled);
  const adminOptIn = useWorkspace((state) => state.adminOrderAlerts);
  const key = usePushKey(active);

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

  return null;
}

/** Header control. Permission is only requested from this tap. Hidden when the server has no push or the role gets no alerts. */
export function NotificationsControl() {
  const t = useStaffSection(commonCopy);
  const { active } = useAlertPreferences();
  const support = useSupport();
  const key = usePushKey(active);
  const branchId = useScope((state) => state.branchId);
  const pushEnabled = useWorkspace((state) => state.pushEnabled);
  const setPushEnabled = useWorkspace((state) => state.setPushEnabled);
  const adminOptIn = useWorkspace((state) => state.adminOrderAlerts);
  const [busy, setBusy] = useState(false);

  if (!active || !key.data || !support || support === "unsupported") return null;

  if (support === "ios-install") {
    return (
      <button
        type="button"
        className={`${chip} text-muted-foreground`}
        onClick={() => toast(t.addHome, { description: t.addHomeBody })}
      >
        <Smartphone className="size-4" aria-hidden />
        <span className="hidden md:inline">{t.notifications}</span>
      </button>
    );
  }

  const denied = typeof Notification !== "undefined" && Notification.permission === "denied";
  const on = pushEnabled && !denied;

  async function toggle() {
    if (busy) return;
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

  return (
    <button
      type="button"
      className={`${chip} ${on ? "text-primary" : ""}`}
      aria-pressed={on}
      disabled={busy}
      title={denied ? t.notificationsBlockedTitle : undefined}
      onClick={() => void toggle()}
    >
      <BellRing className="size-4" aria-hidden />
      <span className="hidden md:inline">{on ? t.notificationsOn : t.enableNotifications}</span>
      <span className="sr-only md:hidden">{on ? t.notificationsOn : t.enableNotifications}</span>
    </button>
  );
}
