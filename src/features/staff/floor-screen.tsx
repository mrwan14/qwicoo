"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ignoreOwnChange } from "@/features/staff/alerts/ignore";

import { Money } from "@/components/ops/money";
import { LiveCount } from "@/components/ops/live-fact";
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
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { floorCopy } from "@/lib/i18n/staff/floor";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { occupancyLabel, orderStatusLabel } from "@/lib/status-labels";
import { floorStatusOptions, showAmountDue, type OrderStatus } from "@/features/staff/order-moves";
import { useScope } from "@/stores/scope";

const hint = "text-sm leading-6 text-muted-foreground";
const control = "h-12 w-full rounded-xl border bg-background px-3 text-sm";

function seatedFor(minutes: number, one: string, many: string): string {
  if (minutes <= 0) return "";
  return minutes === 1 ? one : fill(many, { minutes });
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
    <span className="inline-flex items-center bg-foreground px-2 py-0.5 text-xs font-semibold text-background">
      {orderStatusLabel("PENDING_STAFF_CONFIRMATION")}
    </span>
  );
}

export function FloorScreen() {
  const t = useStaffSection(floorCopy);
  const { locale } = useLocale();
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
  const orderDetail = useQuery({
    queryKey: ["staff-order", selected?.active_order_id],
    enabled: Boolean(selected?.active_order_id) && !needsConfirmation(selected ?? { order_status: null }),
    queryFn: () => getStaffOrder(selected?.active_order_id ?? ""),
  });
  const isPaid = orderDetail.data?.is_paid === true || selected?.order_status === "PAID" || selected?.order_status === "CLOSED";
  const moves = floorStatusOptions(me?.role, selected?.order_status, isPaid);
  const due = showAmountDue(selected?.order_status, isPaid);
  const amount = orderDetail.data?.total_amount ?? (selected?.order_total != null ? String(selected.order_total) : null);
  const moveTo = moves.includes(status) ? status : moves[0];

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
      if (!result.response.ok) throw asApiError(result.error, result.response, t.updateFailed, locale);
    },
    onSuccess: (_data, { orderId, target }) => {
      ignoreOwnChange(orderId, target);
      toast.success(target === "SUBMITTED" ? t.confirmed : target === "CANCELLED" ? t.rejected : t.updated);
      if (target === "SUBMITTED" || target === "CANCELLED") closeDrawer();
      void queryClient.invalidateQueries({ queryKey: ["floor-live"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (floor.isLoading) return <LoadingState label={t.loading} />;
  if (floor.isError) {
    return <QueryErrorState error={floor.error} screen={t.screen} title={t.unavailable} onRetry={() => void floor.refetch()} />;
  }

  const data = floor.data;
  if (!data) return <ErrorState title={t.unavailable} body={t.unavailableBody} onRetry={() => void floor.refetch()} />;

  const pendingCount = data.tables.filter(needsConfirmation).length;
  const tables = [...data.tables].sort((a, b) => Number(needsConfirmation(b)) - Number(needsConfirmation(a)));

  return (
    <div className="grid gap-4">
      <PageHeader
        title={t.title}
        detail={
          <>
            <LiveCount value={data.occupied_tables} /> {t.occupied}
            {pendingCount > 0 ? (
              <>
                {" · "}
                <LiveCount value={pendingCount} /> {t.toConfirm}
              </>
            ) : null}
          </>
        }
      />
      <p className={`max-w-2xl ${hint}`}>{t.hint}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusChip tone="available">{occupancyLabel("AVAILABLE")}</StatusChip>
        <StatusChip tone="browsing">{occupancyLabel("SEATED")}</StatusChip>
        <StatusChip tone="ordered">{occupancyLabel("AWAITING_FOOD")}</StatusChip>
        <StatusChip tone="ready">{occupancyLabel("FOOD_SERVED")}</StatusChip>
      </div>
      {tables.length === 0 ? (
        <EmptyState title={t.emptyTitle} body={t.emptyBody} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {tables.map((table) => {
            const tone = occupancyTone(table.current_state);
            const pending = needsConfirmation(table);
            const open = table.table_id === selectedId;
            const seated = seatedFor(table.occupancy_duration_minutes, t.seatedOne, t.seatedMany);
            const requestCount = table.pending_service_requests_count > 0 ? fill(t.requests, { count: table.pending_service_requests_count }) : "";
            return (
              <button
                key={table.table_id}
                type="button"
                aria-pressed={open}
                className={`grid min-h-36 content-between p-4 text-start focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${toneSurface(tone)} ${pending || open ? "ring-2 ring-foreground" : ""}`}
                onClick={() => {
                  setSelectedId(table.table_id);
                  setRejecting(false);
                  setReason("");
                  const current = table.order_status;
                  const options = floorStatusOptions(me?.role, current, current === "PAID" || current === "CLOSED");
                  if (options[0]) setStatus(options[0]);
                }}
              >
                <span className="block text-2xl font-semibold">{fill(t.tableNumber, { number: table.table_number })}</span>
                <span className="mt-3 grid gap-1">
                  <span className="block text-sm font-medium">{pending ? orderStatusLabel("PENDING_STAFF_CONFIRMATION") : occupancyLabel(table.current_state)}</span>
                  {table.order_status && !pending ? <span className="block text-sm">{fill(t.orderStatus, { status: orderStatusLabel(table.order_status) })}</span> : null}
                  <span className="block text-xs">
                    {[`${table.capacity} ${table.capacity === 1 ? t.seat : t.seats}`, seated, requestCount].filter(Boolean).join(" · ")}
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
            <SheetTitle>{fill(t.tableNumber, { number: selected?.display_number ?? selected?.table_number ?? "" })}</SheetTitle>
            <SheetDescription>
              {selected && needsConfirmation(selected) ? t.drawerPending : t.drawerOpen}
            </SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className="grid gap-4 px-4 pb-8">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone={occupancyTone(selected.current_state)}>
                  {needsConfirmation(selected) ? orderStatusLabel("PENDING_STAFF_CONFIRMATION") : occupancyLabel(selected.current_state)}
                </StatusChip>
                <span className="text-sm text-muted-foreground">
                  {[
                    `${selected.capacity} ${selected.capacity === 1 ? t.seat : t.seats}`,
                    seatedFor(selected.occupancy_duration_minutes, t.seatedOne, t.seatedMany),
                  ].filter(Boolean).join(" · ")}
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
                    if (selected.active_order_id && moveTo) transition.mutate({ orderId: selected.active_order_id, target: moveTo });
                  }}
                >
                  <p className="text-sm">{t.orderIs} <span className="font-medium">{orderStatusLabel(selected.order_status)}</span>.</p>
                  {due && amount ? (
                    <p className="text-sm">{t.amountDue} <Money amount={amount} /></p>
                  ) : selected.order_total ? (
                    <p className="text-sm">{t.total} <Money amount={String(selected.order_total)} /></p>
                  ) : null}
                  {due ? (
                    <p className={hint}>{t.unpaidHint}</p>
                  ) : null}
                  {moves.length > 0 && moveTo ? (
                    <>
                      <label className="grid gap-1 text-sm">
                        {t.moveTo}
                        <span className={hint}>{t.moveHint}</span>
                        <select className={control} value={moveTo} onChange={(event) => setStatus(event.target.value as OrderStatus)}>
                          {moves.map((value) => (
                            <option key={value} value={value}>{orderStatusLabel(value)}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="submit"
                        className="min-h-12 rounded-xl bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                        disabled={transition.isPending || moveTo === selected.order_status}
                      >
                        {transition.isPending ? t.updating : t.updateOrder}
                      </button>
                    </>
                  ) : null}
                </form>
              ) : (
                <p className={hint}>{t.noOpenOrder}</p>
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
  const t = useStaffSection(floorCopy);
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
        <p className="mt-2 text-sm text-muted-foreground">{t.pendingBody}</p>
      </div>
      {detail.isLoading ? (
        <LoadingState label={t.loadingOrder} />
      ) : detail.isError ? (
        <p className="text-sm text-muted-foreground">
          {detail.error instanceof Error ? detail.error.message : t.couldntLoadOrder}{" "}
          <button type="button" className="underline" onClick={() => void detail.refetch()}>
            {t.tryAgain}
          </button>
        </p>
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => {
            const modifiers = modifierNames(item.selected_modifiers);
            const note = item.special_instructions?.trim();
            return (
              <li key={item.id} className="rounded-lg bg-muted/70 p-3 text-sm">
                <p className="font-medium">
                  {item.quantity} × {item.item_name}
                </p>
                {modifiers.length > 0 ? <p className="text-muted-foreground">+ {modifiers.join(", ")}</p> : null}
                {note ? (
                  <p className={`mt-1 rounded-md px-2 py-1 ${toneSurface("ordered")}`}>
                    <span className="font-medium">{t.note}</span> {note}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {customerNotes?.trim() ? (
        <p className={`rounded-md px-2 py-1 text-sm ${toneSurface("ordered")}`}>
          <span className="font-medium">{t.orderNote}</span> {customerNotes}
        </p>
      ) : null}
      {total ? (
        <p className="text-sm font-medium">
          {t.total} <Money amount={String(total)} />
        </p>
      ) : null}
      {canConfirm ? (
        rejecting ? (
          <div className="grid gap-2">
            <label className="grid gap-1 text-sm font-medium">
              {t.rejectReason}
              <textarea
                className="min-h-20 rounded-lg border px-3 py-2"
                value={reason}
                onChange={(event) => onReason(event.target.value)}
                placeholder={t.rejectPlaceholder}
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="min-h-12 rounded-lg bg-destructive text-sm font-medium text-white disabled:opacity-50"
                disabled={pending || !reason.trim()}
                onClick={() => onReject(orderId)}
              >
                {pending ? t.rejecting : t.rejectOrder}
              </button>
              <button type="button" className="min-h-12 rounded-lg border text-sm" disabled={pending} onClick={onCancelReject}>
                {t.back}
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
              {pending ? t.confirming : t.confirmOrder}
            </button>
            <button type="button" className="min-h-12 rounded-lg border text-sm font-medium" disabled={pending} onClick={onStartReject}>
              {t.reject}
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}
