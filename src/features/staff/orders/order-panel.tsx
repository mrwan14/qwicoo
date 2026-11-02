"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { Check, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge, type Tone } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { SectionLabel } from "@/components/ops/kit/card";
import { Field, Textarea } from "@/components/ops/kit/field";
import { formatAmount } from "@/components/ops/kit/money";
import { MoreOptions, SidePanel } from "@/components/ops/kit/side-panel";
import { useStaffSession } from "@/components/ops/staff-session";
import { Skeleton } from "@/components/ui/skeleton";
import { ignoreOwnChange } from "@/features/staff/alerts/ignore";
import { cancelOffer } from "@/features/staff/delivery";
import { cairoTime } from "@/features/staff/home/numbers";
import { floorStatusOptions } from "@/features/staff/order-moves";
import { printReceipt, type ReceiptLabels } from "@/features/staff/orders/receipt";
import { OrderRefunds } from "@/features/staff/orders/refunds";
import type { StaffOrderListItem, StaffOrderReceipt } from "@/features/staff/orders/types";
import { PaymobRefunds } from "@/features/staff/paymob-refund";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { getStaffOrder } from "@/lib/api/staff-order";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { ordersCopy } from "@/lib/i18n/staff/orders";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { orderStatusLabel, paymentMethodLabel } from "@/lib/status-labels";
import { useScope } from "@/stores/scope";

import { orderLabel, orderTone, placeLabel, sourceLabel } from "./labels";

type Order = components["schemas"]["OrderResponse"];
type Step = { key: string; label: string; time?: string | null; state: "done" | "current" | "todo" | "cancelled" };

/** How far an order has come: 0 ordered, 1 sent, 2 preparing, 3 ready, 4 served. */
function reached(order: Order): number {
  switch (order.status) {
    case "SUBMITTED":
      return 1;
    case "PREPARING":
      return 2;
    case "READY":
      return 3;
    case "DELIVERED":
    case "SERVED":
    case "CLOSED":
      return 4;
    case "PAID":
      return order.completed_at ? 4 : order.ready_at ? 3 : 1;
    default:
      return 0;
  }
}

function useReceiptLabels(): ReceiptLabels {
  const t = useStaffSection(ordersCopy);
  return {
    receipt: t.receipt,
    date: t.date,
    table: t.table,
    cashier: t.cashier,
    subtotal: t.subtotal,
    discount: t.discount,
    serviceFee: t.serviceFee,
    tax: t.tax,
    total: t.total,
    paid: t.paid,
    unpaid: t.unpaid,
    thanks: t.thanks,
  };
}

const DOT: Record<Tone, string> = {
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  success: "bg-success",
  neutral: "bg-ink-secondary",
};

/**
 * One order, opened from Live or History: progress, items, totals, payment state,
 * refunds, cancel and the next kitchen step. Every action is the existing API call.
 */
export function OrderPanel({
  orderId,
  summary,
  onClose,
}: {
  orderId: string | null;
  summary: StaffOrderListItem | null;
  onClose: () => void;
}) {
  const t = useStaffSection(ordersCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  const queryClient = useQueryClient();
  const labels = useReceiptLabels();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const detail = useQuery({
    queryKey: ["staff-order", orderId, branchId],
    enabled: Boolean(orderId && branchId),
    queryFn: () => getStaffOrder(orderId ?? ""),
  });
  const order = detail.data;
  const currency = summary?.currency || "EGP";
  const money = (amount: string) => formatAmount(amount, currency, locale);

  function close() {
    setCancelling(false);
    setReason("");
    onClose();
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["staff-orders"] });
    void queryClient.invalidateQueries({ queryKey: ["staff-order", orderId] });
    void queryClient.invalidateQueries({ queryKey: ["orders-live"] });
  }

  const reprint = useMutation({
    mutationFn: async () => {
      // Always hit the API so RECEIPT_REPRINT is audited and totals stay fresh.
      const result = await browserApi.GET("/api/v1/orders/{order_id}/receipt", { params: { path: { order_id: orderId ?? "" } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.receiptFailed, locale);
      const data = result.data as StaffOrderReceipt;
      queryClient.setQueryData(["staff-receipt", orderId, branchId], data);
      await printReceipt(data, locale, labels);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      const text = reason.trim();
      if (!orderId || !text) throw new Error(t.reasonHint);
      const result = await browserApi.POST("/api/v1/orders/{order_id}/cancel", { params: { path: { order_id: orderId } }, body: { reason: text } });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.cancelFailed, locale);
    },
    onSuccess: () => {
      toast.success(t.cancelled);
      refresh();
      close();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const status = (order?.status ?? summary?.status ?? null) as Order["status"] | null;
  const isPaid = order?.is_paid ?? summary?.is_paid ?? false;
  const next = floorStatusOptions(me?.role, status, isPaid)[0] ?? null;
  const move = useMutation({
    mutationFn: async (target: Order["status"]) => {
      const result = await browserApi.POST("/api/v1/orders/{order_id}/transition", {
        params: { path: { order_id: orderId ?? "" } },
        body: { target_status: target, reason: null },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.panel.moveFailed, locale);
    },
    onSuccess: (_data, target) => {
      if (orderId) ignoreOwnChange(orderId, target);
      toast.success(t.panel.moved);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const offer = cancelOffer(me?.role, status);
  const tone = summary ? orderTone(summary, t, locale) : null;
  const title = summary ? `${orderLabel(summary)} · ${placeLabel(summary, t)}` : t.detail;

  const steps: Step[] = [];
  if (order) {
    const level = reached(order);
    const cancelled = order.status === "CANCELLED";
    const rows: [string, string, string | null | undefined][] = [
      ["ordered", `${t.panel.ordered} · ${sourceLabel(order.order_source, t)}`, order.created_at],
      ["sent", t.panel.sent, null],
      ["preparing", t.panel.preparing, null],
      ["ready", t.panel.ready, order.ready_at],
      ["served", t.panel.served, order.completed_at],
    ];
    rows.forEach(([key, label, time], index) => {
      const state = cancelled ? (index === 0 ? "done" : "todo") : index < level ? "done" : index === level ? (index === 4 ? "done" : "current") : "todo";
      steps.push({ key, label, time, state });
    });
    if (cancelled) steps.push({ key: "cancelled", label: t.panel.cancelled, time: order.completed_at, state: "cancelled" });
  }

  const paidMethods = (order?.payments ?? [])
    .filter((payment) => payment.status === "COMPLETED")
    .map((payment) => paymentMethodLabel(payment.payment_method, locale));

  return (
    <SidePanel
      open={orderId !== null}
      onOpenChange={(open) => !open && close()}
      title={title}
      meta={
        summary ? (
          <>
            {tone ? <Badge tone={tone.tone}>{tone.label}</Badge> : null}
            <Badge tone={isPaid ? "success" : "warning"}>{isPaid ? t.paid : t.unpaid}</Badge>
          </>
        ) : null
      }
      footer={
        <>
          <Button variant="secondary" size="field" disabled={!orderId || reprint.isPending} onClick={() => reprint.mutate()}>
            <Printer aria-hidden />
            {reprint.isPending ? t.printing : t.panel.print}
          </Button>
          {offer === "reject" || offer === "cancel" || offer === "locked" ? (
            <Button
              variant="dangerGhost"
              size="field"
              className="me-auto px-2"
              disabled={offer === "locked"}
              title={offer === "locked" ? t.cancelLocked : undefined}
              aria-expanded={cancelling}
              onClick={() => setCancelling((value) => !value)}
            >
              {offer === "reject" ? t.reject : t.cancelOrder}
            </Button>
          ) : (
            <span className="me-auto" />
          )}
          {next ? (
            <Button size="field" disabled={move.isPending} onClick={() => move.mutate(next)}>
              <Check aria-hidden />
              {move.isPending ? t.panel.moving : fill(t.panel.moveTo, { status: locale === "en" ? orderStatusLabel(next, locale).toLowerCase() : orderStatusLabel(next, locale) })}
            </Button>
          ) : null}
        </>
      }
    >
      {detail.isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-28 rounded-staff" />
          <Skeleton className="h-40 rounded-staff" />
        </div>
      ) : detail.isError ? (
        <p role="alert" className="text-sm text-danger">
          {detail.error instanceof Error ? detail.error.message : t.panel.detailFailed}
        </p>
      ) : order ? (
        <>
          <section className="grid gap-2.5">
            <SectionLabel>{t.panel.progress}</SectionLabel>
            <ol className="grid gap-2.5">
              {steps.map((step) => (
                <li key={step.key} className="flex items-center gap-2.5 text-sm">
                  <span
                    aria-hidden
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      step.state === "done" && "bg-ink",
                      step.state === "current" && "border-2 border-ink bg-canvas",
                      step.state === "todo" && "bg-border",
                      step.state === "cancelled" && "bg-danger",
                    )}
                  />
                  <span className={cn("flex-1", step.state === "todo" ? "text-ink-secondary" : "text-ink", step.state === "current" && "font-semibold")}>
                    {step.label}
                  </span>
                  {step.time ? <span className="text-xs text-ink-secondary tabular-nums">{cairoTime(step.time, locale)}</span> : null}
                </li>
              ))}
            </ol>
          </section>

          <section className="grid">
            <SectionLabel>{t.panel.items}</SectionLabel>
            <ul>
              {(order.items ?? []).map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 border-b border-border py-2.5 text-sm">
                  <span className="grid min-w-0 gap-0.5">
                    <span className="font-medium text-ink">
                      <span className="tabular-nums">{item.quantity}</span> × {item.item_name ?? "—"}
                    </span>
                    {item.special_instructions ? <span className="text-xs text-ink-secondary">{item.special_instructions}</span> : null}
                  </span>
                  <span className="shrink-0 text-ink tabular-nums">{money(item.subtotal)}</span>
                </li>
              ))}
            </ul>
            {order.customer_notes ? (
              <p className="mt-2 text-[13px] text-ink-secondary">
                <span className="font-medium text-ink">{t.panel.note}: </span>
                {order.customer_notes}
              </p>
            ) : null}
          </section>

          <dl className="grid gap-1.5 text-sm">
            <div className="flex justify-between gap-3 text-ink-secondary">
              <dt>{t.subtotal}</dt>
              <dd className="tabular-nums">{money(order.subtotal)}</dd>
            </div>
            {Number(order.discount_total) > 0 ? (
              <div className="flex justify-between gap-3 text-ink-secondary">
                <dt>{t.discount}</dt>
                <dd className="tabular-nums">−{money(order.discount_total)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3 text-ink-secondary">
              <dt>{t.serviceFee}</dt>
              <dd className="tabular-nums">{money(order.service_fee_total)}</dd>
            </div>
            <div className="flex justify-between gap-3 text-ink-secondary">
              <dt>{t.tax}</dt>
              <dd className="tabular-nums">{money(order.tax_total)}</dd>
            </div>
            <div className="flex justify-between gap-3 text-base font-semibold text-ink">
              <dt>{t.total}</dt>
              <dd className="tabular-nums">{money(order.total_amount)}</dd>
            </div>
          </dl>

          <p className="flex items-center gap-2.5 rounded-staff bg-subtle p-3 text-[13px] text-ink">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[order.is_paid ? "success" : "warning"])} />
            {order.is_paid
              ? paidMethods.length > 0
                ? fill(t.panel.paidWith, { methods: paidMethods.join(", ") })
                : t.panel.paidOnly
              : t.panel.notPaid}
          </p>

          {cancelling && (offer === "reject" || offer === "cancel") ? (
            <form
              className="grid gap-3 rounded-staff border border-danger/40 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                cancel.mutate();
              }}
            >
              <Field label={offer === "reject" ? t.rejectTitle : t.cancelTitle} hint={t.reasonHint}>
                <Textarea value={reason} onChange={(event) => setReason(event.target.value)} required />
              </Field>
              <Button type="submit" variant="danger" disabled={cancel.isPending || !reason.trim()}>
                {cancel.isPending ? t.cancelling : offer === "reject" ? t.reject : t.confirmCancel}
              </Button>
            </form>
          ) : null}

          {orderId ? (
            <MoreOptions label={t.panel.refunds} summary={t.panel.refundsSummary}>
              <OrderRefunds orderId={orderId} />
              <PaymobRefunds orderId={orderId} />
            </MoreOptions>
          ) : null}
        </>
      ) : null}
    </SidePanel>
  );
}
