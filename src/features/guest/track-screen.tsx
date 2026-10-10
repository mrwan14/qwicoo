"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { Money } from "@/components/ops/money";
import { guestStatus, PAYABLE_STATUSES } from "@/features/guest/copy";
import { GuestSkeleton } from "@/features/guest/ordering-status";
import { isGuestSessionGone, resumeIfSessionGone } from "@/features/guest/session";
import { BillSheet, WaiterSheet } from "@/features/guest/service-sheets";
import {
  GuestQueryError,
  LineDetails,
  PresenceNote,
  guestPrimaryButton,
  guestSecondaryButton,
  useGuestCopy,
} from "@/features/guest/shell";
import { usePollingInterval } from "@/hooks/use-page-visible";
import { ApiError, asApiError } from "@/lib/api/error";
import { guestApi } from "@/lib/api/guest";
import { getPickupOrder } from "@/lib/guest/pickup-orders";
import type { components } from "@/lib/api/schema";
import { useGuest } from "@/stores/guest";

type OrderStatus = components["schemas"]["OrderStatus"];
type GuestOrder = components["schemas"]["OrderResponse"] & { display_number?: string | null };
type PaymentMethod = components["schemas"]["PaymentMethod"];

const STEPS: readonly OrderStatus[] = ["SUBMITTED", "PREPARING", "READY", "DELIVERED"];
const GUEST_CANCELLABLE: ReadonlySet<OrderStatus> = new Set(["DRAFT", "PENDING_STAFF_CONFIRMATION"]);

function stepIndex(status: OrderStatus): number {
  if (status === "SERVED") return STEPS.indexOf("DELIVERED");
  if (status === "PAID" || status === "CLOSED") return STEPS.length;
  return STEPS.indexOf(status);
}

function shouldFetchHandover(order: GuestOrder): boolean {
  if (order.status === "CANCELLED") return false;
  const fulfillment = (order.fulfillment_type ?? "").toUpperCase();
  return (
    order.order_type === "TAKEAWAY" ||
    fulfillment === "DRIVE_THRU" ||
    fulfillment === "CURBSIDE" ||
    fulfillment === "CURBSIDE_PICKUP" ||
    fulfillment === "PICKUP"
  );
}

function modifierNames(item: components["schemas"]["OrderItemResponse"]): string[] {
  return (item.selected_modifiers ?? []).map((modifier) => {
    const name = modifier.name ?? modifier.option_name;
    return typeof name === "string" ? name : "";
  });
}

export function TrackScreen() {
  const { t, locale } = useGuestCopy();
  const session = useGuest((state) => state.session);
  const cashRequestedOrderId = useGuest((state) => state.cashRequestedOrderId);
  const setCashRequestedOrderId = useGuest((state) => state.setCashRequestedOrderId);
  const interval = usePollingInterval(7000);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [waiterOpen, setWaiterOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);

  function statusTone(value: OrderStatus): string {
    if (value === "PREPARING") return "var(--guest-amber)";
    if (value === "READY" || value === "SERVED" || value === "DELIVERED" || value === "PAID" || value === "CLOSED") {
      return "var(--guest-sage)";
    }
    return "var(--guest-orange)";
  }

  const order = useQuery({
    queryKey: ["guest-active", session?.sessionId],
    enabled: Boolean(session),
    refetchInterval: interval,
    queryFn: async (): Promise<GuestOrder | null> => {
      const result = await guestApi.GET("/api/v1/orders/active");
      if (result.response.status === 404) {
        const error = asApiError(result.error, result.response, t.oops, locale);
        if (isGuestSessionGone(error)) throw error;
        return null;
      }
      if (!result.response.ok || !result.data) {
        const error = asApiError(result.error, result.response, t.oops, locale);
        throw error;
      }
      return result.data;
    },
  });

  const pay = useMutation({
    mutationFn: async ({ method, activeOrder }: { method: PaymentMethod; activeOrder: GuestOrder }) => {
      if (method === "CASH") {
        const body: components["schemas"]["OfflinePaymentRequest"] = {
          order_id: activeOrder.id,
          amount: activeOrder.total_amount,
          method,
        };
        const result = await guestApi.POST("/api/v1/payments/offline/request", { body });
        if (!result.response.ok) throw asApiError(result.error, result.response, t.oops, locale);
        return null;
      }
      const body: components["schemas"]["InitiateOnlinePaymentRequest"] = {
        order_id: activeOrder.id,
        amount: activeOrder.total_amount,
        method,
        idempotency_key: crypto.randomUUID(),
      };
      const result = await guestApi.POST("/api/v1/payments/online/initiate", { body });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.oops, locale);
      return result.data.checkout_url ?? null;
    },
    onMutate: () => setNotice(null),
    onSuccess: (checkoutUrl, { method, activeOrder: paidOrder }) => {
      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }
      if (method === "CASH") {
        setCashRequestedOrderId(paidOrder.id);
        setNotice(t.paymentRequested);
      }
      void order.refetch();
    },
    onError: (error: Error, { activeOrder: paidOrder }) => {
      if (error instanceof ApiError && error.code === "PRESENCE_VERIFICATION_REQUIRED") {
        setNotice(t.confirmTable);
        return;
      }
      if (error instanceof ApiError && error.code === "ACTIVE_OFFLINE_PAYMENT_EXISTS") {
        setCashRequestedOrderId(paidOrder.id);
        setNotice(t.paymentRequested);
        return;
      }
      void resumeIfSessionGone(error).then((gone) => {
        if (gone) {
          if (useGuest.getState().session) void order.refetch();
          return;
        }
        toast.error(error.message);
      });
    },
  });

  const cancel = useMutation({
    mutationFn: async (orderId: string) => {
      const body: components["schemas"]["Body_cancel_order_api_v1_orders__order_id__cancel_post"] = {
        reason: "Guest cancelled",
      };
      const result = await guestApi.POST("/api/v1/orders/{order_id}/cancel", {
        params: { path: { order_id: orderId } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.oops, locale);
    },
    onSuccess: () => {
      setConfirmCancel(false);
      toast.success(t.cancelled);
      void order.refetch();
    },
    onError: (error: Error) => {
      setConfirmCancel(false);
      void resumeIfSessionGone(error).then((gone) => {
        if (gone) {
          if (useGuest.getState().session) void order.refetch();
          return;
        }
        toast.error(error.message);
      });
    },
  });

  const here = useMutation({
    mutationFn: async () => {
      const result = await guestApi.POST("/api/v1/sessions/verified-action");
      if (!result.response.ok) throw asApiError(result.error, result.response, t.oops, locale);
    },
    onSuccess: () => toast.success(t.hereThanks),
    onError: (error: Error) => {
      if (error instanceof ApiError && error.code === "PRESENCE_VERIFICATION_REQUIRED") {
        setNotice(t.confirmTable);
        return;
      }
      void resumeIfSessionGone(error).then((gone) => {
        if (gone) {
          if (useGuest.getState().session) void order.refetch();
          return;
        }
        toast.error(error.message);
      });
    },
  });

  useEffect(() => {
    const current = order.data;
    if (!current) return;
    if (current.is_paid || current.status === "PAID" || current.status === "CLOSED") {
      if (cashRequestedOrderId === current.id) setCashRequestedOrderId(null);
    }
  }, [order.data, cashRequestedOrderId, setCashRequestedOrderId]);

  const storedPickup = order.data && shouldFetchHandover(order.data) ? getPickupOrder(order.data.id) : null;
  const handover = useQuery({
    queryKey: ["handover", order.data?.id, order.data?.status],
    enabled: Boolean(order.data && shouldFetchHandover(order.data) && storedPickup),
    queryFn: async () => {
      const current = order.data;
      const pickup = current ? getPickupOrder(current.id) : null;
      if (!current || !pickup) return null;
      const result = await guestApi.GET("/api/v1/orders/{order_id}/handover-token", {
        params: {
          path: { order_id: current.id },
          header: { "X-Order-Access-Token": pickup.accessToken },
        },
      });
      if (!result.response.ok || !result.data) return null;
      return result.data;
    },
  });

  if (!session) return null;
  if (order.isLoading) return <GuestSkeleton label={t.loading} />;
  if (order.isError) {
    return <GuestQueryError error={order.error} onRetry={() => void order.refetch()} />;
  }
  if (!order.data) {
    return (
      <div className="grid gap-4">
        <h1 className="guest-display text-3xl">{t.myTableOrders}</h1>
        <p className="text-sm text-[var(--guest-quiet)]">{t.noOrder}</p>
        <Link href="/order" className={guestPrimaryButton}>
          {t.menu}
        </Link>
      </div>
    );
  }

  const activeOrder = order.data;
  const status = activeOrder.status;
  const pending = status === "PENDING_STAFF_CONFIRMATION" || status === "DRAFT";
  const rejected = status === "CANCELLED";
  const handedOver = status === "DELIVERED" || status === "SERVED";
  const paid = activeOrder.is_paid || status === "PAID" || status === "CLOSED";
  const payAtCounter = handedOver && !paid;
  const finished = status === "CLOSED" || (handedOver && paid);
  const cashRequested = !paid && (cashRequestedOrderId === activeOrder.id || notice === t.paymentRequested);
  const canPay = PAYABLE_STATUSES.has(status) && !paid && !cashRequested && !finished && !payAtCounter;
  const current = stepIndex(status);
  const showKitchen = !rejected && !pending && !finished && !payAtCounter;
  const reference =
    activeOrder.display_number?.trim() ||
    (activeOrder.pickup_number != null ? `#${activeOrder.pickup_number}` : null) ||
    (session.tableNumber ? `${t.table} ${session.tableNumber}` : null);

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="guest-display text-3xl">{t.myTableOrders}</h1>
        {reference ? (
          <p className="text-sm text-[var(--guest-quiet)]">
            {t.orderRef} · <span className="font-medium text-[var(--guest-ink)]">{reference}</span>
          </p>
        ) : null}
      </div>

      <div
        className="guest-card px-4 py-4"
        style={{ borderInlineStartWidth: 6, borderInlineStartColor: statusTone(status) }}
      >
        {rejected ? (
          <div className="grid gap-2">
            <p className="guest-display text-2xl">{t.orderRejected}</p>
            {activeOrder.cancellation_reason ? (
              <p className="text-sm text-[var(--guest-quiet)]">{activeOrder.cancellation_reason}</p>
            ) : null}
          </div>
        ) : finished ? (
          <p className="guest-display text-2xl">{t.enjoyMeal}</p>
        ) : payAtCounter ? (
          <div className="grid gap-2">
            <p className="guest-display text-2xl">
              {t.amountDue}{" "}
              <span className="guest-price" dir="ltr">
                <Money amount={activeOrder.total_amount} locale={locale} />
              </span>
            </p>
            <p className="text-sm text-[var(--guest-quiet)]">{t.payAtCounter}</p>
          </div>
        ) : (
          <p className="guest-display text-2xl">
            {guestStatus[locale][status === "PAID" ? "DELIVERED" : status]}
          </p>
        )}
        <p className="mt-2 text-sm font-medium" style={{ color: statusTone(status) }}>
          {paid ? t.paid : t.amountDue}
        </p>
      </div>

      {pending ? <PresenceNote /> : null}

      {showKitchen ? (
        <ol className="grid gap-2">
          {STEPS.map((step, index) => {
            const reached = index <= current;
            const tone = statusTone(step);
            return (
              <li key={step} className="flex items-center gap-3 guest-card px-3 py-3">
                <span
                  className="flex size-8 shrink-0 items-center justify-center text-sm font-medium text-white"
                  style={{ background: reached ? tone : "var(--guest-line)" }}
                >
                  {index + 1}
                </span>
                <span className={reached ? "font-medium text-[var(--guest-ink)]" : "text-[var(--guest-quiet)]"}>
                  {guestStatus[locale][step]}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {(activeOrder.items ?? []).length > 0 ? (
        <ul className="grid gap-0 divide-y divide-[var(--guest-line)] border-y border-[var(--guest-line)]">
          {(activeOrder.items ?? []).map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium">
                  <span className="tabular-nums" dir="ltr">
                    {item.quantity} ×
                  </span>{" "}
                  {item.item_name}
                </p>
                <LineDetails modifiers={modifierNames(item)} note={item.special_instructions} />
              </div>
              <span className="guest-price shrink-0" dir="ltr">
                <Money amount={item.subtotal} locale={locale} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {activeOrder.customer_notes ? <LineDetails modifiers={[]} note={activeOrder.customer_notes} /> : null}

      <p className="guest-display text-2xl">
        {t.total}{" "}
        <span className="guest-price" dir="ltr">
          <Money amount={activeOrder.total_amount} locale={locale} />
        </span>
      </p>

      {handover.data ? (
        <p className="guest-card p-4 text-lg">
          {t.handover}: {handover.data.token}
        </p>
      ) : null}

      {rejected || finished || payAtCounter ? null : paid ? (
        <p role="status" className="guest-card px-4 py-3 text-sm font-medium">
          {t.paid}
        </p>
      ) : cashRequested || notice === t.paymentRequested ? (
        <p role="status" className="guest-card px-4 py-3 text-sm">
          {t.paymentRequested}
        </p>
      ) : notice ? (
        <p role="status" className="guest-card px-4 py-3 text-sm">
          {notice}
        </p>
      ) : null}

      {finished || rejected ? (
        <Link href="/order" className={guestPrimaryButton}>
          {rejected ? t.startNewOrder : t.orderElse}
        </Link>
      ) : null}

      {rejected || finished || payAtCounter ? null : (
        <div className="grid gap-2">
          {canPay ? (
            <>
              <button
                type="button"
                className={guestPrimaryButton}
                disabled={pay.isPending}
                onClick={() => pay.mutate({ method: "CASH", activeOrder })}
              >
                {pay.isPending && pay.variables?.method === "CASH" ? t.paying : t.payCash}
              </button>
              <button
                type="button"
                className={guestSecondaryButton}
                disabled={pay.isPending}
                onClick={() => pay.mutate({ method: "ONLINE_CARD", activeOrder })}
              >
                {pay.isPending && pay.variables?.method === "ONLINE_CARD" ? t.paying : t.payOnline}
              </button>
            </>
          ) : null}
          <button type="button" className={guestSecondaryButton} onClick={() => setWaiterOpen(true)}>
            {t.callWaiterTitle}
          </button>
          <button type="button" className={guestSecondaryButton} onClick={() => setBillOpen(true)}>
            {t.askBill}
          </button>
          <button
            type="button"
            className={guestSecondaryButton}
            disabled={here.isPending}
            onClick={() => here.mutate()}
          >
            {here.isPending ? t.paying : t.here}
          </button>
        </div>
      )}

      {pending ? <p className="text-sm text-[var(--guest-quiet)]">{t.payAfterConfirm}</p> : null}

      {GUEST_CANCELLABLE.has(status) ? (
        <div className="mt-2 border-t border-[var(--guest-line)] pt-4">
          <button
            type="button"
            className="min-h-12 px-3 text-sm text-[var(--guest-quiet)] underline-offset-2 hover:underline"
            onClick={() => setConfirmCancel(true)}
          >
            {t.cancelOrder}
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t.cancelTitle}
        description={t.cancelBody}
        confirmLabel={t.cancelOrder}
        cancelLabel={t.keepOrder}
        pendingLabel={t.paying}
        destructive
        pending={cancel.isPending}
        onConfirm={() => cancel.mutate(activeOrder.id)}
      />
      <WaiterSheet open={waiterOpen} onOpenChange={setWaiterOpen} />
      <BillSheet open={billOpen} onOpenChange={setBillOpen} />
    </div>
  );
}
