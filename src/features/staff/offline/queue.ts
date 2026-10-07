"use client";

/**
 * The offline till queue on this device: IndexedDB-backed, shared across tabs, synced in order.
 * Pure rules live in queue-core.ts.
 */
import { create } from "zustand";

import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { queueAll, queueDelete, queuePut } from "@/lib/offline/idb";
import { useNetwork } from "@/lib/offline/network";
import { useScope } from "@/stores/scope";

import {
  applyResults,
  buildBatch,
  isWaiting,
  newOfflineOrder,
  offlineNumber,
  prune,
  withCancel,
  withTransition,
  type NewOrderInput,
  type OfflineOrder,
  type SyncResult,
  type TransitionTarget,
} from "./queue-core";

const DEVICE_KEY = "qwicoo:device-id";
const COUNTER_KEY = "qwicoo:offline-counter";
const SEQ_KEY = "qwicoo:offline-seq";
const CHANNEL = "qwicoo-offline-queue";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replace(/-/g, "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

/** Stable id for this browser; survives sign-out so OFF numbers never repeat on a till. */
export function deviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const created = `dev_${randomId().slice(0, 16)}`;
    localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    return "dev_unknowntill";
  }
}

function bump(key: string, by = 1): number {
  try {
    const current = Number(localStorage.getItem(key) ?? "0") || 0;
    localStorage.setItem(key, String(current + by));
    return current + 1;
  } catch {
    return Date.now();
  }
}

export function newKey(prefix: string): string {
  return `${prefix}_${randomId()}`.slice(0, 64);
}

let channel: BroadcastChannel | null = null;
function announce(): void {
  try {
    channel ??= new BroadcastChannel(CHANNEL);
    channel.postMessage("changed");
  } catch {
    // Single-tab browsers still work.
  }
}

async function persist(orders: OfflineOrder[], before: OfflineOrder[]): Promise<void> {
  const prior = new Map(before.map((order) => [order.id, order]));
  const keep = new Set(orders.map((order) => order.id));
  for (const order of orders) if (prior.get(order.id) !== order) await queuePut(order);
  for (const order of before) if (!keep.has(order.id)) await queueDelete(order.id);
  announce();
}

export type SaleInput = Omit<NewOrderInput, "id" | "deviceId" | "offlineNumber" | "createdAt" | "keys" | "seq">;

type QueueState = {
  orders: OfflineOrder[];
  loaded: boolean;
  syncing: boolean;
  /** Consecutive failed syncs (drives the retry backoff). */
  failures: number;
  lastSyncedAt: number | null;
  lastError: string | null;
  load: () => Promise<void>;
  addSale: (input: SaleInput) => Promise<OfflineOrder>;
  advance: (orderId: string, target: TransitionTarget) => Promise<void>;
  cancel: (orderId: string, reason: string) => Promise<void>;
  sync: () => Promise<void>;
};

export const useOfflineQueue = create<QueueState>((set, get) => {
  async function update(orderId: string, change: (order: OfflineOrder) => OfflineOrder): Promise<void> {
    await get().load();
    const before = get().orders;
    const orders = before.map((order) => (order.id === orderId ? change(order) : order));
    set({ orders });
    await persist(orders, before);
  }

  return {
    orders: [],
    loaded: false,
    syncing: false,
    failures: 0,
    lastSyncedAt: null,
    lastError: null,

    load: async () => {
      const stored = await queueAll<OfflineOrder>();
      const kept = prune(stored, Date.now());
      for (const order of stored) if (!kept.includes(order)) await queueDelete(order.id);
      kept.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      set({ orders: kept, loaded: true });
    },

    addSale: async (input) => {
      const device = deviceId();
      const order = newOfflineOrder({
        ...input,
        id: newKey("ord"),
        deviceId: device,
        offlineNumber: offlineNumber(device, bump(COUNTER_KEY)),
        createdAt: new Date().toISOString(),
        keys: [newKey("act"), newKey("act")],
        seq: bump(SEQ_KEY, 2),
      });
      await get().load();
      const before = get().orders;
      const orders = [...before, order];
      set({ orders });
      await persist(orders, before);
      return order;
    },

    advance: (orderId, target) => update(orderId, (order) => withTransition(order, target, newKey("act"), bump(SEQ_KEY), new Date().toISOString())),

    cancel: (orderId, reason) => update(orderId, (order) => withCancel(order, reason, newKey("act"), bump(SEQ_KEY), new Date().toISOString())),

    sync: async () => {
      const branchId = useScope.getState().branchId;
      if (get().syncing || !branchId) return;
      set({ syncing: true });
      const run = async () => {
        await get().load();
        for (let round = 0; round < 10; round += 1) {
          const batch = buildBatch(get().orders, branchId);
          if (batch.length === 0) break;
          const result = await browserApi.POST("/api/v1/pos/sync", {
            body: { device_id: deviceId(), actions: batch as unknown as components["schemas"]["SyncRequest"]["actions"] },
          });
          if (!result.response.ok || !result.data) {
            throw Object.assign(new Error(result.response.status >= 500 ? "Qwicoo couldn't be reached." : "Sync was refused."), { status: result.response.status });
          }
          const before = get().orders;
          const orders = applyResults(before, result.data.results as unknown as SyncResult[], result.data.synced_at);
          set({ orders });
          await persist(orders, before);
          // Anything still pending after a round (final=false) waits for the next retry.
          const stuck = result.data.results.some((row) => row.final === false);
          if (stuck) throw Object.assign(new Error("Some offline orders are waiting on an earlier step."), { status: 409 });
        }
      };
      try {
        const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
        if (locks) await locks.request("qwicoo-offline-sync", { ifAvailable: true }, async (lock) => (lock ? run() : undefined));
        else await run();
        set({ failures: 0, lastSyncedAt: Date.now(), lastError: null });
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === undefined || status >= 500) useNetwork.getState().markOffline();
        set((state) => ({ failures: state.failures + 1, lastError: error instanceof Error ? error.message : "Sync failed" }));
      } finally {
        set({ syncing: false });
      }
    },
  };
});

let listening = false;
/** Reload when another tab on this device changes the queue (e.g. the kitchen tab). */
export function listenForQueueChanges(): void {
  if (listening || typeof BroadcastChannel === "undefined") return;
  listening = true;
  const incoming = new BroadcastChannel(CHANNEL);
  incoming.onmessage = () => void useOfflineQueue.getState().load();
}

export function useWaitingCount(branchId: string | null): number {
  return useOfflineQueue((state) => state.orders.filter((order) => (!branchId || order.branchId === branchId) && isWaiting(order)).length);
}
