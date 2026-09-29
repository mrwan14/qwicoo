"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useGuestCopy } from "@/features/guest/shell";
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
      <label className="grid gap-1 text-sm font-medium">
        {t.service}
        <select
          className="h-12 rounded-lg border px-3"
          value={type}
          onChange={(event) => setType(event.target.value as typeof type)}
        >
          {TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        {t.notes}
        <textarea className="min-h-20 rounded-lg border px-3 py-2" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <button
        type="button"
        className="min-h-14 rounded-lg bg-primary text-sm font-medium text-primary-foreground"
        disabled={pending}
        onClick={() => void submit()}
      >
        {t.call}
      </button>
      <ul className="grid gap-2">
        {(active.data ?? []).map((request) => (
          <li key={request.id} className="rounded-lg border p-3 text-sm">
            {request.request_type} · {request.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
