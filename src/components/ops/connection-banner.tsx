"use client";

import { useQuery } from "@tanstack/react-query";

import { usePageVisible, usePollingInterval } from "@/hooks/use-page-visible";

type ReadyPayload = {
  status?: string;
  database?: string;
  redis?: string;
};

export function ConnectionBanner() {
  const visible = usePageVisible();
  const interval = usePollingInterval(30_000);
  const query = useQuery({
    queryKey: ["health", "ready"],
    refetchInterval: interval,
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<ReadyPayload> => {
      const response = await fetch("/api/health/ready", {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("offline");
      return (await response.json()) as ReadyPayload;
    },
  });

  if (!visible) {
    return (
      <p className="bg-muted px-4 py-2 text-xs text-muted-foreground" role="status">
        Updates paused while this tab is hidden.
      </p>
    );
  }

  if (query.isError) {
    return (
      <div className="flex items-center justify-between gap-3 bg-destructive/15 px-4 py-2 text-sm" role="alert">
        <span>Cannot reach the service.</span>
        <button type="button" className="min-h-11 underline" onClick={() => void query.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  if (query.isPending) {
    return (
      <p className="bg-muted px-4 py-1 text-xs text-muted-foreground" role="status">
        Checking service…
      </p>
    );
  }

  if (query.data?.status === "ready") {
    return (
      <p className="px-4 py-1 text-xs text-muted-foreground" role="status">
        <span className="me-2 inline-block size-2 rounded-full bg-success align-middle" aria-hidden />
        Connected
      </p>
    );
  }

  return (
    <p className="bg-muted px-4 py-1 text-xs text-muted-foreground" role="status">
      Service is not ready.
    </p>
  );
}
