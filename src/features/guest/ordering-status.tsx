"use client";

/**
 * Guest QR ordering pauses when the API can't be reached, or when the branch's tills are offline
 * (no staff device has checked in lately at a branch that sells offline). Guests order at the counter.
 */
import { useQuery } from "@tanstack/react-query";
import { PauseCircle } from "lucide-react";

import { guestApi } from "@/lib/api/guest";
import { useGuest } from "@/stores/guest";

import { guestCopy } from "./copy";

/** True when an error means the API (or our proxy to it) is unreachable rather than saying no. */
export function isGuestUnreachable(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const status = (error as { status?: number } | null)?.status;
  return status === 502 || status === 503 || status === 504;
}

export function useOrderingPaused(): boolean {
  const branchId = useGuest((state) => state.session?.branchId ?? null);
  const status = useQuery({
    queryKey: ["guest-ordering-status", branchId],
    enabled: Boolean(branchId),
    refetchInterval: 30_000,
    retry: false,
    queryFn: async () => {
      try {
        const result = await guestApi.GET("/api/v1/sessions/ordering-status");
        if ([502, 503, 504].includes(result.response.status)) return { paused: true };
        return { paused: Boolean(result.data?.ordering_paused) };
      } catch (error) {
        if (isGuestUnreachable(error)) return { paused: true };
        throw error;
      }
    },
  });
  return status.data?.paused ?? false;
}

export function OrderingPausedNotice({ onRetry, retryLabel }: { onRetry?: () => void; retryLabel?: string }) {
  const locale = useGuest((state) => state.locale);
  const t = guestCopy[locale];
  return (
    <section role="alert" className="grid gap-2 rounded-2xl bg-secondary px-4 py-4">
      <p className="flex items-center gap-2 text-base font-semibold">
        <PauseCircle aria-hidden className="size-5 shrink-0 text-primary" />
        {t.orderingPaused}
      </p>
      <p className="text-sm leading-6 text-muted-foreground">{t.orderingPausedBody}</p>
      {onRetry ? (
        <button type="button" className="min-h-11 justify-self-start text-sm font-medium underline underline-offset-4" onClick={onRetry}>
          {retryLabel ?? t.retry}
        </button>
      ) : null}
    </section>
  );
}
