"use client";

import { useEffect, useRef, useState } from "react";

import { ConnectionBanner } from "@/components/ops/connection-banner";
import { useNetwork } from "@/lib/offline/network";
import { useScope } from "@/stores/scope";

import { summarise } from "./queue-core";
import { useOfflineQueue } from "./queue";

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Connection banner plus the offline till queue: "N waiting to sync", then "All synced". */
export function StaffConnectionBanner({ canSellOffline }: { canSellOffline: boolean }) {
  const branchId = useScope((state) => state.branchId);
  const online = useNetwork((state) => state.online);
  const orders = useOfflineQueue((state) => state.orders);
  const syncing = useOfflineQueue((state) => state.syncing);
  const failures = useOfflineQueue((state) => state.failures);
  const summary = summarise(orders, branchId);
  const [allSynced, setAllSynced] = useState(false);
  const hadWaiting = useRef(false);

  useEffect(() => {
    if (summary.waiting > 0) {
      hadWaiting.current = true;
      setAllSynced(false);
      return;
    }
    if (!hadWaiting.current || !online) return;
    hadWaiting.current = false;
    setAllSynced(true);
    const timer = window.setTimeout(() => setAllSynced(false), 12_000);
    return () => window.clearTimeout(timer);
  }, [summary.waiting, online]);

  const waitingText = summary.waiting > 0 ? `${plural(summary.waiting, "order", "orders")} waiting to sync.` : null;

  let syncDetail: string | null = null;
  if (summary.waiting > 0) {
    syncDetail = syncing
      ? `Syncing offline orders… ${plural(summary.waiting, "order", "orders")} waiting to sync.`
      : failures > 0
        ? `${plural(summary.waiting, "order", "orders")} waiting to sync. Retrying shortly.`
        : `${plural(summary.waiting, "order", "orders")} waiting to sync.`;
  } else if (summary.failed > 0) {
    syncDetail = `${plural(summary.failed, "offline order", "offline orders")} couldn't sync. A branch admin can check it in Offline orders.`;
  } else if (allSynced) {
    syncDetail = summary.review > 0
      ? `All synced. ${plural(summary.review, "order is", "orders are")} flagged for a branch admin to review.`
      : "All synced. Offline orders now have their real numbers.";
  }

  return <ConnectionBanner canSellOffline={canSellOffline} offlineDetail={waitingText} syncDetail={syncDetail} />;
}
