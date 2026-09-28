"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { ErrorState, LoadingState } from "@/components/ops/states";
import { useGuestCopy } from "@/features/guest/shell";
import { usePollingInterval } from "@/hooks/use-page-visible";
import { asApiError } from "@/lib/api/error";
import { guestApi } from "@/lib/api/guest";
import type { components } from "@/lib/api/schema";
import { useGuest } from "@/stores/guest";

const STEPS = ["SUBMITTED", "PREPARING", "READY", "SERVED", "DELIVERED", "PAID", "CLOSED"] as const;

export function TrackScreen() {
  const { t, locale } = useGuestCopy();
  const session = useGuest((state) => state.session);
  const interval = usePollingInterval(7000);

  const order = useQuery({
    queryKey: ["guest-active", session?.sessionId],
    enabled: Boolean(session),
    refetchInterval: interval,
    queryFn: async () => {
      const result = await guestApi.GET("/api/v1/orders/active");
      if (result.response.status === 404) return null;
      if (!result.response.ok || !result.data) {
        throw asApiError(result.error, result.response, t.retry, locale);
      }
      return result.data;
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
      if (!result.response.ok) throw asApiError(result.error, result.response, t.retry, locale);
    },
    onSuccess: () => {
      toast.success(t.cancelOrder);
      void order.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const here = useMutation({
    mutationFn: async () => {
      const result = await guestApi.POST("/api/v1/sessions/verified-action");
      if (!result.response.ok) throw asApiError(result.error, result.response, t.retry, locale);
    },
    onSuccess: () => toast.success(t.here),
    onError: (error: Error) => toast.error(error.message),
  });

  const handover = useQuery({
    queryKey: ["handover", order.data?.id],
    enabled: Boolean(order.data?.id && order.data.status !== "CANCELLED"),
    queryFn: async () => {
      const result = await guestApi.GET("/api/v1/orders/{order_id}/handover-token", {
        params: { path: { order_id: order.data?.id ?? "" } },
      });
      if (!result.response.ok || !result.data) return null;
      return result.data;
    },
  });

  if (!session) return <p className="text-sm">{t.scanAgain}</p>;
  if (order.isLoading) return <LoadingState label={t.loading} />;
  if (order.isError) {
    return <ErrorState body={order.error instanceof Error ? order.error.message : t.retry} onRetry={() => void order.refetch()} />;
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

  const current = activeOrder.status;
  const stepIndex = STEPS.indexOf(current as (typeof STEPS)[number]);

  return (
    <div className="grid gap-4">
      <h1 className="text-[length:var(--text-28)] font-semibold">{t.track}</h1>
      <p className="text-[length:var(--text-20)] font-medium">{current}</p>
      <ol className="grid gap-2">
        {STEPS.map((step, index) => (
          <li key={step} className={`min-h-11 text-sm ${index <= stepIndex ? "font-semibold" : "text-muted-foreground"}`}>
            {step}
          </li>
        ))}
      </ol>
      <p className="text-lg font-semibold">
        {t.total} <Money amount={activeOrder.total_amount} locale={locale} />
      </p>
      {handover.data ? (
        <p className="rounded-xl border p-4 text-lg">
          {t.handover}: {handover.data.token}
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <Link href="/order/service" className="inline-flex min-h-14 items-center justify-center rounded-lg border text-sm font-medium">
          {t.call}
        </Link>
        <button type="button" className="min-h-14 rounded-lg border text-sm font-medium" onClick={() => here.mutate()}>
          {t.here}
        </button>
        <button
          type="button"
          className="min-h-14 rounded-lg bg-primary text-sm font-medium text-primary-foreground"
          onClick={() => void pay("CASH", activeOrder.id, activeOrder.total_amount)}
        >
          {t.payCash}
        </button>
        <button
          type="button"
          className="min-h-14 rounded-lg border text-sm font-medium"
          onClick={() => void pay("ONLINE_CARD", activeOrder.id, activeOrder.total_amount)}
        >
          {t.payOnline}
        </button>
        <button type="button" className="min-h-12 text-sm underline" onClick={() => cancel.mutate(activeOrder.id)}>
          {t.cancelOrder}
        </button>
      </div>
    </div>
  );
}

async function pay(method: components["schemas"]["PaymentMethod"], orderId: string, amount: string) {
  if (method === "CASH" || method === "CARD_TERMINAL" || method === "POS_TERMINAL") {
    const body: components["schemas"]["OfflinePaymentRequest"] = {
      order_id: orderId,
      amount,
      method,
    };
    const result = await guestApi.POST("/api/v1/payments/offline/request", { body });
    if (!result.response.ok) throw asApiError(result.error, result.response, "Payment failed");
    toast.success(result.data?.status ?? "Requested");
    return;
  }
  const body: components["schemas"]["InitiateOnlinePaymentRequest"] = {
    order_id: orderId,
    amount,
    method,
    idempotency_key: crypto.randomUUID(),
  };
  const result = await guestApi.POST("/api/v1/payments/online/initiate", { body });
  if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Payment failed");
  const link = result.data.checkout_url;
  toast.success(link ? `Checkout: ${link}` : `Payment ${result.data.status}`);
}
