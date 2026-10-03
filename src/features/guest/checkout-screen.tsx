"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { LoadingState } from "@/components/ops/states";
import { GuestQuoteSummary } from "@/features/guest/guest-quote-summary";
import { quotedLineSubtotal } from "@/features/guest/guest-prices";
import { resumeIfSessionGone } from "@/features/guest/session";
import { GuestQueryError, LineDetails, useGuestCopy } from "@/features/guest/shell";
import { useGuestOrderQuote, type QuoteItemInput } from "@/features/guest/use-guest-quote";
import { ApiError, asApiError } from "@/lib/api/error";
import { guestApi } from "@/lib/api/guest";
import type { components } from "@/lib/api/schema";
import { useGuest } from "@/stores/guest";

export function CheckoutScreen() {
  const { t, locale } = useGuestCopy();
  const session = useGuest((state) => state.session);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [promoDraft, setPromoDraft] = useState("");
  const [promoCode, setPromoCode] = useState<string | null>(null);

  const cart = useQuery({
    queryKey: ["guest-cart", session?.sessionId],
    enabled: Boolean(session?.sessionId),
    queryFn: async () => {
      const result = await guestApi.GET("/api/v1/sessions/{session_id}/cart", {
        params: { path: { session_id: session?.sessionId ?? "" } },
      });
      if (!result.response.ok || !result.data) {
        throw asApiError(result.error, result.response, t.oops, locale);
      }
      return result.data;
    },
  });

  const place = useMutation({
    mutationFn: async () => {
      const lines = cart.data?.items ?? [];
      const body: components["schemas"]["CheckoutRequest"] = {
        customer_notes: notes || null,
        promo_code: promoCode,
        items: lines.map((line) => ({
          item_id: line.item_id,
          quantity: line.quantity,
          selected_option_ids: (line.modifiers ?? []).map((modifier) => modifier.option_id),
          special_instructions: line.notes,
        })),
      };
      const result = await guestApi.POST("/api/v1/orders/checkout", { body });
      if (!result.response.ok || !result.data) {
        throw asApiError(result.error, result.response, t.oops, locale);
      }
      return result.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["guest-cart"] });
      toast.success(t.orderSent);
      router.push("/order/track");
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.status === 409 && error.code === "ACTIVE_ORDER_EXISTS") {
        toast(t.activeOrderOpen);
        router.push("/order/track");
        return;
      }
      void resumeIfSessionGone(error).then((gone) => {
        if (gone) {
          if (useGuest.getState().session) place.mutate();
          return;
        }
        toast.error(error.message);
      });
    },
  });

  const clear = useMutation({
    mutationFn: async () => {
      const result = await guestApi.DELETE("/api/v1/sessions/{session_id}/cart", {
        params: { path: { session_id: session?.sessionId ?? "" } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.oops, locale);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["guest-cart"] }),
  });

  const remove = useMutation({
    mutationFn: async (cartItemId: string) => {
      const result = await guestApi.DELETE("/api/v1/sessions/{session_id}/cart/items/{cart_item_id}", {
        params: { path: { session_id: session?.sessionId ?? "", cart_item_id: cartItemId } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.oops, locale);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["guest-cart"] }),
  });

  const lines = useMemo(() => cart.data?.items ?? [], [cart.data]);
  const quoteItems = useMemo<QuoteItemInput[] | null>(() => {
    if (lines.length === 0) return null;
    return lines.map((line) => ({
      item_id: line.item_id,
      quantity: line.quantity,
      selected_option_ids: (line.modifiers ?? []).map((modifier) => modifier.option_id),
      special_instructions: line.notes,
    }));
  }, [lines]);
  const quote = useGuestOrderQuote(quoteItems, t.oops, promoCode);
  const quoteReady = Boolean(quote.data) && !quote.isError && !quote.isFetching;
  const quotedLines = quote.data?.items ?? [];

  if (!session) return null;
  if (cart.isLoading) return <LoadingState label={t.loading} />;
  if (cart.isError) {
    return <GuestQueryError error={cart.error} onRetry={() => void cart.refetch()} />;
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-[length:var(--text-28)] font-semibold">{t.checkout}</h1>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.emptyCart}</p>
      ) : (
        <ul className="grid gap-3">
          {lines.map((line, index) => {
            const quoted = quotedLines[index];
            return (
            <li key={line.id} className="flex items-start justify-between gap-3 rounded-xl border p-3">
              <div className="min-w-0">
                <p className="font-medium">{line.item_name}</p>
                <p className="text-sm text-muted-foreground">
                  {line.quantity} · {line.guest_name}
                </p>
                <LineDetails modifiers={(line.modifiers ?? []).map((modifier) => modifier.name)} note={line.notes} />
              </div>
              <div className="text-end">
                {quoted ? (
                  <Money
                    amount={quotedLineSubtotal({
                      unit_price: quoted.unit_price,
                      subtotal: quoted.subtotal,
                    })}
                    currency={quote.data?.currency || "EGP"}
                    locale={locale}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">{quote.isError ? t.retry : t.validate}</span>
                )}
                <button type="button" className="mt-2 block min-h-11 text-sm underline" onClick={() => remove.mutate(line.id)}>
                  {t.remove}
                </button>
              </div>
            </li>
            );
          })}
        </ul>
      )}
      {lines.length > 0 ? (
        <label className="grid gap-2 text-sm font-medium">
          {t.promo}
          <span className="flex gap-2">
            <input
              className="min-h-11 w-full rounded-lg border bg-background px-3"
              value={promoDraft}
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setPromoDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setPromoCode(promoDraft.trim() || null);
                }
              }}
            />
            <button
              type="button"
              className="min-h-11 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
              onClick={() => setPromoCode(promoDraft.trim() || null)}
            >
              {t.applyPromo}
            </button>
          </span>
          <span className="font-normal text-muted-foreground">{t.promoHint}</span>
        </label>
      ) : null}
      {lines.length > 0 && quote.isError ? (
        <p className="text-sm">{quote.error instanceof Error ? quote.error.message : t.oops}</p>
      ) : lines.length > 0 && quote.data ? (
        <GuestQuoteSummary
          pricing={quote.data}
          labels={{ subtotal: t.subtotal, discount: t.discount, serviceFee: t.serviceFee, tax: t.tax, total: t.total }}
          locale={locale}
          currency={quote.data.currency || "EGP"}
        />
      ) : lines.length > 0 ? (
        <p className="text-sm">{t.validate}</p>
      ) : null}
      <label className="grid gap-1 text-sm font-medium">
        {t.notes}
        <textarea className="min-h-20 rounded-lg border px-3 py-2" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <button
        type="button"
        className="min-h-14 rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
        disabled={lines.length === 0 || place.isPending || !quoteReady}
        onClick={() => place.mutate()}
      >
        {t.placeOrder}
      </button>
      <button type="button" className="min-h-11 text-sm underline" onClick={() => clear.mutate()}>
        {t.clearCart}
      </button>
      <Link href="/order" className="text-sm underline">
        {t.backMenu}
      </Link>
    </div>
  );
}
