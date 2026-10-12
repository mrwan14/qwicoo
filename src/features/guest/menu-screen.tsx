"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import {
  addGuestCartItem,
  isCartConflict,
  patchGuestCartItem,
  removeGuestCartItem,
  type GuestCartItem,
} from "@/features/guest/cart-client";
import { branchUnitPrice, quotedOrderTotal } from "@/features/guest/guest-prices";
import { itemNeedsOptions } from "@/features/guest/item-options";
import { ItemSheet, NicknameSheet } from "@/features/guest/item-sheet";
import { GuestReveal } from "@/features/guest/guest-motion";
import { GuestSkeleton, useOrderingPaused } from "@/features/guest/ordering-status";
import { rememberPaymobOffer, resumeIfSessionGone } from "@/features/guest/session";
import {
  GuestQueryError,
  PresenceNote,
  guestField,
  guestSecondaryButton,
  useAbsorbBranding,
  useGuestCopy,
} from "@/features/guest/shell";
import { useCartActivity } from "@/features/guest/use-cart-activity";
import { useCategoryScrollSpy } from "@/features/guest/use-category-scrollspy";
import { useGuestOrderQuote, type QuoteItemInput } from "@/features/guest/use-guest-quote";
import { useSharedCart } from "@/features/guest/use-shared-cart";
import { asApiError } from "@/lib/api/error";
import { guestApi } from "@/lib/api/guest";
import type { components } from "@/lib/api/schema";
import { pickLocale } from "@/lib/i18n/locale-text";
import { mediaUrl } from "@/lib/media";
import { useGuest } from "@/stores/guest";

type MenuItem = components["schemas"]["MenuItemResponse"];

function optionName(value: unknown, locale: "en" | "ar") {
  return pickLocale(value, locale);
}

function lineBelongsToGuest(line: GuestCartItem, guestId: string | null, guestName: string) {
  if (guestId && line.guest_id && line.guest_id === guestId) return true;
  const name = guestName.trim().toLowerCase();
  if (!name) return false;
  return (line.nickname || line.guest_name || "").trim().toLowerCase() === name;
}

function simpleLineForItem(
  items: readonly GuestCartItem[],
  itemId: string,
  guestId: string | null,
  guestName: string,
) {
  return items.find(
    (line) =>
      line.item_id === itemId &&
      lineBelongsToGuest(line, guestId, guestName) &&
      (line.modifiers?.length ?? 0) === 0,
  );
}

function matchesSearch(item: MenuItem, query: string, locale: "en" | "ar") {
  if (!query) return true;
  const name = optionName(item.name, locale).toLowerCase();
  const description = item.description ? optionName(item.description, locale).toLowerCase() : "";
  return name.includes(query) || description.includes(query);
}

export function MenuScreen() {
  const { t, locale } = useGuestCopy();
  const session = useGuest((state) => state.session);
  const guestName = useGuest((state) => state.guestName);
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingAfterName, setPendingAfterName] = useState<
    { mode: "quick"; itemId: string } | { mode: "options"; itemId: string } | null
  >(null);
  const [nameOpen, setNameOpen] = useState(false);
  const optionsTriggerRef = useRef<HTMLElement | null>(null);
  const paused = useOrderingPaused();

  const menu = useQuery({
    queryKey: ["guest-menu", session?.branchId],
    enabled: Boolean(session?.branchId),
    queryFn: async () => {
      const result = await guestApi.GET("/api/v1/menu/tree");
      if (!result.response.ok || !result.data) {
        throw asApiError(result.error, result.response, t.oops, locale);
      }
      return result.data;
    },
  });

  const branchMenu = useQuery({
    queryKey: ["guest-branch-menu", session?.branchId],
    enabled: Boolean(session?.branchId),
    queryFn: async () => {
      const result = await guestApi.GET("/api/v1/menu/branch/{branch_id}", {
        params: { path: { branch_id: session?.branchId ?? "" } },
      });
      if (!result.response.ok || !result.data) {
        throw asApiError(result.error, result.response, t.oops, locale);
      }
      return result.data;
    },
  });

  useAbsorbBranding(branchMenu.data);
  useEffect(() => {
    rememberPaymobOffer(menu.data);
    rememberPaymobOffer(branchMenu.data);
    const brandId = branchMenu.data?.brand_id;
    const current = useGuest.getState().session;
    if (brandId && current && current.branchId === branchMenu.data?.branch_id && current.brandId !== brandId) {
      useGuest.getState().setSession({ ...current, brandId });
    }
  }, [branchMenu.data, menu.data]);

  const { cart, remoteNote } = useSharedCart();
  const { flash } = useCartActivity(cart.data);

  const branchPrices = useMemo(() => {
    const prices = new Map<string, string>();
    for (const category of branchMenu.data?.categories ?? []) {
      for (const item of category.items ?? []) {
        prices.set(item.id, branchUnitPrice({ base_price: item.base_price, final_price: item.final_price }));
      }
    }
    return prices;
  }, [branchMenu.data]);

  const items = useMemo(() => {
    const list: MenuItem[] = [];
    for (const category of menu.data?.categories ?? []) {
      for (const item of category.items ?? []) list.push(item);
    }
    return list;
  }, [menu.data]);

  const query = search.trim().toLowerCase();
  const filteredCategories = useMemo(() => {
    return (menu.data?.categories ?? [])
      .map((category) => ({
        ...category,
        items: (category.items ?? []).filter((item) => matchesSearch(item, query, locale)),
      }))
      .filter((category) => (category.items?.length ?? 0) > 0);
  }, [locale, menu.data?.categories, query]);

  const categoryIds = useMemo(() => filteredCategories.map((category) => category.id), [filteredCategories]);
  const { activeId: activeCategoryId, registerTab, scrollToCategory } = useCategoryScrollSpy(categoryIds);

  const active = items.find((item) => item.id === activeId) ?? null;
  const currency = branchMenu.data?.currency || "EGP";
  const cartQuoteItems = useMemo<QuoteItemInput[] | null>(() => {
    const lines = cart.data?.items ?? [];
    if (lines.length === 0) return null;
    return lines.map((line) => ({
      item_id: line.item_id,
      quantity: line.quantity,
      selected_option_ids: (line.modifiers ?? []).map((modifier) => modifier.option_id),
      special_instructions: line.notes,
    }));
  }, [cart.data]);
  const cartQuote = useGuestOrderQuote(cartQuoteItems, t.oops);
  const cartCount = cart.data?.total_items ?? 0;

  const quickAdd = useMutation({
    mutationFn: async (item: MenuItem) => {
      const name = useGuest.getState().guestName.trim();
      const price = branchPrices.get(item.id);
      if (!price) throw new Error(t.validate);
      const body: components["schemas"]["AddCartItemRequest"] = {
        guest_name: name,
        nickname: name,
        item_id: item.id,
        item_name: optionName(item.name, locale),
        unit_price: price,
        quantity: 1,
        notes: null,
        modifiers: [],
      };
      const latest =
        queryClient.getQueryData<{ version?: number }>(["guest-cart", session?.sessionId])?.version ??
        cart.data?.version ??
        1;
      return addGuestCartItem(session?.sessionId ?? "", latest, body, locale, t.oops);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["guest-cart", session?.sessionId], data);
      toast.success(t.added);
    },
    onError: (error: Error) => {
      void resumeIfSessionGone(error).then(async (gone) => {
        if (gone) return;
        if (isCartConflict(error)) {
          await queryClient.invalidateQueries({ queryKey: ["guest-cart"] });
          toast.message(t.cartUpdated);
          return;
        }
        toast.error(error.message);
      });
    },
  });

  const adjustQty = useMutation({
    mutationFn: async ({ line, next }: { line: GuestCartItem; next: number }) => {
      const version =
        queryClient.getQueryData<{ version?: number }>(["guest-cart", session?.sessionId])?.version ??
        cart.data?.version ??
        1;
      if (next <= 0) {
        return removeGuestCartItem(session?.sessionId ?? "", line.id, version, locale, t.oops);
      }
      return patchGuestCartItem(session?.sessionId ?? "", line.id, version, next, locale, t.oops);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["guest-cart", session?.sessionId], data);
    },
    onError: (error: Error) => {
      void resumeIfSessionGone(error).then(async (gone) => {
        if (gone) return;
        if (isCartConflict(error)) {
          await queryClient.invalidateQueries({ queryKey: ["guest-cart"] });
          toast.message(t.cartUpdated);
          return;
        }
        toast.error(error.message);
      });
    },
  });

  function requireNameThen(next: { mode: "quick"; itemId: string } | { mode: "options"; itemId: string }) {
    if (guestName.trim()) {
      if (next.mode === "options") setActiveId(next.itemId);
      else {
        const item = items.find((entry) => entry.id === next.itemId);
        if (item) quickAdd.mutate(item);
      }
      return;
    }
    setPendingAfterName(next);
    setNameOpen(true);
  }

  function onNicknameSaved() {
    const pending = pendingAfterName;
    setPendingAfterName(null);
    if (!pending) return;
    if (pending.mode === "options") {
      setActiveId(pending.itemId);
      return;
    }
    const item = items.find((entry) => entry.id === pending.itemId);
    if (item) quickAdd.mutate(item);
  }

  if (!session) return null;
  if (menu.isLoading || branchMenu.isLoading) return <GuestSkeleton label={t.loading} />;
  if (menu.isError) {
    return <GuestQueryError error={menu.error} onRetry={() => void menu.refetch()} />;
  }
  if (branchMenu.isError) {
    return <GuestQueryError error={branchMenu.error} onRetry={() => void branchMenu.refetch()} />;
  }

  return (
    <div className="grid gap-0">
      <PresenceNote />
      {remoteNote ? (
        <p role="status" className="mb-3 guest-card px-4 py-3 text-sm">
          {t.cartUpdated}
        </p>
      ) : null}

      <div className="sticky top-0 z-20 -mx-4 border-b border-[var(--guest-line)] bg-[var(--guest-canvas)]/96 px-4 pb-2.5 pt-1 backdrop-blur-md">
        <label className="guest-search">
          <span className="sr-only">{t.searchMenu}</span>
          <input
            className={guestField}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.searchMenu}
            autoComplete="off"
          />
          {search ? (
            <button
              type="button"
              className="absolute end-2 top-1/2 z-10 -translate-y-1/2 px-2 text-xs font-semibold text-[var(--guest-quiet)]"
              onClick={() => setSearch("")}
            >
              {t.clearSearch}
            </button>
          ) : (
            <svg className="guest-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
              <path d="M16.2 16.2 20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </label>
        <div className="guest-cat-strip mt-2.5 flex gap-2 overflow-x-auto pb-0.5" role="tablist" aria-label={t.menu}>
          {filteredCategories.map((category) => {
            const active = activeCategoryId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={active}
                ref={(node) => registerTab(category.id, node)}
                data-active={active ? "true" : "false"}
                className="guest-cat-tab guest-motion shrink-0"
                onClick={() => scrollToCategory(category.id)}
              >
                {optionName(category.name, locale)}
              </button>
            );
          })}
        </div>
      </div>

      {filteredCategories.length === 0 ? (
        <div className="grid gap-3 py-16 text-center">
          <p className="guest-display guest-display-lg">{t.searchEmpty}</p>
          <button type="button" className={guestSecondaryButton} onClick={() => setSearch("")}>
            {t.clearSearch}
          </button>
        </div>
      ) : (
        <GuestReveal className="mt-2 grid gap-6" stagger={0.05} y={12}>
          {filteredCategories.map((category) => (
            <section
              key={category.id}
              id={`cat-${category.id}`}
              data-guest-reveal
              className="scroll-mt-36 grid gap-0"
            >
              <div className="guest-section-head">
                <h2 className="guest-display shrink-0 text-[var(--guest-ink)]">
                  {optionName(category.name, locale)}
                </h2>
              </div>
              <ul className="grid">
                {(category.items ?? []).map((item) => {
                  const image = mediaUrl(item.image_url);
                  const title = optionName(item.name, locale);
                  const description = item.description ? optionName(item.description, locale) : "";
                  const needsOptions = itemNeedsOptions(item);
                  const ownLine = simpleLineForItem(
                    cart.data?.items ?? [],
                    item.id,
                    session.guestId,
                    guestName,
                  );
                  const qty = ownLine?.quantity ?? 0;
                  const soldOut = !item.is_available;
                  return (
                    <li
                      key={item.id}
                      className="guest-menu-row"
                      data-soldout={soldOut ? "true" : "false"}
                    >
                      <div className="guest-thumb relative size-[4.5rem] shrink-0">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={image} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-xl font-extrabold text-[var(--guest-quiet)]">
                            {title.trim().charAt(0).toUpperCase()}
                          </div>
                        )}
                        {qty > 0 ? (
                          <span className="guest-pill absolute -end-1.5 -top-1.5 flex size-5 items-center justify-center bg-[var(--guest-orange)] text-[10px] font-bold text-white">
                            {qty}
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 pe-1">
                        <p className="guest-title">{title}</p>
                        {description && description !== title ? (
                          <p className="guest-body mt-0.5 line-clamp-2">{description}</p>
                        ) : null}
                      </div>
                      <div className="flex min-w-[4.75rem] shrink-0 flex-col items-end gap-1.5">
                        {soldOut ? (
                          <span className="guest-pill inline-flex bg-[var(--status-soldout-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--status-soldout)]">
                            {t.unavailable}
                          </span>
                        ) : branchPrices.get(item.id) ? (
                          <span className="guest-price text-end leading-none" dir="ltr">
                            <Money amount={branchPrices.get(item.id) ?? ""} currency={currency} locale={locale} />
                          </span>
                        ) : (
                          <span className="guest-body text-end">{t.validate}</span>
                        )}
                        {needsOptions && !soldOut ? (
                          <p className="max-w-[5.5rem] text-end text-[10px] font-semibold leading-tight text-[var(--guest-orange)]">
                            * {t.requiredOptions}
                          </p>
                        ) : null}
                        {!soldOut ? (
                          needsOptions ? (
                            <button
                              type="button"
                              className="guest-btn guest-btn-icon guest-motion"
                              aria-label={t.chooseOptions}
                              disabled={paused}
                              ref={(node) => {
                                optionsTriggerRef.current = node;
                              }}
                              onClick={() => requireNameThen({ mode: "options", itemId: item.id })}
                            >
                              +
                            </button>
                          ) : qty > 0 && ownLine ? (
                            <div className="guest-stepper">
                              <button
                                type="button"
                                aria-label={t.fewer}
                                disabled={adjustQty.isPending || paused}
                                onClick={() => adjustQty.mutate({ line: ownLine, next: qty - 1 })}
                              >
                                −
                              </button>
                              <span>{qty}</span>
                              <button
                                type="button"
                                aria-label={t.more}
                                disabled={adjustQty.isPending || paused || quickAdd.isPending}
                                onClick={() => adjustQty.mutate({ line: ownLine, next: qty + 1 })}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="guest-btn guest-btn-icon guest-motion"
                              aria-label={t.add}
                              disabled={paused || quickAdd.isPending}
                              onClick={() => requireNameThen({ mode: "quick", itemId: item.id })}
                            >
                              +
                            </button>
                          )
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </GuestReveal>
      )}

      <ItemSheet
        item={active}
        open={Boolean(active)}
        onOpenChange={(open) => {
          if (!open) {
            setActiveId(null);
            void queryClient.invalidateQueries({ queryKey: ["guest-cart"] });
            void queryClient.invalidateQueries({ queryKey: ["guest-quote"] });
          }
        }}
        currency={currency}
        branchPrice={active ? branchPrices.get(active.id) ?? null : null}
        cartVersion={cart.data?.version ?? 1}
        triggerRef={optionsTriggerRef}
      />

      <NicknameSheet
        open={nameOpen}
        onOpenChange={(open) => {
          setNameOpen(open);
          if (!open) setPendingAfterName(null);
        }}
        onSaved={onNicknameSaved}
      />

      {cartCount > 0 ? (
        <div
          className={`fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 ${
            flash ? "guest-cart-bar-flash" : ""
          }`}
        >
          <div className="guest-phone">
            <Link
              href="/order/checkout"
              className="guest-cart-bar guest-btn guest-motion gap-3 px-4 text-white"
            >
              <span className="guest-pill inline-flex size-7 items-center justify-center bg-white text-xs font-extrabold text-[var(--guest-orange)]">
                {cartCount}
              </span>
              <span className="flex-1 text-start text-sm font-bold">{t.viewTableOrder}</span>
              {cartQuote.data ? (
                <span className="text-sm font-extrabold tabular-nums" dir="ltr">
                  <Money amount={quotedOrderTotal(cartQuote.data)} currency={currency} locale={locale} />
                </span>
              ) : null}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
