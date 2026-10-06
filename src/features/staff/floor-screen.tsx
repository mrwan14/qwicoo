"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { PageHeader } from "@/components/ops/page-header";
import { useStaffSession } from "@/components/ops/staff-session";
import { occupancyTone, StatusChip, toneSurface } from "@/components/ops/status-chip";
import { EmptyState, ErrorState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { pollUnlessRoleDenied, usePollingInterval } from "@/hooks/use-page-visible";
import {
  CONFIRM_ROLES,
  fetchFloorLive,
  floorLiveQueryKey,
  needsConfirmation,
  type FloorTable,
} from "@/hooks/use-floor-live";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { getStaffOrder } from "@/lib/api/staff-order";
import { occupancyLabel, orderStatusLabel } from "@/lib/status-labels";
import type { components } from "@/lib/api/schema";
import { useScope } from "@/stores/scope";

type OrderStatus = components["schemas"]["OrderStatus"];

const NEXT: OrderStatus[] = ["PREPARING", "READY", "SERVED", "DELIVERED", "CLOSED"];
const hint = "text-sm leading-6 text-muted-foreground";
const control = "h-12 w-full rounded-xl border bg-background px-3 text-sm";

function seatedFor(minutes: number): string {
  if (minutes <= 0) return "";
  return minutes === 1 ? "Seated for 1 minute" : `Seated for ${minutes} minutes`;
}

function modifierNames(modifiers: { [key: string]: unknown }[] | null | undefined): string[] {
  return (modifiers ?? [])
    .map((modifier) => {
      const name = modifier.name ?? modifier.option_name;
      return typeof name === "string" ? name : "";
    })
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
      <p className={`max-w-2xl ${hint}`}>Each block is a table. The colour shows where it is in service. Open a table to move its order on.</p>
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
        <StatusChip tone="ordered">Waiting for food</StatusChip>
        <StatusChip tone="ready">Food served</StatusChip>
      </div>
      {tables.length === 0 ? (
        <EmptyState title="No tables on the floor" body="Add tables and QR codes for this branch, then refresh." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {tables.map((table) => {
            const tone = occupancyTone(table.current_state);
            const pending = needsConfirmation(table);
            const open = table.table_id === selectedId;
            const seated = seatedFor(table.occupancy_duration_minutes);
            return (
              <button
                key={table.table_id}
                type="button"
                aria-pressed={open}
                className={`grid min-h-36 content-between rounded-2xl p-4 text-start shadow-elev-1 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${toneSurface(tone)} ${pending || open ? "ring-2 ring-foreground" : ""}`}
                onClick={() => {
                  setSelectedId(table.table_id);
                  setRejecting(false);
                  setReason("");
                  const current = table.order_status;
                  setStatus(current && NEXT.includes(current) ? current : "PREPARING");
                }}
              >
                <span className="block text-2xl font-semibold">Table {table.table_number}</span>
                <span className="mt-3 grid gap-1">
                  <span className="block text-sm font-medium">{pending ? "Needs confirmation" : occupancyLabel(table.current_state)}</span>
                  {table.order_status && !pending ? <span className="block text-sm">Order {orderStatusLabel(table.order_status)}</span> : null}
                  <span className="block text-xs">
                    {table.capacity} {table.capacity === 1 ? "seat" : "seats"}
                    {seated ? ` · ${seated}` : ""}
                    {table.pending_service_requests_count > 0 ? ` · ${table.pending_service_requests_count} requests` : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && closeDrawer()}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>Table {selected?.display_number ?? selected?.table_number}</SheetTitle>
            <SheetDescription>
              {selected && needsConfirmation(selected)
                ? "A guest order is waiting. Check the table, then confirm it for the kitchen."
                : "The colour matches the floor. Move the open order on when the table is ready for the next step."}
            </SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="grid gap-4 px-4 pb-8">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone={occupancyTone(selected.current_state)}>
                  {needsConfirmation(selected) ? "Needs confirmation" : occupancyLabel(selected.current_state)}
                </StatusChip>
                <span className="text-sm text-muted-foreground">
                  {selected.capacity} {selected.capacity === 1 ? "seat" : "seats"}
                  {seatedFor(selected.occupancy_duration_minutes) ? ` · ${seatedFor(selected.occupancy_duration_minutes)}` : ""}
                </span>
              </div>
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
              ) : selected.active_order_id ? (
                <form
                  className="grid gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (selected.active_order_id) transition.mutate({ orderId: selected.active_order_id, target: status });
                  }}
                >
                  <p className="text-sm">The order is <span className="font-medium">{orderStatusLabel(selected.order_status)}</span>.</p>
                  {selected.order_total ? (
                    <p className="text-sm">Total <Money amount={String(selected.order_total)} /></p>
                  ) : null}
                  <label className="grid gap-1 text-sm">
                    Move the order to
                    <span className={hint}>Choose the next step, then update. The kitchen and the floor both follow this.</span>
                    <select className={control} value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)}>
                      {NEXT.map((value) => (
                        <option key={value} value={value}>{orderStatusLabel(value)}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="min-h-12 rounded-xl bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                    disabled={transition.isPending || status === selected.order_status}
                  >
                    {transition.isPending ? "Updating…" : "Update order"}
                  </button>
                </form>
              ) : (
                <p className={hint}>No open order on this table. Guests can still sit here and order from the table QR.</p>
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
  const detail = useQuery({
    queryKey: ["staff-order", orderId],
    enabled: Boolean(orderId),
    queryFn: () => getStaffOrder(orderId),
  });
  const items = detail.data?.items ?? [];
  const customerNotes = detail.data?.customer_notes ?? table.customer_notes;
  const total = detail.data?.total_amount ?? table.order_total;

  return (
    <div className="grid gap-3">
      <div>
        <NeedsConfirmationBadge />
        <p className="mt-2 text-sm text-muted-foreground">
          A guest ordered without a confirmed location. Check the table, then confirm to send it to the kitchen.
        </p>
      </div>
      {detail.isLoading ? (
        <LoadingState label="Loading order" />
      ) : detail.isError ? (
        <p className="text-sm text-muted-foreground">
          {detail.error instanceof Error ? detail.error.message : "Couldn't load this order."}{" "}
          <button type="button" className="underline" onClick={() => void detail.refetch()}>
            Try again
          </button>
        </p>
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => {
            const modifiers = modifierNames(item.selected_modifiers);
            const note = item.special_instructions?.trim();
            return (
              <li key={item.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {item.quantity} × {item.item_name}
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
      )}
      {customerNotes?.trim() ? (
        <p className={`rounded-md px-2 py-1 text-sm ${toneSurface("ordered")}`}>
          <span className="font-medium">Order note:</span> {customerNotes}
        </p>
      ) : null}
      {total ? (
        <p className="text-sm font-medium">
          Total <Money amount={String(total)} />
        </p>
      ) : null}
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
