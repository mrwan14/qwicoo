"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { LoadingState } from "@/components/ops/states";
import {
  clearGuestCart,
  groupCartLinesByGuest,
  removeGuestCartItem,
  submitGuestCart,
} from "@/features/guest/cart-client";
import { GuestQuoteSummary } from "@/features/guest/guest-quote-summary";
import { quotedLineSubtotal } from "@/features/guest/guest-prices";
import { resumeIfSessionGone } from "@/features/guest/session";
import { GuestQueryError, LineDetails, guestField, guestPrimaryButton, guestSecondaryButton, useGuestCopy } from "@/features/guest/shell";
import { useGuestOrderQuote, type QuoteItemInput } from "@/features/guest/use-guest-quote";
import { useSharedCart } from "@/features/guest/use-shared-cart";
import { ApiError } from "@/lib/api/error";
import { useGuest } from "@/stores/guest";
import { useOrderingPaused } from "@/features/guest/ordering-status";

export function CheckoutScreen() {
  const { t, locale } = useGuestCopy();
  const paused = useOrderingPaused();
  const session = useGuest((state) => state.session);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [promoDraft, setPromoDraft] = useState("");
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const { cart, remoteNote, noteConflict } = useSharedCart();

  const place = useMutation({
    mutationFn: async () => {
      const version = cart.data?.version ?? 1;
      return submitGuestCart(session?.sessionId ?? "", version, locale, t.oops);
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
      void resumeIfSessionGone(error).then(async (gone) => {
        if (gone) {
          if (useGuest.getState().session) place.mutate();
          return;
        }
        if (await noteConflict(error)) {
          setConfirming(false);
          toast.message(t.cartUpdated);
          return;
        }
        toast.error(error.message);
      });
    },
  });

  const clear = useMutation({
    mutationFn: async () => {
      const version = cart.data?.version ?? 1;
      return clearGuestCart(session?.sessionId ?? "", version, locale, t.oops);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["guest-cart", session?.sessionId], data);
    },
    onError: (error: Error) => {
      void noteConflict(error).then((conflict) => {
        if (conflict) toast.message(t.cartUpdated);
        else toast.error(error.message);
      });
    },
  });

  const remove = useMutation({
    mutationFn: async (cartItemId: string) => {
      const version = cart.data?.version ?? 1;
      return removeGuestCartItem(session?.sessionId ?? "", cartItemId, version, locale, t.oops);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["guest-cart", session?.sessionId], data);
    },
    onError: (error: Error) => {
      void noteConflict(error).then((conflict) => {
        if (conflict) toast.message(t.cartUpdated);
        else toast.error(error.message);
      });
    },
  });

  const lines = useMemo(() => cart.data?.items ?? [], [cart.data]);
  const groups = useMemo(() => groupCartLinesByGuest(lines), [lines]);
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

  if (confirming && lines.length > 0) {
    return (
      <div className="grid gap-4">
        <h1 className="text-[length:var(--text-28)] font-semibold">{t.confirmOrder}</h1>
        <p className="text-sm text-muted-foreground">{t.confirmOrderHint}</p>
        {remoteNote ? (
          <p role="status" className="bg-secondary px-4 py-3 text-sm">
            {t.cartUpdated}
          </p>
        ) : null}
        <ul className="grid gap-4">
          {groups.map((group) => (
            <li key={group.guestName} className="grid gap-2">
              <h2 className="font-medium">{group.guestName}</h2>
              <ul className="grid gap-2">
                {group.lines.map((line) => (
                  <li key={line.id} className="rounded-xl border p-3">
                    <p className="font-medium">
                      <span className="tabular-nums" dir="ltr">
                        {line.quantity} ×
                      </span>{" "}
                      {line.item_name}
                    </p>
                    <LineDetails modifiers={(line.modifiers ?? []).map((modifier) => modifier.name)} note={line.notes} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {quote.data ? (
          <GuestQuoteSummary
            pricing={quote.data}
            labels={{ subtotal: t.subtotal, discount: t.discount, serviceFee: t.serviceFee, tax: t.tax, total: t.total }}
            locale={locale}
            currency={quote.data.currency || "EGP"}
          />
        ) : null}
        <button
          type="button"
          className={guestPrimaryButton}
          disabled={place.isPending || !quoteReady || paused}
          onClick={() => place.mutate()}
        >
          {place.isPending ? t.paying : t.sendTableOrder}
        </button>
        <button type="button" className={guestSecondaryButton} onClick={() => setConfirming(false)}>
          {t.backToEdit}
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-[length:var(--text-28)] font-semibold">{t.checkout}</h1>
      {remoteNote ? (
        <p role="status" className="bg-secondary px-4 py-3 text-sm">
          {t.cartUpdated}
        </p>
      ) : null}
      {lines.length === 0 ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">{t.emptyCart}</p>
          <Link href="/order" className={guestPrimaryButton}>{t.backMenu}</Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {lines.map((line, index) => {
            const quoted = quotedLines[index];
            return (
            <li key={line.id} className="flex items-start justify-between gap-3 rounded-xl border p-3">
              <div className="min-w-0">
                <p className="font-medium">{line.item_name}</p>
                <p className="text-sm text-muted-foreground">
                  {line.quantity} · {line.nickname || line.guest_name}
                </p>
                <LineDetails modifiers={(line.modifiers ?? []).map((modifier) => modifier.name)} note={line.notes} />
              </div>
              <div className="grid justify-items-end gap-2">
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
                <button type="button" className="mt-2 min-h-11 rounded-xl border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => remove.mutate(line.id)}>
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
              className={guestField}
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
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
      {lines.length > 0 ? (
        <>
          <button
            type="button"
            className={guestPrimaryButton}
            disabled={!quoteReady || paused}
            onClick={() => setConfirming(true)}
          >
            {t.confirmOrder}
          </button>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href="/order" className={guestSecondaryButton}>{t.backMenu}</Link>
            <button type="button" className={guestSecondaryButton} disabled={clear.isPending} onClick={() => clear.mutate()}>
              {t.clearCart}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
