"use client";

import { useEffect, useRef, useState } from "react";

import { ConnectionBanner } from "@/components/ops/connection-banner";
import { fill } from "@/lib/i18n/dictionary";
import { offlineCopy } from "@/lib/i18n/staff/offline";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useNetwork } from "@/lib/offline/network";
import { useScope } from "@/stores/scope";

import { summarise } from "./queue-core";
import { useOfflineQueue } from "./queue";

function countLine(count: number, one: string, many: string): string {
  return fill(count === 1 ? one : many, { count });
}

/** Connection banner plus the offline till queue: "N waiting to sync", then "All synced". */
export function StaffConnectionBanner({ canSellOffline }: { canSellOffline: boolean }) {
  const t = useStaffSection(offlineCopy).banner;
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

  const waitingText = summary.waiting > 0 ? countLine(summary.waiting, t.waitingOne, t.waitingMany) : null;

  let syncDetail: string | null = null;
  if (summary.waiting > 0) {
    syncDetail = syncing
      ? countLine(summary.waiting, t.syncingOne, t.syncingMany)
      : failures > 0
        ? countLine(summary.waiting, t.retryOne, t.retryMany)
        : countLine(summary.waiting, t.waitingOne, t.waitingMany);
  } else if (summary.failed > 0) {
    syncDetail = countLine(summary.failed, t.failedOne, t.failedMany);
  } else if (allSynced) {
    syncDetail = summary.review > 0
      ? countLine(summary.review, t.syncedReviewOne, t.syncedReviewMany)
      : t.synced;
  }

  return <ConnectionBanner canSellOffline={canSellOffline} offlineDetail={waitingText} syncDetail={syncDetail} />;
}
