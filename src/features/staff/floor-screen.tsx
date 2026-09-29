"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ops/page-header";
import { useStaffSession } from "@/components/ops/staff-session";
import { occupancyTone, StatusChip, toneSurface } from "@/components/ops/status-chip";
import { EmptyState, ErrorState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  CONFIRM_ROLES,
  fetchFloorLive,
  floorLiveQueryKey,
  needsConfirmation,
  type FloorOrderItem,
  type FloorTable,
} from "@/hooks/use-floor-live";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { pollUnlessRoleDenied, usePollingInterval } from "@/hooks/use-page-visible";
import type { components } from "@/lib/api/schema";
import { useScope } from "@/stores/scope";

type OrderStatus = components["schemas"]["OrderStatus"];

const NEXT: OrderStatus[] = ["PREPARING", "READY", "SERVED", "DELIVERED", "CLOSED"];

function humanize(value: string): string {
  const text = value.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function itemModifiers(item: FloorOrderItem): string[] {
  return (item.modifiers ?? [])
    .map((modifier) => (typeof modifier === "string" ? modifier : (modifier.name ?? "")))
    .filter(Boolean);
}

function NeedsConfirmationBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-background">
      Needs confirmation
    </span>
  );
}

export function FloorScreen() {
  const interval = usePollingInterval(7000);
  const branchId = useScope((state) => state.branchId);
  const me = useStaffSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<OrderStatus>("PREPARING");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();
  const floor = useQuery({
    queryKey: floorLiveQueryKey(branchId),
    queryFn: () => fetchFloorLive(branchId),
    refetchInterval: pollUnlessRoleDenied(interval),
    retry: false,
  });

  const selected = floor.data?.tables.find((table) => table.table_id === selectedId) ?? null;
  const canConfirm = Boolean(me && CONFIRM_ROLES.has(me.role));

  function closeDrawer() {
    setSelectedId(null);
    setRejecting(false);
    setReason("");
  }

  const transition = useMutation({
    mutationFn: async ({ orderId, target, note }: { orderId: string; target: OrderStatus; note?: string }) => {
      const result = await browserApi.POST("/api/v1/orders/{order_id}/transition", {
        params: { path: { order_id: orderId } },
        body: { target_status: target, reason: note ?? null },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not update the order");
    },
    onSuccess: (_data, { target }) => {
      toast.success(target === "SUBMITTED" ? "Order confirmed" : target === "CANCELLED" ? "Order rejected" : "Order updated");
      if (target === "SUBMITTED" || target === "CANCELLED") closeDrawer();
      void queryClient.invalidateQueries({ queryKey: ["floor-live"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (floor.isLoading) return <LoadingState label="Loading floor" />;
  if (floor.isError) {
    return <QueryErrorState error={floor.error} screen="Floor" title="Floor unavailable" onRetry={() => void floor.refetch()} />;
  }

  const data = floor.data;
  if (!data) return <ErrorState title="Floor unavailable" body="Floor data is unavailable right now." onRetry={() => void floor.refetch()} />;

  const pendingCount = data.tables.filter(needsConfirmation).length;
  const tables = [...data.tables].sort((a, b) => Number(needsConfirmation(b)) - Number(needsConfirmation(a)));

  return (
    <div className="grid gap-4">
      <PageHeader title="Floor" />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {pendingCount > 0 ? (
          <span className="rounded-full bg-foreground px-3 py-1 font-semibold text-background">
            {pendingCount} to confirm
          </span>
        ) : null}
        <span className="rounded-full bg-card px-3 py-1 shadow-elev-1">{data.occupied_tables} occupied</span>
        <span className="rounded-full bg-card px-3 py-1 shadow-elev-1">{data.available_tables} available</span>
        <span className="rounded-full bg-card px-3 py-1 shadow-elev-1">{data.tables_with_pending_requests} requests</span>
        <StatusChip tone="available">Available</StatusChip>
        <StatusChip tone="browsing">Seated</StatusChip>
        <StatusChip tone="ordered">Ordered</StatusChip>
        <StatusChip tone="ready">Served</StatusChip>
      </div>
      {tables.length === 0 ? (
        <EmptyState title="No tables on the floor" body="Add tables and QR codes for this branch, then refresh." />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
          {tables.map((table) => {
            const tone = occupancyTone(table.current_state);
            const pending = needsConfirmation(table);
            return (
              <button
                key={table.table_id}
                type="button"
                className={`min-h-32 rounded-2xl p-4 text-start shadow-elev-1 ${toneSurface(tone)} ${pending ? "ring-2 ring-foreground" : ""}`}
                onClick={() => setSelectedId(table.table_id)}
              >
                <span className="block text-2xl font-semibold">{table.table_number}</span>
                <span className="mt-2 block text-sm">{humanize(table.current_state)}</span>
                {pending ? (
                  <span className="mt-2 block">
                    <NeedsConfirmationBadge />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && closeDrawer()}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Table {selected?.display_number ?? selected?.table_number}</SheetTitle>
          </SheetHeader>
          {selected ? (
            <div className="grid gap-3 px-4 pb-6">
              <p className="text-sm">{humanize(selected.current_state)}</p>
              {needsConfirmation(selected) && selected.active_order_id ? (
                <PendingOrder
                  table={selected}
                  canConfirm={canConfirm}
                  pending={transition.isPending}
                  rejecting={rejecting}
                  reason={reason}
                  onReason={setReason}
                  onStartReject={() => setRejecting(true)}
                  onCancelReject={() => {
                    setRejecting(false);
                    setReason("");
                  }}
                  onConfirm={(orderId) => transition.mutate({ orderId, target: "SUBMITTED" })}
                  onReject={(orderId) => transition.mutate({ orderId, target: "CANCELLED", note: reason.trim() })}
                />
              ) : (
                <>
                  <p className="text-sm">Order: {selected.order_status ? humanize(selected.order_status) : "none"}</p>
                  {selected.active_order_id ? (
                    <>
                      <select className="h-12 rounded-lg border px-3" value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)}>
                        {NEXT.map((value) => (
                          <option key={value} value={value}>
                            {humanize(value)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="min-h-12 rounded-lg bg-primary text-sm text-primary-foreground disabled:opacity-50"
                        disabled={transition.isPending}
                        onClick={() => selected.active_order_id && transition.mutate({ orderId: selected.active_order_id, target: status })}
                      >
                        Update order
                      </button>
                    </>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PendingOrder({
  table,
  canConfirm,
  pending,
  rejecting,
  reason,
  onReason,
  onStartReject,
  onCancelReject,
  onConfirm,
  onReject,
}: {
  table: FloorTable;
  canConfirm: boolean;
  pending: boolean;
  rejecting: boolean;
  reason: string;
  onReason: (value: string) => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onConfirm: (orderId: string) => void;
  onReject: (orderId: string) => void;
}) {
  const orderId = table.active_order_id ?? "";
  const items = table.items ?? [];
  return (
    <div className="grid gap-3">
      <div>
        <NeedsConfirmationBadge />
        <p className="mt-2 text-sm text-muted-foreground">
          A guest ordered without a confirmed location. Check the table, then confirm to send it to the kitchen.
        </p>
      </div>
      {items.length > 0 ? (
        <ul className="grid gap-2">
          {items.map((item, index) => {
            const modifiers = itemModifiers(item);
            const note = (item.notes ?? item.special_instructions)?.trim();
            return (
              <li key={`${item.name ?? item.item_name}-${index}`} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {item.quantity} × {item.name ?? item.item_name}
                </p>
                {modifiers.length > 0 ? <p className="text-muted-foreground">+ {modifiers.join(", ")}</p> : null}
                {note ? (
                  <p className={`mt-1 rounded-md px-2 py-1 ${toneSurface("ordered")}`}>
                    <span className="font-medium">Note:</span> {note}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Item details aren&apos;t available for this order yet.</p>
      )}
      {table.customer_notes?.trim() ? (
        <p className={`rounded-md px-2 py-1 text-sm ${toneSurface("ordered")}`}>
          <span className="font-medium">Order note:</span> {table.customer_notes}
        </p>
      ) : null}
      {table.order_total ? <p className="text-sm font-medium">Total {table.order_total}</p> : null}
      {canConfirm ? (
        rejecting ? (
          <div className="grid gap-2">
            <label className="grid gap-1 text-sm font-medium">
              Reason for rejecting
              <textarea
                className="min-h-20 rounded-lg border px-3 py-2"
                value={reason}
                onChange={(event) => onReason(event.target.value)}
                placeholder="e.g. Guest isn't at this table"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="min-h-12 rounded-lg bg-destructive text-sm font-medium text-white disabled:opacity-50"
                disabled={pending || !reason.trim()}
                onClick={() => onReject(orderId)}
              >
                {pending ? "Rejecting…" : "Reject order"}
              </button>
              <button type="button" className="min-h-12 rounded-lg border text-sm" disabled={pending} onClick={onCancelReject}>
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="min-h-12 rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
              disabled={pending}
              onClick={() => onConfirm(orderId)}
            >
              {pending ? "Confirming…" : "Confirm order"}
            </button>
            <button type="button" className="min-h-12 rounded-lg border text-sm font-medium" disabled={pending} onClick={onStartReject}>
              Reject
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}
