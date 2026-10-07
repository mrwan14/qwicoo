"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { StatusChip } from "@/components/ops/status-chip";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useScope } from "@/stores/scope";

import { reasonLabel } from "./review-reasons";

type ReviewOrder = components["schemas"]["OfflineReviewOrder"];
type ReviewState = "pending" | "reviewed" | "all";

const STATE_LABEL: Record<ReviewState, string> = { pending: "Needs review", reviewed: "Reviewed", all: "All offline orders" };

function when(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function realNumber(order: ReviewOrder): string {
  if (order.pickup_number != null) return `#${order.pickup_number}`;
  if (order.table_number) return `Table ${order.table_number}`;
  return order.order_type === "DINE_IN" ? "Dine in" : "Takeaway";
}

export function OfflineReviewScreen() {
  const branchId = useScope((state) => state.branchId);
  const [state, setState] = useState<ReviewState>("pending");
  const list = useQuery({
    queryKey: ["offline-review", branchId, state],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/pos/offline/review", { params: { query: { state, limit: 100 } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Offline orders failed");
      return result.data;
    },
  });

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-[length:var(--text-28)] font-semibold">Offline orders</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Sales a till took while it was offline. Every sale is kept at the price the guest paid; anything unusual is flagged here so you can approve it or correct the prices.
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Offline orders">
        {(Object.keys(STATE_LABEL) as ReviewState[]).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={state === item}
            className={`min-h-11 shrink-0 rounded-full border px-3 text-sm ${state === item ? "border-primary/40 bg-secondary font-medium" : ""}`}
            onClick={() => setState(item)}
          >
            {STATE_LABEL[item]}
            {item === "pending" && list.data && state === "pending" ? ` · ${list.data.pending}` : ""}
          </button>
        ))}
      </div>
      {list.isLoading ? <LoadingState label="Loading offline orders" /> : null}
      {list.isError ? <QueryErrorState error={list.error} screen="Offline orders" onRetry={() => void list.refetch()} /> : null}
      {list.data && list.data.orders.length === 0 ? (
        <EmptyState title={state === "pending" ? "Nothing to review" : "No offline orders yet"} body={state === "pending" ? "Offline sales that need a look will appear here after the till syncs." : "Orders a till takes offline appear here once they sync."} />
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {(list.data?.orders ?? []).map((order) => (
          <ReviewCard key={order.order_id} order={order} />
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ order }: { order: ReviewOrder }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"view" | "approve" | "adjust">("view");
  const [note, setNote] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(order.items.map((line) => [line.order_item_id, String(line.unit_price)])));
  const pending = order.needs_review && !order.reviewed_at;

  const done = (message: string) => {
    toast.success(message);
    setMode("view");
    setNote("");
    void queryClient.invalidateQueries({ queryKey: ["offline-review"] });
  };

  const approve = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/pos/offline/review/{order_id}/approve", {
        params: { path: { order_id: order.order_id } },
        body: { note: note.trim() || null },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Approve failed");
    },
    onSuccess: () => done(`${order.offline_number ?? "Order"} approved`),
    onError: (error: Error) => toast.error(error.message),
  });

  const adjust = useMutation({
    mutationFn: async () => {
      const lines = order.items
        .filter((line) => prices[line.order_item_id] !== undefined && prices[line.order_item_id] !== String(line.unit_price))
        .map((line) => ({ order_item_id: line.order_item_id, unit_price: prices[line.order_item_id] }));
      const result = await browserApi.POST("/api/v1/pos/offline/review/{order_id}/adjust", {
        params: { path: { order_id: order.order_id } },
        body: { note: note.trim(), lines },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Adjust failed");
    },
    onSuccess: () => done(`${order.offline_number ?? "Order"} adjusted`),
    onError: (error: Error) => toast.error(error.message),
  });

  const priceInvalid = Object.values(prices).some((value) => !/^\d{1,8}(\.\d{1,2})?$/.test(value.trim()));

  return (
    <article className="grid gap-3 rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <span className="text-lg font-semibold tabular-nums">
            {realNumber(order)} <span className="text-sm font-normal text-muted-foreground">was {order.offline_number ?? "offline"}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            Sold {when(order.offline_created_at)} · synced {when(order.offline_synced_at)}
          </span>
        </div>
        <StatusChip tone={pending ? "ordered" : order.reviewed_at ? "available" : "neutral"}>{pending ? "Needs review" : order.reviewed_at ? "Reviewed" : "No flags"}</StatusChip>
      </div>
      {order.review_reasons.length ? (
        <ul className="grid gap-1 rounded-xl bg-secondary px-3 py-2 text-sm">
          {order.review_reasons.map((reason, index) => (
            <li key={index}>• {reasonLabel(reason)}</li>
          ))}
        </ul>
      ) : null}
      <ul className="grid gap-1.5 text-sm">
        {order.items.map((line) => (
          <li key={line.order_item_id} className="flex items-center justify-between gap-2">
            <span>{line.quantity} × {line.name}</span>
            {mode === "adjust" ? (
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                Unit price
                <input
                  className="h-10 w-24 rounded-lg border bg-background px-2 text-end text-sm tabular-nums text-foreground"
                  inputMode="decimal"
                  value={prices[line.order_item_id] ?? ""}
                  onChange={(event) => setPrices((current) => ({ ...current, [line.order_item_id]: event.target.value }))}
                />
              </label>
            ) : (
              <Money amount={String(line.subtotal)} />
            )}
          </li>
        ))}
      </ul>
      <p className="flex justify-between border-t pt-2 text-sm font-semibold">
        <span>
          Total · {order.is_paid ? `paid ${order.paid_amount} in cash` : order.status === "CANCELLED" ? "cancelled" : "not paid"}
        </span>
        <Money amount={String(order.total_amount)} />
      </p>
      <p className="text-xs text-muted-foreground">Till {order.offline_device_id ?? "unknown"} · status {order.status.toLowerCase()}</p>
      {order.reviewed_at ? <p className="text-sm text-muted-foreground">Reviewed {when(order.reviewed_at)}{order.review_note ? ` · “${order.review_note}”` : ""}</p> : null}

      {pending && mode === "view" ? (
        <div className="flex gap-2">
          <button type="button" className="min-h-11 flex-1 rounded-lg bg-primary text-sm font-medium text-primary-foreground" onClick={() => setMode("approve")}>
            Approve
          </button>
          <button type="button" className="min-h-11 flex-1 rounded-lg border text-sm" onClick={() => setMode("adjust")}>
            Adjust prices
          </button>
        </div>
      ) : null}
      {pending && mode !== "view" ? (
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (mode === "approve") approve.mutate();
            else adjust.mutate();
          }}
        >
          <label className="grid gap-1 text-sm">
            {mode === "approve" ? "Note (optional)" : "Why are you changing the prices?"}
            <span className="text-sm leading-6 text-muted-foreground">
              {mode === "approve" ? "Keeps the sale as it is. The note goes in the audit log." : "Totals are worked out again with the branch's tax and service rates. The change goes in the audit log."}
            </span>
            <input className="h-11 rounded-lg border bg-background px-3" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
          </label>
          {mode === "adjust" && priceInvalid ? <p className="text-sm text-destructive">Enter prices like 30 or 30.50.</p> : null}
          <div className="flex gap-2">
            <button
              type="submit"
              className="min-h-11 flex-1 rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
              disabled={approve.isPending || adjust.isPending || (mode === "adjust" && (note.trim().length < 3 || priceInvalid))}
            >
              {mode === "approve" ? "Approve sale" : "Save prices"}
            </button>
            <button type="button" className="min-h-11 flex-1 rounded-lg border text-sm" onClick={() => setMode("view")}>
              Back
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}
