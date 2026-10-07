"use client";

/**
 * Keeps the staff app usable offline: registers the service worker (shell cache), tracks
 * connectivity, warms the screens this person can open, and refreshes the IndexedDB copies
 * (menu, tables, offline settings) for the active branch while online.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useStaffSession } from "@/components/ops/staff-session";
import { navForUser } from "@/lib/nav";
import { listenForNetworkChanges, useNetwork } from "@/lib/offline/network";
import { useScope } from "@/stores/scope";

import { fetchMenu, fetchOfflineConfig, fetchTables, offlineQueryKeys } from "./offline-data";

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

async function registerShellWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    if (navigator.serviceWorker.controller) warmLoadedAssets();
    else navigator.serviceWorker.addEventListener("controllerchange", warmLoadedAssets, { once: true });
  } catch {
    // Offline shell is a bonus; the app works online without it.
  }
}

export function OfflineRuntime() {
  const me = useStaffSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const branchId = useScope((state) => state.branchId);
  const online = useNetwork((state) => state.online);

  useEffect(() => {
    listenForNetworkChanges();
    void registerShellWorker();
  }, []);

  const screens = me ? navForUser(me, branchId).map((item) => item.href).filter((href) => (OFFLINE_SCREENS as readonly string[]).includes(href)) : [];
  const screensKey = screens.join(",");
  const canSell = screens.includes("/app/pos");

  // Load each offline-capable screen once while online so the service worker keeps a copy.
  useEffect(() => {
    if (!online || !screensKey) return;
    const timer = window.setTimeout(() => {
      for (const href of screensKey.split(",")) {
        router.prefetch(href);
        // Accept: text/html tells the service worker to keep this page for offline use.
        void fetch(href, { credentials: "same-origin", headers: { Accept: "text/html" } }).catch(() => undefined);
      }
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [online, screensKey, router]);

  // Refresh the till's offline copies whenever we're online on a branch.
  useEffect(() => {
    if (!online || !branchId || !canSell) return;
    void queryClient.prefetchQuery({ queryKey: offlineQueryKeys.menu(branchId), queryFn: () => fetchMenu(branchId) });
    void queryClient.prefetchQuery({ queryKey: offlineQueryKeys.tables(branchId), queryFn: () => fetchTables(branchId) });
    void queryClient.prefetchQuery({ queryKey: offlineQueryKeys.config(branchId), queryFn: () => fetchOfflineConfig(branchId) });
  }, [online, branchId, canSell, queryClient]);

  return null;
}
