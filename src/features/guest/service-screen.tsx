"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { guestServiceStatus, guestServiceType } from "@/features/guest/copy";
import { guestPrimaryButton, guestSecondaryButton, useGuestCopy } from "@/features/guest/shell";
import { usePollingInterval } from "@/hooks/use-page-visible";
import { asApiError } from "@/lib/api/error";
import { guestApi } from "@/lib/api/guest";
import type { components } from "@/lib/api/schema";

const TYPES: components["schemas"]["ServiceRequestType"][] = [
  "WAITER_CALL",
  "WATER",
  "WATER_REFILL",
  "CUTLERY",
  "NAPKINS",
  "PLATES",
  "PACK_LEFTOVERS",
  "BILL_REQUEST",
  "TAKEAWAY_ORDER",
  "OTHER",
];

export function ServiceScreen() {
  const { t, locale } = useGuestCopy();
  const interval = usePollingInterval(7000);
  const [type, setType] = useState<components["schemas"]["ServiceRequestType"]>("WAITER_CALL");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const active = useQuery({
    queryKey: ["guest-requests"],
    refetchInterval: interval,
    queryFn: async () => {
      const result = await guestApi.GET("/api/v1/service-requests/table/active");
      if (!result.response.ok || !result.data) return [];
      return result.data;
    },
  });

  async function submit() {
    setPending(true);
    const body: components["schemas"]["CreateServiceRequest"] = {
      request_type: type,
      note: note.trim() || null,
    };
    try {
      const result = await guestApi.POST("/api/v1/service-requests", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.oops, locale);
      toast.success(t.service);
      setNote("");
      void active.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.oops);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-[length:var(--text-28)] font-semibold">{t.service}</h1>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={t.service}>
        {TYPES.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={type === item}
            className={type === item ? guestPrimaryButton : guestSecondaryButton}
            onClick={() => setType(item)}
          >
            {guestServiceType[locale][item]}
          </button>
        ))}
      </div>
      <label className="grid gap-1 text-sm font-medium">
        {t.serviceNote}
        <textarea className="min-h-20 rounded-xl border bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <button
        type="button"
        className={guestPrimaryButton}
        disabled={pending}
        onClick={() => void submit()}
      >
        {pending ? t.paying : t.sendRequest}
      </button>
      <Link href="/order" className={guestSecondaryButton}>{t.backMenu}</Link>
      <ul className="grid gap-2">
        {(active.data ?? []).map((request) => (
          <li key={request.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm">
            <span className="font-medium">{guestServiceType[locale][request.request_type]}</span>
            <span className="rounded-full bg-secondary px-3 py-1">{guestServiceStatus[locale][request.status]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
