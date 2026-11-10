"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { Check, CheckCircle2, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ignoreOwnChange } from "@/features/staff/alerts/ignore";
import { isDeliveryFulfillment, optionalRecordString, staffOrderStatus } from "@/features/staff/delivery";

import { ScreenTitle } from "@/components/ops/page-header";
import { Badge } from "@/components/ops/kit/badge";
import { Button, buttonClass } from "@/components/ops/kit/button";
import { EmptyState } from "@/components/ops/kit/empty-state";
import { Field, Input, Textarea } from "@/components/ops/kit/field";
import { useStaffSession } from "@/components/ops/staff-session";
import { LoadingState, QueryErrorState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { formatMoney } from "@/lib/format/money";
import { pollUnlessRoleDenied, usePollingInterval } from "@/hooks/use-page-visible";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale, type LocaleCode } from "@/lib/i18n/locale-text";
import { handoverCopy } from "@/lib/i18n/staff/handover";
import { kdsCopy } from "@/lib/i18n/staff/kds";
import { posCopy } from "@/lib/i18n/staff/pos";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { orderStatusLabel, stationLabel } from "@/lib/status-labels";
import type { components } from "@/lib/api/schema";
import { useNetwork } from "@/lib/offline/network";
import { useScope } from "@/stores/scope";

import { OfflineStage, OfflineTickets } from "./offline/offline-tickets";

type ExpoOrder = components["schemas"]["KDSExpoOrderResponse"];

type CardLine = {
  key: string;
  name: string;
  quantity: number;
  modifiers: string[];
  note: string | null;
  badge: string | null;
  /** Only kitchen ticket lines can be bumped one by one. */
  ticketItemId?: string;
};

function paymentDueBeforeHandover(error: unknown, locale: LocaleCode): string | null {
  if (!error || typeof error !== "object") return null;
  const root = error as { code?: unknown; detail?: unknown };
  const detail =
    root.detail && typeof root.detail === "object"
      ? (root.detail as { code?: unknown; amount_due?: unknown; currency?: unknown })
      : null;
  const code = typeof root.code === "string" ? root.code : typeof detail?.code === "string" ? detail.code : "";
  if (code !== "PAYMENT_REQUIRED" && code !== "PAYMENT_REQUIRED_BEFORE_HANDOVER") return null;
  if (typeof detail?.amount_due !== "string" || !detail.amount_due) return "";
  const currency = typeof detail.currency === "string" && detail.currency ? detail.currency : "EGP";
  return formatMoney(detail.amount_due, currency, locale);
}

function displayNumber(order: ExpoOrder, tableLabel: string): string | null {
  if (order.pickup_number != null) return `#${order.pickup_number}`;
  const table = order.display_number?.trim();
  return table ? fill(tableLabel, { number: table }) : null;
}

function modifierNames(modifiers: { [key: string]: unknown }[] | null | undefined, locale: LocaleCode): string[] {
  return (modifiers ?? [])
    .map((modifier) => {
      const name = modifier.name;
      return (typeof name === "string" ? name : pickLocale(name, locale)).trim();
    })
    .filter(Boolean);
}

function cardLines(order: ExpoOrder, locale: LocaleCode): CardLine[] {
  const items = order.items ?? [];
  if (items.length > 0) {
    return items.map((item, index) => ({
      key: `item-${index}`,
      name: item.name,
      quantity: item.quantity,
      modifiers: modifierNames(item.modifiers, locale),
      note: item.notes?.trim() || null,
      badge: item.badge === "Store" ? "Store" : null,
    }));
  }
  return (order.ticket_items ?? []).map((item) => ({
    key: item.id,
    name: pickLocale(item.item_name, locale) || (item.station ? stationLabel(item.station, locale) : ""),
    quantity: item.quantity,
    modifiers: [],
    note: null,
    badge: null,
    ticketItemId: item.id,
  }));
}

export function ExpoScreen() {
  const t = useStaffSection(handoverCopy);
  const kitchenLabels = useStaffSection(kdsCopy);
  const posLabels = useStaffSection(posCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const runnerOnly = me?.role === "RUNNER";
  const interval = usePollingInterval(7000);
  const branchId = useScope((state) => state.branchId);
  const [token, setToken] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteEditor, setNoteEditor] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const online = useNetwork((state) => state.online);
  const queryKey = ["expo", branchId];
  const orders = useQuery({
    queryKey,
    refetchInterval: pollUnlessRoleDenied(interval),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/kds/expo/orders");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      const rows = result.data as ExpoOrder[];
      return runnerOnly ? rows.filter((order) => order.status === "READY") : rows;
    },
  });

  const bump = useMutation({
    mutationFn: async (orderId: string) => {
      const result = await browserApi.POST("/api/v1/kds/orders/{order_id}/expo-bump", {
        params: { path: { order_id: orderId } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.bumpFailed, locale);
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
      if (!result.response.ok) throw asApiError(result.error, result.response, t.handOverFailed, locale);
      return orderId;
    },
    onSuccess: (orderId) => {
      ignoreOwnChange(orderId, "DELIVERED");
      queryClient.setQueryData<ExpoOrder[]>(queryKey, (current) => current?.filter((order) => order.order_id !== orderId));
      toast.success(t.handedOver);
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
      if (!result.response.ok) throw asApiError(result.error, result.response, t.notesFailed, locale);
    },
    onSuccess: (_data, orderId) => {
      toast.success(t.noteSaved);
      setNoteEditor((current) => (current === orderId ? null : current));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const ticketBump = useMutation({
    mutationFn: async (ticketItemId: string) => {
      const result = await browserApi.POST("/api/v1/kds/ticket-items/{ticket_item_id}/bump", {
        params: { path: { ticket_item_id: ticketItemId } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.itemBumpFailed, locale);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["expo"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const verify = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/orders/handover/verify", {
        body: { token, branch_id: branchId, collect_cash: false },
      });
      if (!result.response.ok) {
        const due = paymentDueBeforeHandover(result.error, locale);
        if (due != null) {
          throw new Error(due ? fill(t.takeDueFirst, { amount: due }) : t.takePaymentFirst);
        }
        throw asApiError(result.error, result.response, t.verifyFailed, locale);
      }
    },
    onSuccess: () => toast.success(t.verified),
    onError: (error: Error) => toast.error(error.message),
  });

  if (!online) return <OfflineStage stage="handover" />;
  if (orders.isLoading) return <LoadingState label={t.loading} />;
  if (orders.isError) return <QueryErrorState error={orders.error} screen={t.screen} onRetry={() => void orders.refetch()} />;

  const cards = (orders.data ?? [])
    .map((order) => ({ order, number: displayNumber(order, t.table), lines: cardLines(order, locale) }))
    .filter((card) => card.number || card.lines.length > 0);
  const readyCount = cards.filter((card) => card.order.status === "READY").length;

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <ScreenTitle>{runnerOnly ? t.runnerTitle : t.title}</ScreenTitle>
        {cards.length > 0 ? <p className="text-sm text-ink-secondary">{fill(t.readyCount, { count: readyCount })}</p> : null}
      </div>
      <p className="-mt-2 max-w-2xl text-sm text-ink-secondary">{runnerOnly ? t.runnerHint : t.hint}</p>
      <OfflineTickets stage="handover" />
      {runnerOnly ? null : !codeOpen ? (
        <button type="button" className={cn(buttonClass({ variant: "secondary", size: "sm" }), "w-fit")} onClick={() => setCodeOpen(true)}>
          <KeyRound aria-hidden />
          {t.enterGuestCode}
        </button>
      ) : (
        <form
          className="grid grid-cols-1 gap-2 rounded-staff border border-border bg-canvas p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (token.trim()) verify.mutate();
          }}
        >
          <Field label={t.guestCode} hint={t.guestCodeHint}>
            <Input className="h-12" autoFocus value={token} onChange={(event) => setToken(event.target.value)} />
          </Field>
          <Button type="submit" variant="secondary" className="min-h-12 self-start sm:mt-[22px]" disabled={!token.trim() || verify.isPending}>
            {verify.isPending ? t.checking : t.checkCode}
          </Button>
        </form>
      )}
      {cards.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={runnerOnly ? t.runnerEmptyTitle : t.emptyTitle}
          body={runnerOnly ? t.runnerEmptyBody : t.emptyBody}
          className="py-16"
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ order, number, lines }) => {
            const ready = order.status === "READY";
            // Dine-in guests eat first and pay at the end: only takeaway waits for payment here.
            const dineIn = order.fulfillment_type === "DINE_IN";
            const unpaid = ready && !order.is_paid && !dineIn;
            const handingOver = handOver.isPending && handOver.variables === order.order_id;
            const bumping = bump.isPending && bump.variables === order.order_id;
            const savingNote = saveNotes.isPending && saveNotes.variables === order.order_id;
            const editingNote = noteEditor === order.order_id;
            const savedNote = order.expo_notes?.trim() ?? "";
            const draftNote = (notes[order.order_id] ?? order.expo_notes ?? "").trim();
            const noteChanged = draftNote !== savedNote;
            const dishesLeft = order.total_ticket_items > 0 && order.ready_ticket_items < order.total_ticket_items;
            const status = staffOrderStatus({
              fulfillmentType: order.fulfillment_type,
              deliveryStatus: optionalRecordString(order, "delivery_status"),
              fallback: isDeliveryFulfillment(order.fulfillment_type) ? orderStatusLabel(order.status, locale) : ready ? t.readyToHand : t.stillKitchen,
              locale,
            });
            const pack = optionalRecordString(order, "store_pack_status");
            return (
              <li key={order.order_id} className={cn("grid content-start gap-3 rounded-staff border bg-canvas p-4 text-ink", ready ? "border-ink" : "border-border")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="grid gap-0.5">
                    <p className="text-xl font-semibold tabular-nums">{number ?? t.noNumber}</p>
                    <p className="text-[13px] text-ink-secondary">
                      {[
                        order.pickup_bay != null ? fill(t.bay, { number: order.pickup_bay }) : null,
                        dishesLeft ? fill(t.dishesReady, { ready: order.ready_ticket_items, total: order.total_ticket_items }) : null,
                        pack
                          ? `${kitchenLabels.storeBag}: ${pack === "packed" ? posLabels.packed : pack === "handed_over" ? posLabels.handedOver : posLabels.filterNew}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Badge tone={ready ? "success" : "warning"}>{status}</Badge>
                </div>
                {order.customer_notes?.trim() ? (
                  <p className="rounded-staff bg-warning-bg px-3 py-2 text-[13px]">
                    <span className="font-medium">{t.orderNote}</span> {order.customer_notes}
                  </p>
                ) : null}
                {lines.length === 0 ? (
                  <p className="text-sm text-ink-secondary">{t.noItems}</p>
                ) : (
                  <div className="grid gap-3">
                    {[
                      { title: null, rows: lines.filter((line) => line.badge !== "Store") },
                      { title: t.pack, rows: lines.filter((line) => line.badge === "Store") },
                    ]
                      .filter((group) => group.rows.length > 0)
                      .map((group) => (
                        <div key={group.title ?? "kitchen"} className="grid gap-1.5">
                          {group.title ? <p className="text-xs font-semibold tracking-wide text-ink-secondary uppercase">{group.title}</p> : null}
                          <ul className="grid gap-1.5">
                            {group.rows.map((line) => {
                              const body = (
                                <>
                                  <span className="text-base font-medium">
                                    <span className="tabular-nums">{line.quantity}</span> × {line.name}
                                    {line.badge === "Store" ? <Badge className="ms-2">{t.store}</Badge> : null}
                                  </span>
                                  {line.modifiers.length > 0 ? <span className="text-[13px] text-ink-secondary">+ {line.modifiers.join(", ")}</span> : null}
                                  {line.note ? <span className="text-[13px] text-ink-secondary">{t.itemNote} {line.note}</span> : null}
                                </>
                              );
                              const bumpingLine = ticketBump.isPending && ticketBump.variables === line.ticketItemId;
                              return (
                                <li key={line.key}>
                                  {line.ticketItemId && !runnerOnly ? (
                                    <button
                                      type="button"
                                      className="grid w-full gap-0.5 rounded-staff px-1 py-1 text-start focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-60"
                                      disabled={bumpingLine}
                                      aria-label={`${line.quantity} × ${line.name}. ${t.tapReady}`}
                                      onClick={() => line.ticketItemId && ticketBump.mutate(line.ticketItemId)}
                                    >
                                      {body}
                                      {bumpingLine ? <span className="text-[13px] text-ink-secondary">{t.marking}</span> : null}
                                    </button>
                                  ) : (
                                    <div className="grid gap-0.5 px-1 py-1">{body}</div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                  </div>
                )}
                {runnerOnly ? (
                  savedNote ? <p className="rounded-staff bg-subtle px-3 py-2 text-[13px]">{savedNote}</p> : null
                ) : editingNote ? (
                  <div className="grid gap-2">
                    <Field label={t.noteForHandover}>
                      <Textarea
                        value={notes[order.order_id] ?? order.expo_notes ?? ""}
                        onChange={(event) => setNotes((current) => ({ ...current, [order.order_id]: event.target.value }))}
                      />
                    </Field>
                    <div className="flex gap-2">
                      {noteChanged ? (
                        <Button size="field" disabled={savingNote} onClick={() => saveNotes.mutate(order.order_id)}>
                          {savingNote ? t.saving : t.saveNote}
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="field" onClick={() => setNoteEditor(null)}>
                        {t.cancel}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-1">
                    {savedNote ? <p className="rounded-staff bg-subtle px-3 py-2 text-[13px]">{savedNote}</p> : null}
                    <button
                      type="button"
                      className="min-h-10 justify-self-start text-[13px] font-medium text-ink underline-offset-4 hover:underline"
                      onClick={() => {
                        setNotes((current) => ({ ...current, [order.order_id]: current[order.order_id] ?? order.expo_notes ?? "" }));
                        setNoteEditor(order.order_id);
                      }}
                    >
                      {savedNote ? t.changeNote : t.addNote}
                    </button>
                  </div>
                )}
                {unpaid ? (
                  <p className="rounded-staff bg-warning-bg px-3 py-2 text-[13px]">{t.paymentDue}</p>
                ) : ready ? (
                  <div className="grid gap-2">
                    {!order.is_paid ? <p className="text-[13px] text-ink-secondary">{t.dineInUnpaid}</p> : null}
                    <Button size="touch" className="w-full" disabled={handingOver} onClick={() => handOver.mutate(order.order_id)}>
                      <Check aria-hidden />
                      {handingOver ? t.handingOver : runnerOnly ? t.delivered : t.guestHasFood}
                    </Button>
                  </div>
                ) : runnerOnly ? null : (
                  <Button size="touch" variant="secondary" className="w-full" disabled={bumping} onClick={() => bump.mutate(order.order_id)}>
                    {bumping ? t.marking : t.markReady}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
