"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { LocaleText } from "@/components/ops/locale-text";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { pollUnlessRoleDenied, usePollingInterval } from "@/hooks/use-page-visible";
import type { components } from "@/lib/api/schema";
import { useScope } from "@/stores/scope";

/** `table_number` and item notes are read when the API sends them; the generated schema doesn't list them yet. */
type ExpoOrder = components["schemas"]["KDSExpoOrderResponse"] & { table_number?: string | null };
type ExpoItem = components["schemas"]["KitchenTicketItemResponse"] & {
  special_instructions?: string | null;
  notes?: string | null;
};

function displayNumber(order: ExpoOrder): string | null {
  if (order.pickup_number != null) return `#${order.pickup_number}`;
  if (order.table_number?.trim()) return `Table ${order.table_number.trim()}`;
  return null;
}

function itemNote(item: ExpoItem): string | null {
  const note = (item.special_instructions ?? item.notes ?? "").trim();
  return note || null;
}

function statusLabel(status: string): string {
  const words = status.replaceAll("_", " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function ExpoScreen() {
  const interval = usePollingInterval(7000);
  const branchId = useScope((state) => state.branchId);
  const [token, setToken] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const orders = useQuery({
    queryKey: ["expo", branchId],
    refetchInterval: pollUnlessRoleDenied(interval),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/kds/expo/orders");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Expo failed");
      return result.data as ExpoOrder[];
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

  if (orders.isLoading) return <LoadingState label="Loading expo" />;
  if (orders.isError) return <QueryErrorState error={orders.error} screen="Expo" onRetry={() => void orders.refetch()} />;

  const cards = (orders.data ?? []).filter((order) => displayNumber(order) || (order.ticket_items ?? []).length > 0);

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
      {cards.length === 0 ? <EmptyState title="No orders waiting" body="Orders show up here as the kitchen starts on them." /> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((order) => {
          const number = displayNumber(order);
          const items = (order.ticket_items ?? []) as ExpoItem[];
          return (
            <article key={order.order_id} className="grid content-start gap-3 rounded-xl border bg-card p-3 shadow-elev-1">
              <header className="flex items-start justify-between gap-2">
                <p className="text-[length:var(--text-28)] leading-none font-semibold tabular-nums">{number ?? "No number"}</p>
                <div className="grid justify-items-end gap-1 text-xs text-muted-foreground">
                  <span>{statusLabel(order.status)}</span>
                  {order.total_ticket_items > 0 ? (
                    <span className="tabular-nums">
                      {order.ready_ticket_items}/{order.total_ticket_items} ready
                    </span>
                  ) : null}
                </div>
              </header>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items on this ticket.</p>
              ) : (
                <ul className="grid gap-2">
                  {items.map((item) => {
                    const note = itemNote(item);
                    return (
                      <li key={item.id}>
                        <button type="button" className="grid min-h-14 w-full gap-0.5 rounded-lg border px-3 py-2 text-start" onClick={() => ticketBump.mutate(item.id)}>
                          <span className="text-base">
                            <span className="font-semibold tabular-nums">{item.quantity} ×</span>{" "}
                            <LocaleText value={item.item_name ?? item.station} />
                          </span>
                          {note ? <span className="text-sm text-muted-foreground">Note: {note}</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <label className="grid gap-1 text-sm">
                Expo notes
                <textarea
                  className="min-h-20 rounded-lg border px-3 py-2"
                  value={notes[order.order_id] ?? order.expo_notes ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [order.order_id]: event.target.value }))}
                />
              </label>
              <button type="button" className="min-h-11 rounded-lg border text-sm" onClick={() => saveNotes.mutate(order.order_id)}>
                Save notes
              </button>
              <button type="button" className="min-h-14 rounded-lg bg-primary text-sm font-medium text-primary-foreground" onClick={() => bump.mutate(order.order_id)}>
                Mark ready
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
