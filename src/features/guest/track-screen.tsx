"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { Money } from "@/components/ops/money";
import { LoadingState } from "@/components/ops/states";
import { guestStatus, PAYABLE_STATUSES } from "@/features/guest/copy";
import { isGuestSessionGone, resumeIfSessionGone } from "@/features/guest/session";
import { GuestQueryError, LineDetails, PresenceNote, useGuestCopy } from "@/features/guest/shell";
import { usePollingInterval } from "@/hooks/use-page-visible";
import { ApiError, asApiError } from "@/lib/api/error";
import { guestApi } from "@/lib/api/guest";
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

  const handover = useQuery({
    queryKey: ["handover", order.data?.id, order.data?.status],
    enabled: Boolean(order.data && shouldFetchHandover(order.data)),
    queryFn: async () => {
      const result = await guestApi.GET("/api/v1/orders/{order_id}/handover-token", {
        params: { path: { order_id: order.data?.id ?? "" } },
      });
      if (!result.response.ok || !result.data) return null;
      return result.data;
    },
  });

  if (!session) return null;
  if (order.isLoading) return <LoadingState label={t.loading} />;
  if (order.isError) {
    return <GuestQueryError error={order.error} onRetry={() => void order.refetch()} />;
  }
  if (!order.data) {
    return (
      <div className="grid gap-3">
        <h1 className="text-[length:var(--text-28)] font-semibold">{t.track}</h1>
        <p className="text-sm text-muted-foreground">{t.noOrder}</p>
        <Link href="/order" className="text-sm underline">{t.backMenu}</Link>
      </div>
    );
  }

  const activeOrder = order.data;
  const status = activeOrder.status;
  const pending = status === "PENDING_STAFF_CONFIRMATION" || status === "DRAFT";
  const rejected = status === "CANCELLED";
  const finished = status === "CLOSED" || status === "DELIVERED";
  const paid = activeOrder.is_paid || status === "PAID" || status === "CLOSED";
  const cashRequested = !paid && (cashRequestedOrderId === activeOrder.id || notice === t.paymentRequested);
  const canPay = PAYABLE_STATUSES.has(status) && !paid && !cashRequested && !finished;
  const current = stepIndex(status);
  const showKitchen = !rejected && !pending && !finished;
  const reference =
    activeOrder.display_number?.trim() ||
    (activeOrder.pickup_number != null ? `#${activeOrder.pickup_number}` : null) ||
    (session.tableNumber ? `${t.table} ${session.tableNumber}` : null);

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-[length:var(--text-28)] font-semibold">{t.track}</h1>
        {reference ? (
          <p className="text-sm text-muted-foreground">
            {t.orderRef} · <span className="font-medium text-foreground">{reference}</span>
          </p>
        ) : null}
      </div>
      {rejected ? (
        <div className="grid gap-3 rounded-xl bg-secondary px-4 py-4">
          <p className="text-[length:var(--text-20)] font-medium">{t.orderRejected}</p>
          {activeOrder.cancellation_reason ? (
            <p className="text-sm text-muted-foreground">{activeOrder.cancellation_reason}</p>
          ) : null}
          <Link
            href="/order"
            className="inline-flex min-h-14 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            {t.startNewOrder}
          </Link>
        </div>
      ) : finished ? (
        <p className="text-[length:var(--text-20)] font-medium">{t.enjoyMeal}</p>
      ) : (
        <p className="text-[length:var(--text-20)] font-medium">{guestStatus[locale][status === "PAID" ? "DELIVERED" : status]}</p>
      )}
      {pending ? <PresenceNote /> : null}
      {showKitchen ? (
        <ol className="grid gap-2">
          {STEPS.map((step, index) => (
            <li key={step} className={`text-sm ${index <= current ? "font-semibold" : "text-muted-foreground"}`}>
              {guestStatus[locale][step]}
            </li>
          ))}
        </ol>
      ) : null}
      {(activeOrder.items ?? []).length > 0 ? (
        <ul className="grid gap-2">
          {(activeOrder.items ?? []).map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 rounded-xl border p-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {item.quantity} × {item.item_name}
                </p>
                <LineDetails modifiers={modifierNames(item)} note={item.special_instructions} />
              </div>
              <Money amount={item.subtotal} locale={locale} />
            </li>
          ))}
        </ul>
      ) : null}
      {activeOrder.customer_notes ? <LineDetails modifiers={[]} note={activeOrder.customer_notes} /> : null}
      <p className="text-lg font-semibold">
        {t.total} <Money amount={activeOrder.total_amount} locale={locale} />
      </p>
      {handover.data ? (
        <p className="rounded-xl border p-4 text-lg">
          {t.handover}: {handover.data.token}
        </p>
      ) : null}
      {rejected || finished ? null : paid ? (
        <p role="status" className="rounded-xl bg-secondary px-4 py-3 text-sm font-medium">
          {t.paid}
        </p>
      ) : cashRequested || notice === t.paymentRequested ? (
        <p role="status" className="rounded-xl bg-secondary px-4 py-3 text-sm">
          {t.paymentRequested}
        </p>
      ) : notice ? (
        <p role="status" className="rounded-xl bg-secondary px-4 py-3 text-sm">
          {notice}
        </p>
      ) : null}
      {finished ? (
        <Link
          href="/order"
          className="inline-flex min-h-14 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          {t.orderElse}
        </Link>
      ) : null}
      {rejected || finished ? null : (
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href="/order/service" className="inline-flex min-h-14 items-center justify-center rounded-lg border text-sm font-medium">
            {t.call}
          </Link>
          <button
            type="button"
            className="min-h-14 rounded-lg border text-sm font-medium disabled:opacity-50"
            disabled={here.isPending}
            onClick={() => here.mutate()}
          >
            {t.here}
          </button>
          {canPay ? (
            <>
              <button
                type="button"
                className="min-h-14 rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
                disabled={pay.isPending}
                onClick={() => pay.mutate({ method: "CASH", activeOrder })}
              >
                {pay.isPending && pay.variables?.method === "CASH" ? t.paying : t.payCash}
              </button>
              <button
                type="button"
                className="min-h-14 rounded-lg border text-sm font-medium disabled:opacity-50"
                disabled={pay.isPending}
                onClick={() => pay.mutate({ method: "ONLINE_CARD", activeOrder })}
              >
                {pay.isPending && pay.variables?.method === "ONLINE_CARD" ? t.paying : t.payOnline}
              </button>
            </>
          ) : null}
        </div>
      )}
      {pending ? <p className="text-sm text-muted-foreground">{t.payAfterConfirm}</p> : null}
      {GUEST_CANCELLABLE.has(status) ? (
        <div className="mt-4 border-t pt-4">
          <button type="button" className="min-h-11 text-sm text-muted-foreground underline" onClick={() => setConfirmCancel(true)}>
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
    </div>
  );
}
