"use client";

/**
 * Guest QR ordering pauses when the API can't be reached, or when the branch's tills are offline
 * (no staff device has checked in lately at a branch that sells offline). Guests order at the counter.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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
  const dir = locale === "ar" ? "rtl" : "ltr";
  const [open, setOpen] = useState(true);
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          dir={dir}
          lang={locale}
          showCloseButton={false}
          className="guest-theme max-w-[22rem] gap-2 rounded-[var(--guest-radius-card)] border-0 bg-[var(--guest-surface)] p-5 pe-14 text-[var(--guest-ink)] shadow-[var(--guest-shadow)] ring-0"
        >
          <DialogClose
            className="absolute end-2 top-2 inline-flex size-11 items-center justify-center rounded-full text-[var(--guest-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--guest-orange)]"
            aria-label={t.close}
          >
            <X className="size-5" aria-hidden />
          </DialogClose>
          <DialogTitle className="guest-display text-lg leading-6">{t.orderingPaused}</DialogTitle>
          <DialogDescription className="guest-body text-start text-[var(--guest-quiet)]">
            {t.orderingPausedBody}
          </DialogDescription>
        </DialogContent>
      </Dialog>
      {!open && onRetry ? (
        <button type="button" className="guest-btn guest-btn-ghost guest-motion justify-self-start" onClick={onRetry}>
          {retryLabel ?? t.retry}
        </button>
      ) : null}
    </>
  );
}

export { GuestMotionSkeleton as GuestSkeleton } from "@/features/guest/guest-motion";
