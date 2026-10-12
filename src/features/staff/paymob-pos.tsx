"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { fetchFloorLive, floorLiveQueryKey } from "@/hooks/use-floor-live";
import { browserApi } from "@/lib/api/browser";
import { getStaffOrder } from "@/lib/api/staff-order";
import type { components } from "@/lib/api/schema";
import { formatMoney } from "@/lib/format/money";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { paymobCopy } from "@/lib/i18n/staff/paymob";
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
import { useScope } from "@/stores/scope";

const field = "h-11 w-full border border-input bg-background px-3 text-sm";

export function PaymobPosCheckout({ tableId, online }: { tableId: string; online: boolean }) {
  const branchId = useScope((state) => state.branchId);
  const { locale } = useLocale();
  const t = paymobCopy[locale];
  const floor = useQuery({
    queryKey: floorLiveQueryKey(branchId),
    enabled: online && Boolean(branchId) && Boolean(tableId),
    queryFn: () => fetchFloorLive(branchId),
  });
  const activeOrderId = floor.data?.tables.find((table) => table.table_id === tableId)?.active_order_id ?? null;
  const order = useQuery({
    queryKey: ["staff-order", activeOrderId],
    enabled: Boolean(activeOrderId),
    queryFn: () => getStaffOrder(activeOrderId ?? ""),
  });
  const loaded = order.data ?? null;
  const remaining = loaded ? remainingBalance(loaded) : "0.00";
  const currency = loaded?.payments?.[0]?.currency ?? "EGP";
  const [amount, setAmount] = useState(remaining);
  const [phone, setPhone] = useState(loaded ? knownPhone(loaded) : "");
  const [seenOrder, setSeenOrder] = useState<string | null>(loaded?.id ?? null);
  const [link, setLink] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const attempt = useRef<PayAttempt | null>(null);

  if (loaded && loaded.id !== seenOrder) {
    setSeenOrder(loaded.id);
    setAmount(remainingBalance(loaded));
    setPhone(knownPhone(loaded));
    setLink(null);
    attempt.current = null;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!link || !canvas) return;
    let cancelled = false;
    void import("qrcode").then((mod) => {
      if (cancelled) return;
      return mod.toCanvas(canvas, link, { margin: 1, width: 220 });
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [link]);

  const pay = useMutation({
    mutationFn: async () => {
      if (!loaded) throw new Error(t.noOpenOrder);
      const normalized = normalizePaymobPhone(phone);
      if (!normalized) throw new Error(t.phoneInvalid);
      const left = remainingBalance(loaded);
      if (!amountWithinBalance(amount, left)) throw new Error(t.amountInvalid);
      const fingerprint = attemptFingerprint({ orderId: loaded.id, amount: amount.trim(), phone: normalized });
      const next = nextPayAttempt(attempt.current, fingerprint, () => crypto.randomUUID());
      attempt.current = next;
      const body: components["schemas"]["PaymobIntentionRequest"] = {
        order_id: loaded.id,
        amount: amount.trim(),
        phone: normalized,
      };
      const result = await browserApi.POST("/api/v1/payments/paymob/intention", {
        body,
        headers: { "Idempotency-Key": next.key },
      });
      if (!result.response.ok || !result.data?.checkout_url) {
        throw paymobError(result.error, result.response, t.payStarting, locale);
      }
      return result.data.checkout_url;
    },
    onSuccess: (checkoutUrl) => setLink(checkoutUrl),
    onError: (error: Error) => toast.error(error.message),
  });

  if (!online || !activeOrderId) return null;

  return (
    <section className="grid w-full gap-3 border p-4">
      <div>
        <h3 className="text-sm font-semibold">{t.payTitle}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{t.payHint}</p>
      </div>
      {order.isLoading ? <p className="text-sm text-muted-foreground">{t.loading}</p> : null}
      {loaded ? (
        <>
          <p className="text-sm text-muted-foreground">{fill(t.payRemaining, { amount: formatMoney(remaining, currency, locale) })}</p>
          <label className="grid gap-1 text-sm">
            {t.payAmount}
            <input className={field} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            {t.payPhone}
            <input className={field} inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <button
            type="button"
            className="min-h-11 w-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={pay.isPending}
            onClick={() => pay.mutate()}
          >
            {pay.isPending ? t.payStarting : link ? t.payRetry : t.payStart}
          </button>
        </>
      ) : null}
      {link ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium">{t.payLink}</p>
          <p className="break-all text-sm" dir="ltr">{link}</p>
          <canvas ref={canvasRef} width={220} height={220} aria-label={t.payLink} />
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="min-h-11 border px-4 text-sm"
              onClick={() => {
                void navigator.clipboard.writeText(link).then(
                  () => toast.success(t.copied),
                  () => toast.error(t.copyFailed),
                );
              }}
            >
              {t.copy}
            </button>
            <a className="inline-flex min-h-11 items-center justify-center border px-4 text-sm" href={link} target="_blank" rel="noreferrer">
              {t.payOpen}
            </a>
          </div>
        </div>
      ) : null}
    </section>
  );
}
