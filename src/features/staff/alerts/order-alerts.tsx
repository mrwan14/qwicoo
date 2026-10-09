"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useStaffSession } from "@/components/ops/staff-session";
import { fetchFloorLive, floorLiveQueryKey } from "@/hooks/use-floor-live";
import { pollUnlessRoleDenied, usePageVisible } from "@/hooks/use-page-visible";
import { fill } from "@/lib/i18n/dictionary";
import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { isAudioUnlocked, playTone, unlockAudio } from "@/lib/sound/tones";
import { orderStatusLabel, paymentMethodLabel } from "@/lib/status-labels";
import { useScope } from "@/stores/scope";

import {
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
import { acknowledgedOrders, alertIgnoreList } from "./ignore";
import { useAlertPreferences } from "./preferences";
import {
  expoKey,
  fetchExpoOrders,
  fetchKdsTickets,
  fetchPendingPayments,
  fetchServiceQueue,
  kdsTicketsKey,
  paymentsPendingKey,
  serviceQueueKey,
} from "./queries";

const POLL_MS = 7000;
const RECHIME_MS = 45_000;
const MAX_RECHIMES = 2;

const PAGE: Record<AlertEvent["kind"], string> = {
  confirmation: "/app/floor",
  "floor-status": "/app/floor",
  payment: "/app/payments",
  "service-request": "/app/floor/requests",
  "kitchen-ticket": "/app/kds",
  "handover-ready": "/app/kds/expo",
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
  }
}

/** One watcher for the whole staff app. Mounted once from StaffRuntime. */
export function OrderAlerts() {
  const copy = useStaffSection(commonCopy);
  const me = useStaffSession();
  const router = useRouter();
  const branchId = useScope((state) => state.branchId);
  const visible = usePageVisible();
  const { active, soundOn } = useAlertPreferences();

  const audience: AlertAudience | null = me
    ? { role: me.role as AlertRole, branchId, adminOptIn: active }
    : null;
  const sources = audience && active ? sourcesFor(audience) : [];
  const on = (source: string) => Boolean(branchId) && sources.includes(source as never);
  const interval = visible ? POLL_MS : false;
  const refetchInterval = pollUnlessRoleDenied(interval);

  const floor = useQuery({ queryKey: floorLiveQueryKey(branchId), queryFn: () => fetchFloorLive(branchId), enabled: on("floor"), refetchInterval, retry: false });
  const kitchen = useQuery({ queryKey: kdsTicketsKey(branchId), queryFn: fetchKdsTickets, enabled: on("kitchen"), refetchInterval, retry: false });
  const expo = useQuery({ queryKey: expoKey(branchId), queryFn: fetchExpoOrders, enabled: on("expo"), refetchInterval, retry: false });
  const service = useQuery({ queryKey: serviceQueueKey(branchId), queryFn: fetchServiceQueue, enabled: on("service"), refetchInterval, retry: false });
  const payments = useQuery({ queryKey: paymentsPendingKey(branchId), queryFn: fetchPendingPayments, enabled: on("payments"), refetchInterval, retry: false });

  const previous = useRef<Snapshot | null>(null);
  const wasAway = useRef(false);
  const pending = useRef(new Map<string, { orderId: string; last: number; count: number }>());
  const liveTickets = useRef(new Set<string>());
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

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

  // New branch, role or opt-in: start again from a baseline.
  useEffect(() => {
    previous.current = null;
    pending.current.clear();
  }, [branchId, me?.role, active]);

  useEffect(() => {
    if (!visible) wasAway.current = true;
  }, [visible]);

  useEffect(() => {
    if (!audience || !active) return;
    const next: Snapshot = {
      floor: on("floor") ? floor.data?.tables : undefined,
      kitchen: on("kitchen") ? kitchen.data : undefined,
      expo: on("expo") ? expo.data : undefined,
      service: on("service") ? service.data : undefined,
      payments: on("payments") ? payments.data?.map((row) => ({ ...row, branch_id: null })) : undefined,
    };
    if (Object.values(next).every((value) => value === undefined)) return;
    const now = Date.now();
    pruneIgnore(alertIgnoreList, now);
    const events = diffSnapshots(previous.current, next, audience, alertIgnoreList, now);
    previous.current = mergeSnapshot(previous.current, next);
    if (next.kitchen) liveTickets.current = new Set(next.kitchen.map((row) => row.sub_ticket_id));
    const returning = wasAway.current && visible;
    if (returning) wasAway.current = false;
    if (events.length === 0) return;

    for (const event of events) {
      if (event.kind !== "kitchen-ticket") continue;
      const orderId = next.kitchen?.find((row) => row.sub_ticket_id === event.entityId)?.order_id ?? event.entityId;
      acknowledgedOrders.delete(orderId);
      pending.current.set(event.entityId, { orderId, last: now, count: 0 });
    }

    const tone = toneFor(events);
    const played = soundRef.current && tone ? playTone(tone) : false;
    const locked = soundRef.current && !played && !isAudioUnlocked();
    const hint = locked ? copy.tapSound : undefined;
    const enable = locked ? { label: copy.enable, onClick: () => void unlockAudio() } : undefined;

    if (returning && events.length > 3) {
      toast(fill(copy.newWhileAway, { count: events.length }), { description: hint, action: enable });
      return;
    }
    const { shown, more } = groupForToasts(events);
    for (const event of shown) {
      toast(alertTitle(event, copy), {
        description: hint,
        action: enable ?? { label: copy.view, onClick: () => router.push(PAGE[event.kind]) },
      });
    }
    if (more > 0) toast(fill(copy.andMore, { count: more }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor.data, kitchen.data, expo.data, service.data, payments.data]);

  // Kitchen: re-chime an unacknowledged new ticket after 45 s, at most twice.
  useEffect(() => {
    if (!visible) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      let chime = false;
      for (const [id, entry] of pending.current) {
        if (!liveTickets.current.has(id) || acknowledgedOrders.has(entry.orderId) || entry.count >= MAX_RECHIMES) {
          pending.current.delete(id);
          continue;
        }
        if (now - entry.last >= RECHIME_MS) {
          entry.last = now;
          entry.count += 1;
          chime = true;
        }
      }
      if (chime && soundRef.current) playTone("new");
    }, 5000);
    return () => window.clearInterval(timer);
  }, [visible]);

  return null;
}
