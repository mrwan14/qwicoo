"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ignoreOwnChange } from "@/features/staff/alerts/ignore";

import { StatusChip, toneSurface } from "@/components/ops/status-chip";
import { useStaffSession } from "@/components/ops/staff-session";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { formatMoney } from "@/lib/format/money";
import { pollUnlessRoleDenied, usePollingInterval } from "@/hooks/use-page-visible";
import { pickLocale } from "@/lib/i18n/locale-text";
import type { components } from "@/lib/api/schema";
import { useScope } from "@/stores/scope";

type ExpoOrder = components["schemas"]["KDSExpoOrderResponse"];

type CardLine = {
  key: string;
  name: string;
  quantity: number;
  modifiers: string[];
  note: string | null;
  /** Only kitchen ticket lines can be bumped one by one. */
  ticketItemId?: string;
};

function paymentDueBeforeHandover(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const root = error as { code?: unknown; detail?: unknown };
  const detail =
    root.detail && typeof root.detail === "object"
      ? (root.detail as { code?: unknown; amount_due?: unknown; currency?: unknown })
      : null;
  if (root.code !== "PAYMENT_REQUIRED_BEFORE_HANDOVER" && detail?.code !== "PAYMENT_REQUIRED_BEFORE_HANDOVER") return null;
  if (typeof detail?.amount_due !== "string" || !detail.amount_due) return "";
  const currency = typeof detail.currency === "string" && detail.currency ? detail.currency : "EGP";
  return formatMoney(detail.amount_due, currency);
}

function displayNumber(order: ExpoOrder): string | null {
  if (order.pickup_number != null) return `#${order.pickup_number}`;
  const table = order.display_number?.trim();
  return table ? `Table ${table}` : null;
}

function modifierNames(modifiers: { [key: string]: unknown }[] | null | undefined): string[] {
  return (modifiers ?? [])
    .map((modifier) => {
      const name = modifier.name;
      return (typeof name === "string" ? name : pickLocale(name, "en")).trim();
    })
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

export function ExpoScreen() {
  const me = useStaffSession();
  const isRunner = me?.role === "RUNNER";
  const interval = usePollingInterval(7000);
  const branchId = useScope((state) => state.branchId);
  const [token, setToken] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteEditor, setNoteEditor] = useState<string | null>(null);
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
    onSuccess: (_data, orderId) => {
      ignoreOwnChange(orderId, "READY");
      void queryClient.invalidateQueries({ queryKey: ["expo"] });
    },
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
      ignoreOwnChange(orderId, "DELIVERED");
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
    onSuccess: (_data, orderId) => {
      toast.success("Note saved");
      setNoteEditor((current) => (current === orderId ? null : current));
    },
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
      if (!result.response.ok) {
        const due = paymentDueBeforeHandover(result.error);
        if (due != null) {
          throw new Error(
            due ? `Take ${due} first on the Payments screen, then scan again.` : "Take payment first, then scan again.",
          );
        }
        throw asApiError(result.error, result.response, "Handover failed");
      }
    },
    onSuccess: () => toast.success("Handover verified"),
    onError: (error: Error) => toast.error(error.message),
  });

  if (orders.isLoading) return <LoadingState label="Loading handover" />;
  if (orders.isError) return <QueryErrorState error={orders.error} screen="Handover" onRetry={() => void orders.refetch()} />;

  const cards = (orders.data ?? [])
    .map((order) => ({ order, number: displayNumber(order), lines: cardLines(order) }))
    .filter((card) => card.number || card.lines.length > 0);

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-[length:var(--text-28)] font-semibold">Handover</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Give the finished order to the guest. The kitchen cooks it first.</p>
      </div>
      <form
        className="grid gap-2 rounded-2xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (token.trim()) verify.mutate();
        }}
      >
        <label className="grid gap-1 text-sm sm:col-span-2">
          Guest code
          <span className="text-sm leading-6 text-muted-foreground">Only a drive-thru or curbside guest has this code on their phone. A table or a normal takeaway does not. Type it to confirm the order is theirs.</span>
        </label>
        <input className="h-12 rounded-xl border bg-background px-3" value={token} onChange={(event) => setToken(event.target.value)} />
        <button className="min-h-12 rounded-xl border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50" type="submit" disabled={!token.trim() || verify.isPending}>
          {verify.isPending ? "Checking…" : "Check code"}
        </button>
      </form>
      {cards.length === 0 ? <EmptyState title="Nothing to hand over" body="Orders appear here while the kitchen is making them." /> : (
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <caption className="px-4 py-3 text-start text-sm text-muted-foreground">Press Guest has the food after you give the order to the guest.</caption>
          <thead>
            <tr className="border-b text-muted-foreground">
              <th scope="col" className="px-4 py-3 text-start font-medium">Order</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">Dishes</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">Status</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">Note</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
        {cards.map(({ order, number, lines }) => {
          const ready = order.status === "READY";
          const handingOver = handOver.isPending && handOver.variables === order.order_id;
          const bumping = bump.isPending && bump.variables === order.order_id;
          const savingNote = saveNotes.isPending && saveNotes.variables === order.order_id;
          const editingNote = noteEditor === order.order_id;
          const savedNote = order.expo_notes?.trim() ?? "";
          const draftNote = (notes[order.order_id] ?? order.expo_notes ?? "").trim();
          const noteChanged = draftNote !== savedNote;
          const dishesLeft = order.total_ticket_items > 0 && order.ready_ticket_items < order.total_ticket_items;
          return (
            <tr key={order.order_id} className="border-b align-top last:border-b-0">
              <th scope="row" className="px-4 py-4 text-start text-base font-semibold tabular-nums">{number ?? "No number"}</th>
              <td className="px-4 py-4">
              {order.customer_notes?.trim() ? (
                <p className={`mb-2 rounded-md px-2 py-1 text-sm font-medium ${toneSurface("ordered")}`}>
                  Order note: {order.customer_notes}
                </p>
              ) : null}
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
                            className="grid min-h-14 w-full gap-0.5 rounded-xl border px-3 py-2 text-start focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                            disabled={ticketBump.isPending && ticketBump.variables === line.ticketItemId}
                            onClick={() => line.ticketItemId && ticketBump.mutate(line.ticketItemId)}
                          >
                            {body}
                            <span className="text-sm text-muted-foreground">
                              {ticketBump.isPending && ticketBump.variables === line.ticketItemId ? "Marking…" : "Tap when this dish is ready"}
                            </span>
                          </button>
                        ) : (
                          <div className="grid gap-0.5 rounded-lg border px-3 py-2">{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              </td>
              <td className="px-4 py-4">
                <StatusChip tone={ready ? "ready" : "ordered"}>{ready ? "Ready to hand over" : "Still in the kitchen"}</StatusChip>
                {dishesLeft ? (
                  <p className="mt-2 text-sm text-muted-foreground">{order.ready_ticket_items} of {order.total_ticket_items} dishes ready</p>
                ) : null}
              </td>
              <td className="px-4 py-4">
              {editingNote ? (
                <label className="grid gap-1 text-sm">
                  Note for the handover
                  <textarea
                    className="min-h-20 rounded-xl border bg-background px-3 py-2"
                    value={notes[order.order_id] ?? order.expo_notes ?? ""}
                    onChange={(event) => setNotes((current) => ({ ...current, [order.order_id]: event.target.value }))}
                  />
                  <span className="flex gap-2">
                    {noteChanged ? (
                      <button type="button" className="min-h-11 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={savingNote} onClick={() => saveNotes.mutate(order.order_id)}>
                        {savingNote ? "Saving…" : "Save note"}
                      </button>
                    ) : null}
                    <button type="button" className="min-h-11 rounded-xl px-3 text-sm text-muted-foreground" onClick={() => setNoteEditor(null)}>
                      Cancel
                    </button>
                  </span>
                </label>
              ) : (
                <div className="grid gap-1">
                  {savedNote ? <p className="text-sm">{savedNote}</p> : null}
                  <button
                    type="button"
                    className="min-h-11 justify-self-start text-sm text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => {
                      setNotes((current) => ({ ...current, [order.order_id]: current[order.order_id] ?? order.expo_notes ?? "" }));
                      setNoteEditor(order.order_id);
                    }}
                  >
                    {savedNote ? "Change note" : "Add a note"}
                  </button>
                </div>
              )}
              </td>
              <td className="px-4 py-4">
              {ready ? (
                isRunner ? (
                  <p className="text-sm text-muted-foreground">A colleague marks this once the guest has the food.</p>
                ) : (
                  <button
                    type="button"
                    className="min-h-11 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                    disabled={handingOver}
                    onClick={() => handOver.mutate(order.order_id)}
                  >
                    {handingOver ? "Handing over…" : "Guest has the food"}
                  </button>
                )
              ) : (
                <button
                  type="button"
                  className="min-h-11 rounded-xl border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                  disabled={bumping}
                  onClick={() => bump.mutate(order.order_id)}
                >
                  {bumping ? "Marking…" : "Mark ready to hand over"}
                </button>
              )}
              </td>
            </tr>
          );
        })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
