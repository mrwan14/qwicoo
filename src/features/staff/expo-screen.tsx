"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { toneSurface } from "@/components/ops/status-chip";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { pollUnlessRoleDenied, usePollingInterval } from "@/hooks/use-page-visible";
import { pickLocale } from "@/lib/i18n/locale-text";
import type { components } from "@/lib/api/schema";
import { useScope } from "@/stores/scope";

/** `display_number` and `items` come from the API but aren't in the generated schema yet. */
type ExpoModifier = { name?: unknown; group_name?: unknown };
type ExpoLineItem = { name: string; quantity: number; modifiers?: ExpoModifier[] | null; notes?: string | null };
type ExpoOrder = components["schemas"]["KDSExpoOrderResponse"] & {
  display_number?: string | null;
  items?: ExpoLineItem[] | null;
};

type CardLine = {
  key: string;
  name: string;
  quantity: number;
  modifiers: string[];
  note: string | null;
  /** Only kitchen ticket lines can be bumped one by one. */
  ticketItemId?: string;
};

function displayNumber(order: ExpoOrder): string | null {
  if (order.pickup_number != null) return `#${order.pickup_number}`;
  const table = order.display_number?.trim();
  return table ? `Table ${table}` : null;
}

function modifierNames(modifiers: ExpoModifier[] | null | undefined): string[] {
  return (modifiers ?? [])
    .map((modifier) => (typeof modifier.name === "string" ? modifier.name : pickLocale(modifier.name, "en")).trim())
    .filter(Boolean);
}

function cardLines(order: ExpoOrder): CardLine[] {
  const items = order.items ?? [];
  if (items.length > 0) {
    return items.map((item, index) => ({
      key: `item-${index}`,
      name: item.name,
      quantity: item.quantity,
      modifiers: modifierNames(item.modifiers),
      note: item.notes?.trim() || null,
    }));
  }
  return (order.ticket_items ?? []).map((item) => ({
    key: item.id,
    name: pickLocale(item.item_name, "en") || item.station,
    quantity: item.quantity,
    modifiers: [],
    note: null,
    ticketItemId: item.id,
  }));
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
  const queryKey = ["expo", branchId];
  const orders = useQuery({
    queryKey,
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

  const handOver = useMutation({
    mutationFn: async (orderId: string) => {
      const result = await browserApi.POST("/api/v1/orders/{order_id}/transition", {
        params: { path: { order_id: orderId } },
        body: { target_status: "DELIVERED" },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Couldn't mark it handed over");
      return orderId;
    },
    onSuccess: (orderId) => {
      queryClient.setQueryData<ExpoOrder[]>(queryKey, (current) => current?.filter((order) => order.order_id !== orderId));
      toast.success("Handed over");
      void queryClient.invalidateQueries({ queryKey: ["expo"] });
    },
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

  const cards = (orders.data ?? [])
    .map((order) => ({ order, number: displayNumber(order), lines: cardLines(order) }))
    .filter((card) => card.number || card.lines.length > 0);

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
        {cards.map(({ order, number, lines }) => {
          const ready = order.status === "READY";
          const handingOver = handOver.isPending && handOver.variables === order.order_id;
          const bumping = bump.isPending && bump.variables === order.order_id;
          return (
            <article
              key={order.order_id}
              className={`grid content-start gap-3 rounded-xl border bg-card p-3 shadow-elev-1 ${ready ? "border-[var(--status-ready)]" : ""}`}
            >
              <header className="flex items-start justify-between gap-2">
                <p className="text-[length:var(--text-28)] leading-none font-semibold tabular-nums">{number ?? "No number"}</p>
                <div className="grid justify-items-end gap-1 text-xs text-muted-foreground">
                  <span className={ready ? "font-medium text-[var(--status-ready)]" : undefined}>{statusLabel(order.status)}</span>
                  {order.total_ticket_items > 0 ? (
                    <span className="tabular-nums">
                      {order.ready_ticket_items}/{order.total_ticket_items} ready
                    </span>
                  ) : null}
                </div>
              </header>
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items</p>
              ) : (
                <ul className="grid gap-2">
                  {lines.map((line) => {
                    const body = (
                      <>
                        <span className="text-base">
                          <span className="font-semibold tabular-nums">{line.quantity} ×</span> {line.name}
                        </span>
                        {line.modifiers.length > 0 ? (
                          <span className="text-sm text-muted-foreground">+ {line.modifiers.join(", ")}</span>
                        ) : null}
                        {line.note ? (
                          <span className={`mt-1 rounded-md px-2 py-1 text-sm font-medium ${toneSurface("ordered")}`}>Note: {line.note}</span>
                        ) : null}
                      </>
                    );
                    return (
                      <li key={line.key}>
                        {line.ticketItemId ? (
                          <button
                            type="button"
                            className="grid min-h-14 w-full gap-0.5 rounded-lg border px-3 py-2 text-start"
                            onClick={() => line.ticketItemId && ticketBump.mutate(line.ticketItemId)}
                          >
                            {body}
                          </button>
                        ) : (
                          <div className="grid gap-0.5 rounded-lg border px-3 py-2">{body}</div>
                        )}
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
              {ready ? (
                <button
                  type="button"
                  className="min-h-14 rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
                  disabled={handingOver}
                  onClick={() => handOver.mutate(order.order_id)}
                >
                  {handingOver ? "Handing over…" : "Handed over"}
                </button>
              ) : (
                <button
                  type="button"
                  className="min-h-14 rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
                  disabled={bumping}
                  onClick={() => bump.mutate(order.order_id)}
                >
                  Mark ready
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
