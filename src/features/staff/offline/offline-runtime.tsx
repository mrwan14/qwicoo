"use client";

/**
 * Keeps the staff app usable offline: registers the service worker (shell cache), tracks
 * connectivity, warms the screens this person can open, and refreshes the IndexedDB copies
 * (menu, tables, offline settings) for the active branch while online.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useStaffSession } from "@/components/ops/staff-session";
import { browserApi } from "@/lib/api/browser";
import { navForUser } from "@/lib/nav";
import { listenForNetworkChanges, useNetwork } from "@/lib/offline/network";
import { useScope } from "@/stores/scope";

import { fetchMenu, fetchOfflineConfig, fetchTables, offlineQueryKeys } from "./offline-data";
import { backoffMs } from "./queue-core";
import { listenForQueueChanges, useOfflineQueue, useWaitingCount } from "./queue";

export const OFFLINE_SCREENS = ["/app/pos", "/app/kds", "/app/kds/expo"] as const;

/** Hand the worker every script, style and font this page already loaded (they loaded before it took control). */
function warmLoadedAssets(): void {
  const controller = navigator.serviceWorker.controller;
  if (!controller) return;
  const urls = new Set<string>();
  for (const entry of performance.getEntriesByType("resource")) urls.add(entry.name);
  document.querySelectorAll<HTMLScriptElement>("script[src]").forEach((node) => urls.add(node.src));
  document.querySelectorAll<HTMLLinkElement>("link[href]").forEach((node) => urls.add(node.href));
  controller.postMessage({ type: "qwicoo:warm-assets", urls: [...urls] });
}

/** Registers the worker; resolves once it controls this page (so warm-up fetches go through it). */
async function registerShellWorker(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    if (!navigator.serviceWorker.controller) {
      const changed = new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
        window.setTimeout(resolve, 15_000);
      });
      // A page that opened while the worker was installing can miss its first claim; ask again.
      const ready = await navigator.serviceWorker.ready;
      ready.active?.postMessage({ type: "qwicoo:claim" });
      await changed;
    }
    if (!navigator.serviceWorker.controller) return false;
    warmLoadedAssets();
    return true;
  } catch {
    // Offline shell is a bonus; the app works online without it.
    return false;
  }
}

export function OfflineRuntime() {
  const me = useStaffSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const branchId = useScope((state) => state.branchId);
  const online = useNetwork((state) => state.online);
  const [controlled, setControlled] = useState(false);

  const waiting = useWaitingCount(branchId);
  const syncing = useOfflineQueue((state) => state.syncing);
  const failures = useOfflineQueue((state) => state.failures);
  const lastSyncedAt = useOfflineQueue((state) => state.lastSyncedAt);

  useEffect(() => {
    listenForNetworkChanges();
    listenForQueueChanges();
    void registerShellWorker().then(setControlled);
    void useOfflineQueue.getState().load();
  }, []);

  // Check in about once a minute so guest QR ordering pauses if this branch's devices go quiet.
  useEffect(() => {
    if (!online || !branchId) return;
    const beat = () =>
      void browserApi.POST("/api/v1/branches/{branch_id}/heartbeat", { params: { path: { branch_id: branchId } } }).catch(() => undefined);
    beat();
    const timer = window.setInterval(beat, 60_000);
    return () => window.clearInterval(timer);
  }, [online, branchId]);

  // Back online: sync straight away rather than waiting out the offline backoff.
  useEffect(() => {
    if (online) useOfflineQueue.setState({ failures: 0 });
  }, [online]);

  // Sync queued offline actions, in order, whenever we're online; back off after failures.
  // Offline, keep probing on the same schedule so the till notices the connection coming back.
  useEffect(() => {
    if (!branchId || waiting === 0 || syncing) return;
    const delay = failures === 0 ? (online ? 500 : 5_000) : backoffMs(failures);
    const timer = window.setTimeout(() => void useOfflineQueue.getState().sync(), delay);
    return () => window.clearTimeout(timer);
  }, [online, branchId, waiting, syncing, failures]);

  // Fresh server data once offline orders have landed.
  useEffect(() => {
    if (!lastSyncedAt) return;
    for (const key of ["kds-tickets", "expo", "payments", "floor", "offline-review"]) void queryClient.invalidateQueries({ queryKey: [key] });
  }, [lastSyncedAt, queryClient]);

  const screens = me ? navForUser(me, branchId).map((item) => item.href).filter((href) => (OFFLINE_SCREENS as readonly string[]).includes(href)) : [];
  const screensKey = screens.join(",");
  const canSell = screens.includes("/app/pos");

  // Load each offline-capable screen once while online so the service worker keeps a copy.
  useEffect(() => {
    if (!online || !screensKey || !controlled) return;
    const timer = window.setTimeout(() => {
      for (const href of screensKey.split(",")) {
        router.prefetch(href);
        // Accept: text/html tells the service worker to keep this page for offline use.
        void fetch(href, { credentials: "same-origin", headers: { Accept: "text/html" } }).catch(() => undefined);
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [online, screensKey, router, controlled]);

  // Refresh the till's offline copies whenever we're online on a branch.
  useEffect(() => {
    if (!online || !branchId || !canSell) return;
    void queryClient.prefetchQuery({ queryKey: offlineQueryKeys.menu(branchId), queryFn: () => fetchMenu(branchId) });
    void queryClient.prefetchQuery({ queryKey: offlineQueryKeys.tables(branchId), queryFn: () => fetchTables(branchId) });
    void queryClient.prefetchQuery({ queryKey: offlineQueryKeys.config(branchId), queryFn: () => fetchOfflineConfig(branchId) });
  }, [online, branchId, canSell, queryClient]);

  return null;
}
