"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ignoreOwnChange } from "@/features/staff/alerts/ignore";

import { Money } from "@/components/ops/money";
import { Badge, type Tone } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { formatAmount } from "@/components/ops/kit/money";
import { ScreenTitle } from "@/components/ops/page-header";
import { useStaffSession } from "@/components/ops/staff-session";
import { occupancyTone, StatusChip, toneSurface } from "@/components/ops/status-chip";
import { navForUser } from "@/lib/nav";
import { requestsCopy } from "@/lib/i18n/staff/requests";
import { EmptyState, ErrorState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import type { components } from "@/lib/api/schema";
import type { UserRole } from "@/lib/auth/roles";
import { getStaffOrder } from "@/lib/api/staff-order";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { floorCopy } from "@/lib/i18n/staff/floor";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { occupancyLabel, orderStatusLabel } from "@/lib/status-labels";
import { floorStatusOptions, showAmountDue, type OrderStatus } from "@/features/staff/order-moves";
import { useScope } from "@/stores/scope";

const hint = "text-sm leading-6 text-ink-secondary";
const control = "h-12 w-full rounded-staff border bg-background px-3 text-sm";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-staff bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

const ADD_TABLE_ROLES: ReadonlySet<UserRole> = new Set(["SUPER_ADMIN", "BRAND_ADMIN", "REGIONAL_MANAGER", "BRANCH_ADMIN"]);

function AddTableDialog({ branchId }: { branchId: string }) {
  const t = useStaffSection(floorCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [zone, setZone] = useState("Indoor");

  const create = useMutation({
    mutationFn: async () => {
      const seats = Number(capacity);
      const body: components["schemas"]["TableCreateRequest"] = {
        table_number: number.trim(),
        capacity: Number.isFinite(seats) && seats >= 1 ? Math.floor(seats) : 4,
        zone_name: zone.trim() || "Indoor",
      };
      const result = await browserApi.POST("/api/v1/branches/{branch_id}/tables", {
        params: { path: { branch_id: branchId } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotCreateTable, locale);
    },
    onSuccess: () => {
      toast.success(t.tableCreated);
      setNumber("");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["floor-live"] });
      void queryClient.invalidateQueries({ queryKey: ["tables", branchId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <button type="button" className={primaryButton} onClick={() => setOpen(true)}>
        <Plus aria-hidden className="size-4" />
        {t.addTable}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.addTableTitle}</DialogTitle>
            <DialogDescription>{t.addTableBody}</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <label className="grid gap-1 text-sm">
              {t.tableNumberLabel}
              <input
                className={control}
                placeholder={t.tableNumberPlaceholder}
                value={number}
                onChange={(event) => setNumber(event.target.value)}
                required
                autoFocus
              />
            </label>
            <label className="grid gap-1 text-sm">
              {t.capacityLabel}
              <input
                className={control}
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-1 text-sm">
              {t.zoneLabel}
              <input
                className={control}
                placeholder={t.zonePlaceholder}
                value={zone}
                onChange={(event) => setZone(event.target.value)}
                required
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="min-h-11 rounded-staff border px-4 text-sm"
                disabled={create.isPending}
                onClick={() => setOpen(false)}
              >
                {t.cancel}
              </button>
              <button className={primaryButton} type="submit" disabled={create.isPending || !number.trim()}>
                {create.isPending ? t.adding : t.addTable}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

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

/** The one coloured badge on a table card. */
function tableBadge(table: FloorTable, t: (typeof floorCopy)["en"]): { tone: Tone; label: string } {
  if (table.current_state === "BILL_REQUESTED") return { tone: "info", label: t.board.needsBill };
  if (table.order_status === "READY") return { tone: "success", label: t.board.foodReady };
  if (table.current_state === "AWAITING_FOOD") return { tone: "warning", label: t.board.waiting };
  if (table.current_state === "FOOD_SERVED") return { tone: "neutral", label: t.board.eating };
  return { tone: "neutral", label: t.board.ordering };
}

function NeedsConfirmationBadge() {
  return (
    <span className="inline-flex items-center bg-foreground px-2 py-0.5 text-xs font-semibold text-background">
      {orderStatusLabel("PENDING_STAFF_CONFIRMATION")}
    </span>
  );
}

/** `embedded` drops the page header when the floor sits inside Orders → Tables. */
export function FloorScreen({ embedded = false }: { embedded?: boolean } = {}) {
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

  const [filter, setFilter] = useState<"all" | "needs" | "free">("all");
  const requests = useStaffSection(requestsCopy);
  const canAnswer = Boolean(me && navForUser(me, branchId).some((item) => item.href === "/app/floor/requests"));
  const calls = useQuery({
    queryKey: ["service-queue", branchId],
    enabled: canAnswer,
    refetchInterval: pollUnlessRoleDenied(interval),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/service-requests/active");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.board.callFailed, locale);
      return result.data;
    },
  });
  const answer = useMutation({
    mutationFn: async (id: string) => {
      const result = await browserApi.PATCH("/api/v1/service-requests/{request_id}/status", {
        params: { path: { request_id: id } },
        body: { status: "ACKNOWLEDGED" },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.board.callFailed, locale);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["service-queue"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const selected = floor.data?.tables.find((table) => table.table_id === selectedId) ?? null;
  const canConfirm = Boolean(me && CONFIRM_ROLES.has(me.role));
  const canAddTable = Boolean(me && branchId && ADD_TABLE_ROLES.has(me.role));
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

  const needsYou = (table: FloorTable) =>
    needsConfirmation(table) || table.current_state === "BILL_REQUESTED" || table.pending_service_requests_count > 0;
  const counts = {
    all: data.tables.length,
    needs: data.tables.filter(needsYou).length,
    free: data.tables.filter((table) => table.current_state === "AVAILABLE").length,
  };
  const tables = [...data.tables]
    .filter((table) => (filter === "needs" ? needsYou(table) : filter === "free" ? table.current_state === "AVAILABLE" : true))
    .sort((a, b) => Number(needsYou(b)) - Number(needsYou(a)) || Number(a.current_state === "AVAILABLE") - Number(b.current_state === "AVAILABLE"));
  const call = (calls.data ?? []).find((request) => request.status === "PENDING") ?? null;
  const callMinutes = call ? Math.max(0, Math.floor((Date.now() - new Date(call.created_at).getTime()) / 60000)) : 0;

  return (
    <div className="grid grid-cols-1 gap-3">
      {embedded ? null : (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <ScreenTitle>{t.board.title}</ScreenTitle>
          <div className="flex items-center gap-3">
            <p className="text-sm text-ink-secondary">{fill(t.board.inUse, { used: data.occupied_tables, total: data.total_tables })}</p>
            {canAddTable && branchId ? <AddTableDialog branchId={branchId} /> : null}
          </div>
        </div>
      )}
      {call ? (
        <div role="status" className="flex items-center gap-3 rounded-staff bg-info-bg p-3.5 text-ink">
          <BellRing aria-hidden className="size-[22px] shrink-0 text-info" />
          <div className="grid min-w-0 flex-1">
            <span className="truncate text-[15px] font-semibold">
              {fill(t.board.calling, { table: call.table_number ? fill(t.tableNumber, { number: call.table_number }) : t.board.callBell })}
            </span>
            <span className="truncate text-[13px] text-ink-secondary">
              {fill(callMinutes < 1 ? t.board.callNow : t.board.callAgo, { type: requests.type[call.request_type] ?? call.request_type, minutes: callMinutes })}
            </span>
          </div>
          <Button size="sm" className="min-h-11 shrink-0 px-3.5 text-sm" disabled={answer.isPending} onClick={() => answer.mutate(call.id)}>
            {t.board.onMyWay}
          </Button>
        </div>
      ) : null}
      <div role="group" aria-label={t.board.filters} className="flex gap-2 overflow-x-auto">
        {(["all", "needs", "free"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`inline-flex h-11 shrink-0 items-center rounded-staff border px-3.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${filter === key ? "border-ink bg-ink text-on-ink" : "border-border bg-canvas text-ink"}`}
          >
            {fill(key === "all" ? t.board.all : key === "needs" ? t.board.needsYou : t.board.free, { count: counts[key] })}
          </button>
        ))}
      </div>
      {data.tables.length === 0 ? (
        <EmptyState
          title={t.emptyTitle}
          body={t.emptyBody}
          action={canAddTable && branchId ? <AddTableDialog branchId={branchId} /> : undefined}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
          {tables.map((table) => {
            const pending = needsConfirmation(table);
            const open = table.table_id === selectedId;
            const free = table.current_state === "AVAILABLE";
            const badge = tableBadge(table, t);
            const calling = table.pending_service_requests_count > 0;
            return (
              <button
                key={table.table_id}
                type="button"
                aria-pressed={open}
                className={`grid min-h-[104px] content-between gap-2 rounded-staff p-3.5 text-start text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${free ? "border border-border bg-subtle" : needsYou(table) || open ? "border-2 border-ink bg-canvas" : "border border-border bg-canvas"}`}
                onClick={() => {
                  setSelectedId(table.table_id);
                  setRejecting(false);
                  setReason("");
                  const current = table.order_status;
                  const options = floorStatusOptions(me?.role, current, current === "PAID" || current === "CLOSED");
                  if (options[0]) setStatus(options[0]);
                }}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className={`text-2xl font-semibold ${free ? "text-ink-secondary" : ""}`}>
                    <span aria-hidden>{fill(t.board.short, { number: table.table_number })}</span>
                    <span className="sr-only">{fill(t.tableNumber, { number: table.table_number })}</span>
                  </span>
                  {calling ? (
                    <BellRing aria-label={fill(t.requests, { count: table.pending_service_requests_count })} className="size-5 shrink-0 text-info" />
                  ) : table.order_total ? (
                    <span className="shrink-0 text-[13px] text-ink-secondary tabular-nums">{formatAmount(String(table.order_total), undefined, locale)}</span>
                  ) : null}
                </span>
                {free ? (
                  <span className="text-[13px] text-ink-secondary">{t.board.freeTable}</span>
                ) : (
                  <Badge tone={pending ? "warning" : badge.tone} className="w-fit">
                    {pending ? t.board.toConfirm : badge.label}
                  </Badge>
                )}
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
                <span className="text-sm text-ink-secondary">
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
                        className="min-h-12 rounded-staff bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
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
        <p className="mt-2 text-sm text-ink-secondary">{t.pendingBody}</p>
      </div>
      {detail.isLoading ? (
        <LoadingState label={t.loadingOrder} />
      ) : detail.isError ? (
        <p className="text-sm text-ink-secondary">
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
              <li key={item.id} className="rounded-staff bg-muted/70 p-3 text-sm">
                <p className="font-medium">
                  {item.quantity} × {item.item_name}
                </p>
                {modifiers.length > 0 ? <p className="text-ink-secondary">+ {modifiers.join(", ")}</p> : null}
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
                className="min-h-20 rounded-staff border px-3 py-2"
                value={reason}
                onChange={(event) => onReason(event.target.value)}
                placeholder={t.rejectPlaceholder}
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="min-h-12 rounded-staff bg-danger text-sm font-medium text-white disabled:opacity-50"
                disabled={pending || !reason.trim()}
                onClick={() => onReject(orderId)}
              >
                {pending ? t.rejecting : t.rejectOrder}
              </button>
              <button type="button" className="min-h-12 rounded-staff border text-sm" disabled={pending} onClick={onCancelReject}>
                {t.back}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="min-h-12 rounded-staff bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
              disabled={pending}
              onClick={() => onConfirm(orderId)}
            >
              {pending ? t.confirming : t.confirmOrder}
            </button>
            <button type="button" className="min-h-12 rounded-staff border text-sm font-medium" disabled={pending} onClick={onStartReject}>
              {t.reject}
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}
