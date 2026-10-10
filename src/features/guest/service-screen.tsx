"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { guestServiceStatus, guestServiceType } from "@/features/guest/copy";
import { GuestSkeleton } from "@/features/guest/ordering-status";
import { BillSheet, WaiterSheet } from "@/features/guest/service-sheets";
import { fetchActiveServiceRequests } from "@/features/guest/service-request";
import { guestPrimaryButton, guestSecondaryButton, useGuestCopy } from "@/features/guest/shell";
import { usePollingInterval } from "@/hooks/use-page-visible";

export function ServiceScreen() {
  const { t, locale } = useGuestCopy();
  const interval = usePollingInterval(7000);
  const [waiterOpen, setWaiterOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);

  const active = useQuery({
    queryKey: ["guest-requests"],
    refetchInterval: interval,
    queryFn: fetchActiveServiceRequests,
  });

  const openCount = useMemo(
    () =>
      (active.data ?? []).filter(
        (request) => request.status === "PENDING" || request.status === "ACKNOWLEDGED",
      ).length,
    [active.data],
  );

  if (active.isLoading) return <GuestSkeleton label={t.loading} />;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="guest-display text-3xl">{t.service}</h1>
        <p className="text-sm text-[var(--guest-quiet)]">
          {openCount > 0 ? t.requestPending : t.serviceNote}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" className={guestPrimaryButton} onClick={() => setWaiterOpen(true)}>
          {t.callWaiterTitle}
        </button>
        <button type="button" className={guestSecondaryButton} onClick={() => setBillOpen(true)}>
          {t.askBill}
        </button>
      </div>

      <Link href="/order" className={guestSecondaryButton}>
        {t.backMenu}
      </Link>

      <ul className="grid gap-0 divide-y divide-[var(--guest-line)] border-y border-[var(--guest-line)]">
        {(active.data ?? []).map((request) => (
          <li key={request.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <span className="font-medium text-[var(--guest-ink)]">
              {guestServiceType[locale][request.request_type]}
            </span>
            <span className="guest-card px-3 py-1 text-[var(--guest-quiet)]">
              {guestServiceStatus[locale][request.status]}
            </span>
          </li>
        ))}
      </ul>

      <WaiterSheet open={waiterOpen} onOpenChange={setWaiterOpen} />
      <BillSheet open={billOpen} onOpenChange={setBillOpen} />
    </div>
  );
}
