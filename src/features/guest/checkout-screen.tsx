"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Minus, MoreHorizontal, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { Money } from "@/components/ops/money";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { clearGuestCart, lineBelongsToGuest, patchGuestCartItem, removeGuestCartItem, submitGuestCart, type GuestCartItem } from "@/features/guest/cart-client";
import { quotedLineSubtotal } from "@/features/guest/guest-prices";
import { GuestQuoteSummary } from "@/features/guest/guest-quote-summary";
import { OrderWaitingScene } from "@/features/guest/guest-motion";
import { GuestSkeleton, useOrderingPaused } from "@/features/guest/ordering-status";
import { resumeIfSessionGone } from "@/features/guest/session";
import { GuestQueryError, guestPrimaryButton, guestSecondaryButton, useGuestCopy } from "@/features/guest/shell";
import { useGuestThemeProps } from "@/features/guest/theme-style";
import { useGuestOrderQuote, type QuoteItemInput } from "@/features/guest/use-guest-quote";
import { latestCartVersion, useSharedCart } from "@/features/guest/use-shared-cart";
import { ApiError } from "@/lib/api/error";
import { fill } from "@/lib/i18n/dictionary";
import { useGuest } from "@/stores/guest";

type Group = { key: string; name: string; mine: boolean; lines: GuestCartItem[] };

/** One card per diner. The guest's own card comes first and shows their current name. */
function groupByGuest(lines: readonly GuestCartItem[], guestId: string | null, guestName: string, fallback: string): Group[] {
  const groups = new Map<string, Group>();
  for (const line of lines) {
    const mine = lineBelongsToGuest(line, guestId, guestName);
    const key = mine ? "me" : line.guest_id || (line.nickname || line.guest_name || fallback).trim().toLowerCase();
    const group = groups.get(key) ?? { key, name: "", mine, lines: [] };
    group.name = mine ? guestName.trim() || fallback : (line.nickname || line.guest_name || fallback).trim() || fallback;
    group.lines.push(line);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => Number(b.mine) - Number(a.mine));
}

export function CheckoutScreen() {
  const { t, locale } = useGuestCopy();
  const portalTheme = useGuestThemeProps();
  const paused = useOrderingPaused();
  const session = useGuest((state) => state.session);
  const guestName = useGuest((state) => state.guestName);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoDraft, setPromoDraft] = useState("");
  const [promoCode, setPromoCode] = useState<string | null>(null);
  // Why the last code was refused. The quote runs again without it, so the total stays on screen.
  const [promoError, setPromoError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [sent, setSent] = useState(false);
  const { cart, remoteNote, noteConflict } = useSharedCart();

  const writeCart = (data: Awaited<ReturnType<typeof removeGuestCartItem>>) =>
    queryClient.setQueryData(["guest-cart", useGuest.getState().session?.sessionId], data);
  const onCartError = (error: Error) => {
    if (error instanceof ApiError && error.code === "CART_LINE_NOT_YOURS") {
      toast.message(t.notYourItem);
      void cart.refetch();
      return;
    }
    void noteConflict(error).then((conflict) => {
      if (conflict) toast.message(t.cartUpdated);
      else toast.error(error.message);
    });
  };

  const place = useMutation({
    mutationFn: async () => {
      const version = await latestCartVersion(queryClient, locale, t.oops);
      // Send the code the quote accepted, so the order gets the discount the guest saw.
      return submitGuestCart(session?.sessionId ?? "", version, locale, t.oops, quote.data?.promo_code ?? null, note);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["guest-cart"] });
      setSent(true);
    },
    onError: (error: Error) => {
      void resumeIfSessionGone(error).then(async (gone) => {
        if (gone) {
          if (useGuest.getState().session) place.mutate();
          return;
        }
        if (await noteConflict(error)) {
          toast.message(t.cartUpdated);
          return;
        }
        toast.error(error.message);
      });
    },
  });

  const clear = useMutation({
    mutationFn: async () => clearGuestCart(session?.sessionId ?? "", await latestCartVersion(queryClient, locale, t.oops), locale, t.oops),
    onSuccess: (data) => {
      writeCart(data);
      setConfirmClear(false);
    },
    onError: onCartError,
  });

  const adjust = useMutation({
    mutationFn: async ({ line, next }: { line: GuestCartItem; next: number }) => {
      const version = await latestCartVersion(queryClient, locale, t.oops);
      if (next <= 0) return removeGuestCartItem(session?.sessionId ?? "", line.id, version, locale, t.oops);
      return patchGuestCartItem(session?.sessionId ?? "", line.id, version, next, locale, t.oops);
    },
    onSuccess: writeCart,
    onError: onCartError,
  });

  // A short "sent" moment, then the table screen, where every round and the bill live.
  useEffect(() => {
    if (!sent) return;
    const timer = window.setTimeout(() => router.replace("/order/track?sent=1"), 1600);
    return () => window.clearTimeout(timer);
  }, [sent, router]);

  const lines = useMemo(() => cart.data?.items ?? [], [cart.data]);
  const groups = useMemo(
    () => groupByGuest(lines, session?.guestId ?? null, guestName, t.defaultGuest.replace("{n}", "")),
    [guestName, lines, session?.guestId, t.defaultGuest],
  );
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
  const quoteError = quote.error;
  useEffect(() => {
    if (!promoCode || !(quoteError instanceof ApiError) || !quoteError.code?.startsWith("PROMO_")) return;
    setPromoError(quoteError.message);
    setPromoCode(null);
  }, [promoCode, quoteError]);
  const appliedPromo = quote.data?.promo_code ?? null;
  const applyPromo = () => {
    setPromoError(null);
    setPromoCode(promoDraft.trim().toUpperCase() || null);
  };
  const quoteReady = Boolean(quote.data) && !quote.isError && !quote.isFetching;
  const quotedByIndex = quote.data?.items ?? [];
  const currency = quote.data?.currency || "EGP";
  const itemCount = cart.data?.total_items ?? lines.reduce((sum, line) => sum + line.quantity, 0);

  if (!session) return null;
  if (cart.isLoading && !sent) return <GuestSkeleton label={t.loading} />;
  if (cart.isError) return <GuestQueryError error={cart.error} onRetry={() => void cart.refetch()} />;

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

  if (lines.length === 0) {
    return (
      <div className="grid justify-items-center gap-4 py-16 text-center">
        <span className="guest-join-icon">
          <Tag className="size-7" aria-hidden />
        </span>
        <div className="grid gap-1.5">
          <h1 className="guest-sheet-title">{t.cart}</h1>
          <p className="guest-body text-[15px]">{t.emptyCart}</p>
        </div>
        <Link href="/order" className={`${guestPrimaryButton} w-full`}>
          {t.backMenu}
        </Link>
      </div>
    );
  }

  function saveName() {
    const next = nameDraft.trim().slice(0, 40);
    if (next) useGuest.getState().setGuestName(next);
    setEditingName(false);
  }

  return (
    <div className="grid gap-5 pb-36">
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="flex min-w-0 items-start gap-2.5">
          <Link href="/order" className="guest-hero-btn mt-0.5 shrink-0" aria-label={t.backMenu}>
            <ArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden />
          </Link>
          <div className="min-w-0">
            <h1 className="guest-sheet-title">{t.tableOrder}</h1>
            <p className="guest-body">
              {fill(t.tableOrderMeta, {
                n: String(itemCount),
                guests: groups.length === 1 ? t.oneGuest : fill(t.manyGuests, { n: String(groups.length) }),
              })}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="guest-hero-btn shrink-0" aria-label={t.moreActions}>
            <MoreHorizontal className="size-5" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" {...portalTheme} className="guest-theme min-w-48">
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmClear(true)}>
              <Trash2 className="size-4" aria-hidden />
              {t.clearMyItems}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {remoteNote ? (
        <p role="status" className="guest-alert guest-alert-ok text-sm">
          {t.cartUpdated}
        </p>
      ) : null}

      <div className="grid gap-3">
        {groups.map((group) => (
          <section key={group.key} className="guest-list" aria-label={group.name}>
            <header className="flex items-center gap-2.5 pt-3.5 pb-1">
              <span className="guest-guest-avatar" data-mine={group.mine ? "true" : "false"} aria-hidden>
                {group.name.slice(0, 1).toUpperCase()}
              </span>
              {group.mine && editingName ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveName();
                  }}
                >
                  <input
                    autoFocus
                    className="guest-name-input"
                    value={nameDraft}
                    maxLength={40}
                    aria-label={t.yourName}
                    onChange={(event) => setNameDraft(event.target.value)}
                  />
                  <button type="submit" className="guest-chip-btn guest-chip-btn-solid">
                    {t.saveName}
                  </button>
                  <button type="button" className="guest-chip-btn" onClick={() => setEditingName(false)}>
                    {t.cancelEdit}
                  </button>
                </form>
              ) : (
                <>
                  <p className="min-w-0 flex-1 truncate font-semibold">
                    {group.name}
                    {group.mine ? <span className="guest-you">{t.you}</span> : null}
                  </p>
                  {group.mine ? (
                    <button
                      type="button"
                      className="guest-chip-btn"
                      onClick={() => {
                        setNameDraft(guestName);
                        setEditingName(true);
                      }}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      {t.changeName}
                    </button>
                  ) : null}
                </>
              )}
            </header>
            {group.lines.map((line) => {
              const index = lines.findIndex((entry) => entry.id === line.id);
              const quoted = index >= 0 ? quotedByIndex[index] : undefined;
              const extras = (line.modifiers ?? []).map((modifier) => modifier.name).filter(Boolean);
              return (
                <div key={line.id} className="guest-row" style={{ alignItems: "center" }}>
                  <div className="guest-row-text">
                    <p className="guest-row-name">
                      {!group.mine ? (
                        <span className="text-[var(--guest-quiet)]" dir="ltr">
                          {line.quantity}×{" "}
                        </span>
                      ) : null}
                      {line.item_name}
                    </p>
                    {extras.length > 0 ? <p className="guest-row-desc">{extras.join(" · ")}</p> : null}
                    {line.notes ? <p className="guest-row-desc italic">“{line.notes}”</p> : null}
                    <span className="guest-price text-[14px]" dir="ltr">
                      {quoted ? (
                        <Money amount={quotedLineSubtotal({ unit_price: quoted.unit_price, subtotal: quoted.subtotal })} currency={currency} locale={locale} />
                      ) : (
                        <span className="guest-caption">{t.pricesUpdating}</span>
                      )}
                    </span>
                  </div>
                  {group.mine ? (
                    <div className="guest-qty guest-qty-quiet">
                      <button
                        type="button"
                        aria-label={line.quantity <= 1 ? t.remove : t.fewer}
                        disabled={adjust.isPending || paused}
                        onClick={() => adjust.mutate({ line, next: line.quantity - 1 })}
                      >
                        {line.quantity <= 1 ? <Trash2 className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
                      </button>
                      <span aria-live="polite">{line.quantity}</span>
                      <button
                        type="button"
                        aria-label={t.more}
                        disabled={adjust.isPending || paused}
                        onClick={() => adjust.mutate({ line, next: line.quantity + 1 })}
                      >
                        <Plus className="size-4" aria-hidden />
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        ))}
        <Link href="/order" className="guest-add-more">
          <Plus className="size-4" aria-hidden />
          {t.addMoreItems}
        </Link>
      </div>

      <label className="grid gap-2">
        <span className="guest-title">{t.orderNoteLabel}</span>
        <textarea
          className="guest-note-field"
          value={note}
          maxLength={500}
          rows={2}
          placeholder={t.orderNotePlaceholder}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <div className="guest-list py-1">
        {appliedPromo ? (
          <div className="flex items-center justify-between gap-3 py-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--guest-brand-text)]">
              <Tag className="size-4" aria-hidden />
              {fill(t.promoApplied, { code: appliedPromo })}
            </span>
            <button
              type="button"
              className="guest-chip-btn"
              onClick={() => {
                setPromoCode(null);
                setPromoDraft("");
                setPromoError(null);
              }}
            >
              {t.removePromo}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-between gap-3 text-start text-[15px] font-semibold"
              aria-expanded={promoOpen}
              onClick={() => setPromoOpen((open) => !open)}
            >
              <span className="inline-flex items-center gap-2">
                <Tag className="size-4 text-[var(--guest-quiet)]" aria-hidden />
                {t.havePromo}
              </span>
              <ChevronDown className={`size-4 transition-transform ${promoOpen ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {promoOpen ? (
              <div className="grid gap-2 pb-3">
                <span className="flex gap-2">
                  <input
                    id="guest-promo"
                    className="guest-note-field min-h-11 min-w-0 flex-1 uppercase"
                    value={promoDraft}
                    maxLength={32}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder={t.promo}
                    aria-invalid={promoError ? true : undefined}
                    onChange={(event) => {
                      setPromoDraft(event.target.value);
                      if (promoError) setPromoError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        applyPromo();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="guest-chip-btn guest-chip-btn-solid min-h-11 px-4"
                    disabled={!promoDraft.trim() || (quote.isFetching && Boolean(promoCode))}
                    onClick={applyPromo}
                  >
                    {t.applyPromo}
                  </button>
                </span>
                {promoError ? (
                  <p role="alert" className="guest-alert guest-alert-error text-sm">
                    {promoError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      {quote.isError ? (
        <p className="guest-alert guest-alert-error text-sm">{quote.error instanceof Error ? quote.error.message : t.oops}</p>
      ) : quote.data ? (
        <div className="guest-list py-3">
          <GuestQuoteSummary
            pricing={quote.data}
            labels={{ subtotal: t.subtotal, discount: t.discount, serviceFee: t.serviceFee, tax: t.tax, total: t.total }}
            locale={locale}
            currency={currency}
          />
        </div>
      ) : (
        <p className="guest-caption">{t.pricesUpdating}</p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 px-4 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] [background:linear-gradient(to_top,var(--guest-canvas)_70%,transparent)]">
        <div className="guest-phone">
          <button
            type="button"
            className="guest-cart-bar guest-btn guest-motion w-full"
            disabled={!quoteReady || paused || place.isPending}
            onClick={() => place.mutate()}
          >
            <span className="min-w-0 flex-1 text-start ps-3 text-[16px] font-semibold">{place.isPending ? t.sending : t.sendOrder}</span>
            {quote.data ? (
              <span className="guest-price guest-cart-total" dir="ltr">
                <Money amount={quote.data.total} currency={currency} locale={locale} />
              </span>
            ) : null}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={t.clearCartTitle}
        description={t.clearCartBody}
        confirmLabel={t.clearMyItems}
        cancelLabel={t.keepItems}
        pendingLabel={t.sending}
        destructive
        pending={clear.isPending}
        onConfirm={() => clear.mutate()}
      />
    </div>
  );
}
