"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { LocaleText } from "@/components/ops/locale-text";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { usePollingInterval } from "@/hooks/use-page-visible";
import { useScope } from "@/stores/scope";

export function ExpoScreen() {
  const interval = usePollingInterval(7000);
  const branchId = useScope((state) => state.branchId);
  const [token, setToken] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const orders = useQuery({
    queryKey: ["expo"],
    refetchInterval: interval,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/kds/expo/orders");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Expo failed");
      return result.data;
    },
  });

  const bump = useMutation({
    mutationFn: async (orderId: string) => {
      const result = await browserApi.POST("/api/v1/kds/orders/{order_id}/expo-bump", {
        params: { path: { order_id: orderId } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Expo bump failed");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["expo"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const saveNotes = useMutation({
    mutationFn: async (orderId: string) => {
      const result = await browserApi.PATCH("/api/v1/kds/orders/{order_id}/expo-notes", {
        params: { path: { order_id: orderId } },
        body: { expo_notes: notes[orderId] ?? "" },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Notes failed");
    },
    onSuccess: () => toast.success("Notes saved"),
    onError: (error: Error) => toast.error(error.message),
  });

  const ticketBump = useMutation({
    mutationFn: async (ticketItemId: string) => {
      const result = await browserApi.POST("/api/v1/kds/ticket-items/{ticket_item_id}/bump", {
        params: { path: { ticket_item_id: ticketItemId } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Item bump failed");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["expo"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const verify = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/orders/handover/verify", {
        body: { token, branch_id: branchId },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Handover failed");
    },
    onSuccess: () => toast.success("Handover verified"),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid gap-4">
      <h1 className="text-[length:var(--text-28)] font-semibold">Expo</h1>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          verify.mutate();
        }}
      >
        <input className="h-12 min-w-48 flex-1 rounded-lg border px-3" placeholder="Handover token" value={token} onChange={(event) => setToken(event.target.value)} />
        <button className="min-h-14 rounded-lg bg-primary px-4 text-sm text-primary-foreground" type="submit">
          Verify handover
        </button>
      </form>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(orders.data ?? []).map((order) => (
          <article key={order.order_id} className="grid gap-2 rounded-xl border p-3">
            <p className="text-[length:var(--text-20)] font-semibold">
              #{order.pickup_number ?? "—"} · {order.status}
            </p>
            <ul className="grid gap-2">
              {(order.ticket_items ?? []).map((item) => (
                <li key={item.id}>
                  <button type="button" className="min-h-14 w-full rounded-lg border px-3 text-start" onClick={() => ticketBump.mutate(item.id)}>
                    {item.quantity} × <LocaleText value={item.item_name ?? item.station} />
                  </button>
                </li>
              ))}
            </ul>
            <textarea
              className="min-h-20 rounded-lg border px-3 py-2"
              value={notes[order.order_id] ?? order.expo_notes ?? ""}
              onChange={(event) => setNotes((current) => ({ ...current, [order.order_id]: event.target.value }))}
            />
            <button type="button" className="min-h-11 rounded-lg border text-sm" onClick={() => saveNotes.mutate(order.order_id)}>
              Save notes
            </button>
            <button type="button" className="min-h-14 rounded-lg bg-primary text-sm font-medium text-primary-foreground" onClick={() => bump.mutate(order.order_id)}>
              Mark ready
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
