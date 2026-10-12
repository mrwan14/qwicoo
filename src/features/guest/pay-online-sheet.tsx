"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { Money } from "@/components/ops/money";
import { BottomSheet } from "@/features/guest/bottom-sheet";
import { guestPrimaryButton, useGuestCopy } from "@/features/guest/shell";
import { asApiError } from "@/lib/api/error";
import { guestApi } from "@/lib/api/guest";
import type { components } from "@/lib/api/schema";
import {
  amountWithinBalance,
  attemptFingerprint,
  knownPhone,
  nextPayAttempt,
  normalizePaymobPhone,
  remainingBalance,
  type PayAttempt,
} from "@/lib/paymob/checkout";
import { paymobError } from "@/lib/paymob/errors";
import { useGuest } from "@/stores/guest";

type GuestOrder = components["schemas"]["OrderResponse"];

export function PayOnlineSheet({
  open,
  onOpenChange,
  order: given,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass the order the guest is already looking at. Omit to load the active table order. */
  order?: GuestOrder | null;
}) {
  const { t, locale } = useGuestCopy();
  const session = useGuest((state) => state.session);
  const fetched = useQuery({
    queryKey: ["guest-active", session?.sessionId],
    enabled: open && given === undefined && Boolean(session),
    queryFn: async (): Promise<GuestOrder | null> => {
      const result = await guestApi.GET("/api/v1/orders/active");
      if (result.response.status === 404) return null;
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.oops, locale);
      return result.data;
    },
  });
  const order = given === undefined ? (fetched.data ?? null) : given;
  const remaining = order ? remainingBalance(order) : "0.00";
  const [amount, setAmount] = useState(remaining);
  const [phone, setPhone] = useState(order ? knownPhone(order) : "");
  const [error, setError] = useState<string | null>(null);
  const [seenOrder, setSeenOrder] = useState<string | null>(order?.id ?? null);
  const attempt = useRef<PayAttempt | null>(null);

  if (order && order.id !== seenOrder) {
    setSeenOrder(order.id);
    setAmount(remainingBalance(order));
    setPhone(knownPhone(order));
    setError(null);
    attempt.current = null;
  }

  const pay = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error(t.noOrder);
      const normalized = normalizePaymobPhone(phone);
      if (!normalized) throw new Error(t.phoneInvalid);
      const left = remainingBalance(order);
      if (!amountWithinBalance(amount, left)) throw new Error(t.amountInvalid);
      const fingerprint = attemptFingerprint({ orderId: order.id, amount: amount.trim(), phone: normalized });
      const next = nextPayAttempt(attempt.current, fingerprint, () => crypto.randomUUID());
      attempt.current = next;
      const body: components["schemas"]["PaymobIntentionRequest"] = {
        order_id: order.id,
        amount: amount.trim(),
        phone: normalized,
      };
      const result = await guestApi.POST("/api/v1/payments/paymob/intention", {
        body,
        headers: { "Idempotency-Key": next.key },
      });
      if (!result.response.ok || !result.data?.checkout_url) {
        throw paymobError(result.error, result.response, t.oops, locale);
      }
      return result.data.checkout_url;
    },
    onMutate: () => setError(null),
    onSuccess: (checkoutUrl) => {
      window.location.assign(checkoutUrl);
    },
    onError: (failure: Error) => setError(failure.message),
  });

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t.payOnlineTitle}
      footer={
        <button type="button" className={guestPrimaryButton} disabled={pay.isPending || !order || remaining === "0.00"} onClick={() => pay.mutate()}>
          {pay.isPending ? t.paying : error ? t.payRetry : t.payNow}
        </button>
      }
    >
      {given === undefined && fetched.isLoading ? (
        <p className="text-sm text-[var(--guest-quiet)]">{t.loading}</p>
      ) : order ? (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (remaining === "0.00") return;
            pay.mutate();
          }}
        >
          <p className="text-sm text-[var(--guest-quiet)]">
            {t.payRemaining.split("{amount}")[0]}
            <Money amount={remaining} currency={order.payments?.[0]?.currency ?? "EGP"} locale={locale} />
            {t.payRemaining.split("{amount}")[1]}
          </p>
          <label className="grid gap-1 text-sm font-semibold">
            {t.payAmount}
            <input
              className="guest-field"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setError(null);
              }}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {t.payPhone}
            <input
              className="guest-field"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setError(null);
              }}
            />
            <span className="text-xs font-normal text-[var(--guest-quiet)]">{t.payPhoneHint}</span>
          </label>
          {error ? (
            <p role="alert" className="text-sm text-[var(--guest-orange)]">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <p className="text-sm text-[var(--guest-quiet)]">{t.noOrder}</p>
      )}
    </BottomSheet>
  );
}
