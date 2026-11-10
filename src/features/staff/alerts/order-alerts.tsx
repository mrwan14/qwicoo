"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useStaffSession } from "@/components/ops/staff-session";
import { useWorkspace } from "@/stores/workspace";
import { fetchFloorLive, floorLiveQueryKey } from "@/hooks/use-floor-live";
import { pollUnlessRoleDenied, usePageVisible } from "@/hooks/use-page-visible";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { isAudioUnlocked, playTone, unlockAudio } from "@/lib/sound/tones";
import { orderStatusLabel, paymentMethodLabel } from "@/lib/status-labels";
import { useScope } from "@/stores/scope";

import {
  OPS_ALERT_ROLES,
  diffSnapshots,
  groupForToasts,
  mergeSnapshot,
  pruneIgnore,
  sourcesFor,
  toneFor,
  type AlertAudience,
  type AlertEvent,
  type AlertRole,
  type Snapshot,
} from "./diff";
import { useAlertHistory } from "./history";
import { acknowledgedOrders, alertIgnoreList } from "./ignore";
import { useAlertPreferences } from "./preferences";
import {
  expoKey,
  fetchExpoOrders,
  fetchKdsTickets,
  fetchPendingPayments,
  fetchServiceQueue,
  fetchStoreOnlineNew,
  kdsTicketsKey,
  paymentsPendingKey,
  serviceQueueKey,
  storeOnlineKey,
} from "./queries";
import { dueRechimes, rechimeKey, type ChimeEntry } from "./rechime";

const POLL_MS = 7000;
/** Frontline roles keep listening while the tab is hidden, a little slower. Browsers may slow it further. */
const BACKGROUND_POLL_MS = 15_000;
const NO_TABLES: string[] = [];

const PAGE: Record<AlertEvent["kind"], string> = {
  confirmation: "/app/floor",
  "floor-status": "/app/floor",
  payment: "/app/orders/payments",
  "service-request": "/app/floor/requests",
  "kitchen-ticket": "/app/kds",
  "handover-ready": "/app/kds/expo",
  "store-online": "/app/pos?tab=store-online",
};

function localizePlace(place: string, labels: { pickup: string; table: string; order: string }): string {
  if (place.startsWith("Pickup ")) return `${labels.pickup} ${place.slice("Pickup ".length)}`;
  if (place.startsWith("Table ")) return `${labels.table} ${place.slice("Table ".length)}`;
  if (place === "Order") return labels.order;
  return place;
}

function requestLabel(type: string | null | undefined, fallback: string): string {
  if (!type) return fallback;
  const text = type.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function alertTitle(event: AlertEvent, copy: (typeof commonCopy)["en"]): string {
  const place = localizePlace(event.place, copy);
  switch (event.kind) {
    case "confirmation":
      return `${place} · ${orderStatusLabel(event.status)}`;
    case "floor-status":
      return `${place} · ${orderStatusLabel(event.status)}`;
    case "payment":
      return fill(copy.paymentWaiting, { place, method: paymentMethodLabel(event.detail) });
    case "service-request":
      return `${place} · ${requestLabel(event.detail, copy.serviceRequest)}`;
    case "kitchen-ticket":
      return fill(copy.newTicket, { place });
    case "handover-ready":
      return fill(copy.handoverReady, { place });
    case "store-online":
      return fill(copy.newStoreOrder, { place });
  }
}

/** One watcher for the whole staff app. Mounted once from StaffRuntime. */
export function OrderAlerts() {
  const copy = useStaffSection(commonCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const router = useRouter();
  const branchId = useScope((state) => state.branchId);
  const visible = usePageVisible();
  const { active, soundOn } = useAlertPreferences();
  const myTables = useWorkspace((state) => (branchId ? state.myTables[branchId] : undefined)) ?? NO_TABLES;
  const pushEnabled = useWorkspace((state) => state.pushEnabled);
  const addHistory = useAlertHistory((state) => state.add);
  const requestOpen = useAlertHistory((state) => state.requestOpen);

  const frontline = me ? OPS_ALERT_ROLES.has(me.role as AlertRole) : false;
  const audience: AlertAudience | null = me
    ? { role: me.role as AlertRole, branchId, adminOptIn: active, tables: myTables }
    : null;
  const sources = audience && active ? sourcesFor(audience) : [];
  const on = (source: string) => Boolean(branchId) && sources.includes(source as never);
  // Hidden tab: frontline roles keep listening (a cashier on another tab still hears orders); managers stop.
  const interval = visible ? POLL_MS : frontline ? BACKGROUND_POLL_MS : false;
  const refetchInterval = pollUnlessRoleDenied(interval);
  const poll = { refetchInterval, refetchIntervalInBackground: true, retry: false } as const;

  const floor = useQuery({ queryKey: floorLiveQueryKey(branchId), queryFn: () => fetchFloorLive(branchId), enabled: on("floor"), ...poll });
  const kitchen = useQuery({ queryKey: kdsTicketsKey(branchId), queryFn: fetchKdsTickets, enabled: on("kitchen"), ...poll });
  const expo = useQuery({ queryKey: expoKey(branchId), queryFn: fetchExpoOrders, enabled: on("expo"), ...poll });
  const service = useQuery({ queryKey: serviceQueueKey(branchId), queryFn: fetchServiceQueue, enabled: on("service"), ...poll });
  const payments = useQuery({ queryKey: paymentsPendingKey(branchId), queryFn: fetchPendingPayments, enabled: on("payments"), ...poll });
  const storeOnline = useQuery({ queryKey: storeOnlineKey(branchId, "new"), queryFn: () => fetchStoreOnlineNew(locale), enabled: on("storeOnline"), ...poll });

  const previous = useRef<Snapshot | null>(null);
  /** Alerts that arrived while the tab was hidden, summed into one toast on return. */
  const awayCount = useRef(0);
  const pending = useRef(new Map<string, ChimeEntry>());
  /** Re-chime keys still waiting in their queue (kitchen, store, service, payment). */
  const liveKeys = useRef(new Set<string>());
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  // With push on, a hidden tab leaves the sound to the system notification, so it doesn't ring twice.
  const pushCovers = () => pushEnabled && typeof Notification !== "undefined" && Notification.permission === "granted";
  const pushCoversRef = useRef(pushCovers);
  pushCoversRef.current = pushCovers;

  // First tap or keypress anywhere unlocks audio.
  useEffect(() => {
    const unlock = () => void unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // New branch, role, opt-in or tables: start again from a baseline.
  useEffect(() => {
    previous.current = null;
    pending.current.clear();
    awayCount.current = 0;
  }, [branchId, me?.role, active, myTables]);

  // Back on the tab: one summary for everything that came in while away.
  useEffect(() => {
    if (!visible || awayCount.current === 0) return;
    const count = awayCount.current;
    awayCount.current = 0;
    toast(fill(copy.newWhileAway, { count }), { action: { label: copy.view, onClick: requestOpen } });
  }, [visible, copy.newWhileAway, copy.view, requestOpen]);

  useEffect(() => {
    if (!audience || !active) return;
    const next: Snapshot = {
      floor: on("floor") ? floor.data?.tables : undefined,
      kitchen: on("kitchen") ? kitchen.data : undefined,
      expo: on("expo") ? expo.data : undefined,
      service: on("service") ? service.data : undefined,
      payments: on("payments") ? payments.data?.map((row) => ({ ...row, branch_id: null })) : undefined,
      storeOnline: on("storeOnline") ? storeOnline.data : undefined,
    };
    if (Object.values(next).every((value) => value === undefined)) return;
    const now = Date.now();
    pruneIgnore(alertIgnoreList, now);
    const events = diffSnapshots(previous.current, next, audience, alertIgnoreList, now);
    previous.current = mergeSnapshot(previous.current, next);

    // What is still waiting, so repeats stop once it is handled.
    const live = new Set<string>();
    for (const row of previous.current.kitchen ?? []) live.add(rechimeKey("kitchen", row.sub_ticket_id));
    for (const row of previous.current.storeOnline ?? []) live.add(rechimeKey("store", row.order_id));
    for (const row of previous.current.service ?? []) live.add(rechimeKey("service", row.id));
    for (const row of previous.current.payments ?? []) live.add(rechimeKey("payment", row.id));
    liveKeys.current = live;
    if (events.length === 0) return;

    for (const event of events) {
      if (event.kind === "kitchen-ticket") {
        const orderId = next.kitchen?.find((row) => row.sub_ticket_id === event.entityId)?.order_id ?? event.entityId;
        acknowledgedOrders.delete(orderId);
        pending.current.set(rechimeKey("kitchen", event.entityId), { ackId: orderId, last: now, count: 0, tone: "new" });
      } else if (event.kind === "store-online") {
        acknowledgedOrders.delete(event.entityId);
        pending.current.set(rechimeKey("store", event.entityId), { ackId: event.entityId, last: now, count: 0, tone: "new" });
      } else if (event.kind === "service-request") {
        // A guest waiting for someone repeats until the request is handled.
        pending.current.set(rechimeKey("service", event.entityId), { ackId: event.entityId, last: now, count: 0, tone: "request" });
      } else if (event.kind === "payment") {
        pending.current.set(rechimeKey("payment", event.entityId), { ackId: event.entityId, last: now, count: 0, tone: "payment" });
      }
    }

    addHistory(events.map((event) => ({ kind: event.kind, title: alertTitle(event, copy), href: PAGE[event.kind], at: now })));

    const tone = toneFor(events);
    const quietForPush = !visible && pushCoversRef.current();
    const played = soundRef.current && tone && !quietForPush ? playTone(tone) : false;

    if (!visible) {
      awayCount.current += events.length;
      return;
    }

    const locked = soundRef.current && !played && !isAudioUnlocked();
    const hint = locked ? copy.tapSound : undefined;
    const enable = locked ? { label: copy.enable, onClick: () => void unlockAudio() } : undefined;
    const { shown, more } = groupForToasts(events);
    for (const event of shown) {
      toast(alertTitle(event, copy), {
        description: hint,
        action: enable ?? { label: copy.view, onClick: () => router.push(PAGE[event.kind]) },
      });
    }
    if (more > 0) toast(fill(copy.andMore, { count: more }), { action: { label: copy.view, onClick: requestOpen } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor.data, kitchen.data, expo.data, service.data, payments.data, storeOnline.data]);

  // Repeat anything still waiting (new tickets, store orders, guest requests, payments) after 45 s, at most twice.
  useEffect(() => {
    if (!visible && !frontline) return;
    const timer = window.setInterval(() => {
      const due = dueRechimes(pending.current, liveKeys.current, acknowledgedOrders, Date.now());
      if (due.length === 0 || !soundRef.current || (document.visibilityState !== "visible" && pushCoversRef.current())) return;
      const tone = toneFor(due.map((entry) => ({ tone: entry.tone ?? "new" })));
      if (tone) playTone(tone);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [visible, frontline]);

  return null;
}
