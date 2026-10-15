"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import {
  clearGuestCart,
  groupCartLinesByGuest,
  patchGuestCartItem,
  removeGuestCartItem,
  submitGuestCart,
  type GuestCartItem,
} from "@/features/guest/cart-client";
import { quotedLineSubtotal } from "@/features/guest/guest-prices";
import { GuestQuoteSummary } from "@/features/guest/guest-quote-summary";
import { OrderWaitingScene } from "@/features/guest/guest-motion";
import { GuestSkeleton, useOrderingPaused } from "@/features/guest/ordering-status";
import { resumeIfSessionGone } from "@/features/guest/session";
import {
  GuestQueryError,
  LineDetails,
  guestField,
  guestPrimaryButton,
  guestSecondaryButton,
  useGuestCopy,
} from "@/features/guest/shell";
import { useGuestOrderQuote, type QuoteItemInput } from "@/features/guest/use-guest-quote";
import { useSharedCart } from "@/features/guest/use-shared-cart";
import { ApiError } from "@/lib/api/error";
import { useGuest } from "@/stores/guest";

function lineIsMine(line: GuestCartItem, guestId: string | null, guestName: string) {
  if (guestId && line.guest_id && line.guest_id === guestId) return true;
  const name = guestName.trim().toLowerCase();
  if (!name) return false;
  return (line.nickname || line.guest_name || "").trim().toLowerCase() === name;
}

export function CheckoutScreen() {
  const { t, locale } = useGuestCopy();
  const paused = useOrderingPaused();
  const session = useGuest((state) => state.session);
  const guestName = useGuest((state) => state.guestName);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [promoDraft, setPromoDraft] = useState("");
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState(false);
  const { cart, remoteNote, noteConflict } = useSharedCart();

  const place = useMutation({
    mutationFn: async () => {
      const version = cart.data?.version ?? 1;
      return submitGuestCart(session?.sessionId ?? "", version, locale, t.oops);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["guest-cart"] });
      setSent(true);
      setConfirming(false);
      toast.success(t.sentToKitchen);
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

  const adjust = useMutation({
    mutationFn: async ({ line, next }: { line: GuestCartItem; next: number }) => {
      const version = cart.data?.version ?? 1;
      if (next <= 0) {
        return removeGuestCartItem(session?.sessionId ?? "", line.id, version, locale, t.oops);
      }
      return patchGuestCartItem(session?.sessionId ?? "", line.id, version, next, locale, t.oops);
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
  const quotedByIndex = quote.data?.items ?? [];
  const currency = quote.data?.currency || "EGP";

  if (!session) return null;
  if (cart.isLoading) return <GuestSkeleton label={t.loading} />;
  if (cart.isError) {
    return <GuestQueryError error={cart.error} onRetry={() => void cart.refetch()} />;
  }

  if (sent) {
    return (
      <OrderWaitingScene mode="sent" title={t.sentToKitchen} body={t.orderSent}>
        <Link href="/order/track" className={guestPrimaryButton}>
          {t.myTableOrders}
        </Link>
        <Link href="/order" className={guestSecondaryButton}>
          {t.addMore}
        </Link>
      </OrderWaitingScene>
    );
  }

  if (confirming && lines.length > 0) {
    return (
      <div className="grid gap-4 pb-28">
        <h1 className="guest-display guest-display-lg">{t.confirmOrder}</h1>
        <p className="guest-body">{t.confirmOrderHint}</p>
        {remoteNote ? (
          <p role="status" className="guest-card px-4 py-3 text-sm">
            {t.cartUpdated}
          </p>
        ) : null}
        <ul className="grid gap-4">
          {groups.map((group) => (
            <li key={group.guestName} className="grid gap-2 guest-card p-3">
              <h2 className="guest-display text-xl">{group.guestName}</h2>
              <ul className="grid gap-2">
                {group.lines.map((line) => (
                  <li key={line.id} className="border-t border-[var(--guest-line)] pt-2">
                    <p className="font-medium">
                      <span className="tabular-nums" dir="ltr">
                        {line.quantity} ×
                      </span>{" "}
                      {line.item_name}
                    </p>
                    <LineDetails
                      modifiers={(line.modifiers ?? []).map((modifier) => modifier.name)}
                      note={line.notes}
                    />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {quote.data ? (
          <GuestQuoteSummary
            pricing={quote.data}
            labels={{
              subtotal: t.subtotal,
              discount: t.discount,
              serviceFee: t.serviceFee,
              tax: t.tax,
              total: t.total,
            }}
            locale={locale}
            currency={currency}
          />
        ) : null}
        <div className="fixed inset-x-0 bottom-0 z-30 bg-[var(--guest-canvas)] px-5 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="guest-phone grid gap-2">
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
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="grid gap-4 py-10 text-center">
        <div className="grid gap-2">
          <h1 className="guest-display guest-display-lg">{t.cart}</h1>
          <p className="guest-body">{t.emptyCart}</p>
        </div>
        <Link href="/order" className={guestPrimaryButton}>
          {t.backMenu}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 pb-28">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="guest-display text-3xl">{t.checkout}</h1>
          <p className="text-sm text-[var(--guest-quiet)]">
            {cart.data?.total_items ?? lines.length} · {t.viewTableOrder}
          </p>
        </div>
        {quote.data ? (
          <span className="guest-price text-lg" dir="ltr">
            <Money amount={quote.data.total} currency={currency} locale={locale} />
          </span>
        ) : null}
      </div>

      {remoteNote ? (
        <p role="status" className="guest-card px-4 py-3 text-sm">
          {t.cartUpdated}
        </p>
      ) : null}

      <ul className="grid gap-6">
        {groups.map((group) => (
          <li key={group.guestName} className="grid gap-3">
            <h2 className="guest-display text-xl text-[var(--guest-ink)]">{group.guestName}</h2>
            <ul className="grid gap-3">
              {group.lines.map((line) => {
                const index = lines.findIndex((entry) => entry.id === line.id);
                const quoted = index >= 0 ? quotedByIndex[index] : undefined;
                const mine = lineIsMine(line, session.guestId, guestName);
                return (
                  <li key={line.id} className="guest-card grid gap-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{line.item_name}</p>
                        <LineDetails
                          modifiers={(line.modifiers ?? []).map((modifier) => modifier.name)}
                          note={line.notes}
                        />
                      </div>
                      {quoted ? (
                        <span className="guest-price shrink-0" dir="ltr">
                          <Money
                            amount={quotedLineSubtotal({
                              unit_price: quoted.unit_price,
                              subtotal: quoted.subtotal,
                            })}
                            currency={currency}
                            locale={locale}
                          />
                        </span>
                      ) : (
                        <span className="text-sm text-[var(--guest-quiet)]">
                          {quote.isError ? t.retry : t.validate}
                        </span>
                      )}
                    </div>
                    {mine ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="guest-stepper">
                          <button
                            type="button"
                            aria-label={t.fewer}
                            disabled={adjust.isPending || paused}
                            onClick={() => adjust.mutate({ line, next: line.quantity - 1 })}
                          >
                            −
                          </button>
                          <span>{line.quantity}</span>
                          <button
                            type="button"
                            aria-label={t.more}
                            disabled={adjust.isPending || paused}
                            onClick={() => adjust.mutate({ line, next: line.quantity + 1 })}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className="guest-btn guest-btn-ghost guest-motion"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(line.id)}
                        >
                          {t.remove}
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--guest-quiet)]">
                        <span className="tabular-nums" dir="ltr">
                          × {line.quantity}
                        </span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      <label className="grid gap-2 guest-title">
        {t.promo}
        <span className="flex gap-2">
          <input
            className={`${guestField} min-w-0 flex-1`}
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
            className="guest-btn guest-btn-primary guest-motion !w-auto shrink-0 !px-4"
            onClick={() => setPromoCode(promoDraft.trim() || null)}
          >
            {t.applyPromo}
          </button>
        </span>
        <span className="guest-body font-normal">{t.promoHint}</span>
      </label>

      {quote.isError ? (
        <p className="guest-alert guest-alert-error text-sm">{quote.error instanceof Error ? quote.error.message : t.oops}</p>
      ) : quote.data ? (
        <div className="guest-card p-4">
          <h2 className="guest-display text-xl">{t.total}</h2>
          <div className="mt-3">
            <GuestQuoteSummary
              pricing={quote.data}
              labels={{
                subtotal: t.subtotal,
                discount: t.discount,
                serviceFee: t.serviceFee,
                tax: t.tax,
                total: t.total,
              }}
              locale={locale}
              currency={currency}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm">{t.validate}</p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 bg-[var(--guest-canvas)] px-5 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="guest-phone grid gap-2">
          <button
            type="button"
            className={guestPrimaryButton}
            disabled={!quoteReady || paused}
            onClick={() => setConfirming(true)}
          >
            {t.confirmOrder}
            {quote.data ? (
              <span className="ms-2 guest-price text-white" dir="ltr">
                <Money amount={quote.data.total} currency={currency} locale={locale} />
              </span>
            ) : null}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/order" className={guestSecondaryButton}>
              {t.backMenu}
            </Link>
            <button
              type="button"
              className={guestSecondaryButton}
              disabled={clear.isPending}
              onClick={() => clear.mutate()}
            >
              {t.clearCart}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
