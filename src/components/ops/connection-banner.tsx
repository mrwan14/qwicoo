"use client";

import { useQuery } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { usePageVisible, usePollingInterval } from "@/hooks/use-page-visible";
import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useNetwork } from "@/lib/offline/network";

type ReadyPayload = {
  status?: string;
  database?: string;
  redis?: string;
};

/**
 * Staff header strip: connection state. Offline it explains what still works; screens that keep
 * an offline queue (the till) pass `offlineDetail` / `syncDetail` to show its progress.
 */
export function ConnectionBanner({
  canSellOffline = false,
  offlineDetail,
  syncDetail,
}: {
  canSellOffline?: boolean;
  offlineDetail?: ReactNode;
  syncDetail?: ReactNode;
}) {
  const t = useStaffSection(commonCopy);
  const visible = usePageVisible();
  const online = useNetwork((state) => state.online);
  const interval = usePollingInterval(online ? 30_000 : 10_000);
  const query = useQuery({
    queryKey: ["health", "ready"],
    refetchInterval: interval,
    refetchIntervalInBackground: false,
    retry: false,
    queryFn: async (): Promise<ReadyPayload> => {
      const response = await fetch("/api/health/ready", {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("offline");
      return (await response.json()) as ReadyPayload;
    },
  });

  useEffect(() => {
    if (query.isError) useNetwork.getState().markOffline();
    else if (query.data?.status === "ready") useNetwork.getState().markOnline();
  }, [query.isError, query.data, query.dataUpdatedAt, query.errorUpdatedAt]);

  if (!online || query.isError) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border bg-warning-bg px-4 py-2 text-sm text-ink" role="alert">
        <span className="flex items-center gap-2">
          <WifiOff aria-hidden className="size-4 shrink-0" />
          <span>
            <span className="font-medium">{t.offline}</span>{" "}
            {canSellOffline ? t.offlineTill : t.offlineRead}
            {offlineDetail ? <> {offlineDetail}</> : null}
          </span>
        </span>
        <button type="button" className="min-h-11 font-medium underline underline-offset-4" onClick={() => void query.refetch()}>
          {t.tryAgain}
        </button>
      </div>
    );
  }

  if (syncDetail) {
    return (
      <p className="border-b border-border bg-subtle px-4 py-1.5 text-sm text-ink" role="status">
        {syncDetail}
      </p>
    );
  }

  if (!visible) {
    return (
      <p className="border-b border-border bg-subtle px-4 py-1.5 text-xs text-ink-secondary" role="status">
        {t.updatesPaused}
      </p>
    );
  }

  // Checking and connected are announced but not drawn: the design keeps the bar clear when all is well.
  if (query.isPending) {
    return (
      <p className="sr-only" role="status">
        {t.checking}
      </p>
    );
  }

  if (query.data?.status === "ready") {
    return (
      <p className="sr-only" role="status">
        {t.connected}
      </p>
    );
  }

  return (
    <p className="border-b border-border bg-subtle px-4 py-1.5 text-xs text-ink-secondary" role="status">
      {t.serviceNotReady}
    </p>
  );
}
