"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Coffee, Croissant, Flame, Leaf, Plus, Sandwich, ShoppingBag, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
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
  useMenuChrome,
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

/** Painted on the element so the circle stays visible even if a width rule clips it. */
function guestAddStyle(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    padding: 0,
    border: "none",
    borderRadius: 999,
    background: disabled ? "var(--guest-tint)" : "var(--guest-orange)",
    color: disabled ? "var(--guest-faint)" : "var(--guest-on-accent)",
    boxShadow: disabled ? "none" : "0 6px 14px color-mix(in srgb, var(--guest-orange) 35%, transparent)",
    fontSize: 24,
    lineHeight: 1,
    flexShrink: 0,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

const ROW_TONES = [
  { bg: "var(--guest-success-soft)", color: "var(--guest-sage)", Icon: Leaf },
  { bg: "var(--guest-orange-soft)", color: "var(--guest-orange)", Icon: Croissant },
  { bg: "var(--guest-tint)", color: "var(--guest-quiet)", Icon: Sandwich },
] as const;

function rowTone(index: number, soldOut: boolean) {
  if (soldOut) return { bg: "var(--guest-tint)", color: "var(--guest-faint)", Icon: Sandwich };
  return ROW_TONES[index % ROW_TONES.length];
}

function itemBadge(item: MenuItem): "popular" | "fresh" | null {
  const extra = item as MenuItem & { tags?: string[] | null; dietary_badges?: string[] | null };
  const tags = [...(extra.tags ?? []), ...(extra.dietary_badges ?? [])].map((tag) => tag.toLowerCase());
  if (tags.some((tag) => tag.includes("popular") || tag.includes("best"))) return "popular";
  if (tags.some((tag) => tag === "new" || tag.includes("fresh"))) return "fresh";
  return null;
}

function DishCard({
  featured,
  soldOut,
  image,
  title,
  description,
  badge,
  signature,
  popular,
  fresh,
  price,
  qty,
  tone,
  action,
}: {
  featured: boolean;
  soldOut: boolean;
  image: string | null;
  title: string;
  description: string;
  badge: "popular" | "fresh" | null;
  signature: string;
  popular: string;
  fresh: string;
  price: ReactNode;
  qty: number;
  tone: { bg: string; color: string; Icon: LucideIcon };
  action: ReactNode;
}) {
  const qtyMark =
    qty > 0 ? (
      <span className="guest-pill absolute end-2.5 top-2.5 z-10 flex size-5 items-center justify-center bg-[var(--guest-orange)] text-[10px] font-bold text-white">
        {qty}
      </span>
    ) : null;
  if (featured) {
    return (
      <li className="guest-item-card" data-featured="true" data-soldout={soldOut ? "true" : "false"}>
        <div className="guest-feature-media">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <Coffee className="size-11" aria-hidden />
          )}
          <span className="guest-badge guest-badge-signature absolute start-2.5 top-2.5">★ {signature}</span>
          {qtyMark}
        </div>
        <div className="guest-feature-body">
          <p className="guest-feature-title">{title}</p>
          {description ? <p className="guest-row-copy line-clamp-2">{description}</p> : null}
          <div className="mt-1 flex items-center justify-between gap-3">
            <div className="min-w-0">{price}</div>
            {action}
          </div>
        </div>
      </li>
    );
  }
  const Icon = tone.Icon;
  return (
    <li className="guest-item-card" data-soldout={soldOut ? "true" : "false"}>
      <div className="guest-thumb relative size-[84px] shrink-0" style={{ background: tone.bg, color: tone.color }}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="size-full object-cover" />
        ) : (
          <Icon className="size-7" aria-hidden />
        )}
        {qty > 0 ? (
          <span className="guest-pill absolute -end-1.5 -top-1.5 z-10 flex size-5 items-center justify-center bg-[var(--guest-orange)] text-[10px] font-bold text-white">
            {qty}
          </span>
        ) : null}
      </div>
      <div className="guest-item-copy grid gap-1">
        <p className="guest-row-title">{title}</p>
        {description ? <p className="guest-row-copy line-clamp-2">{description}</p> : null}
        {badge === "popular" ? (
          <span className="guest-badge guest-badge-popular w-fit">
            <Flame className="size-2.5" aria-hidden />
            {popular}
          </span>
        ) : null}
        {badge === "fresh" ? <span className="guest-badge guest-badge-fresh w-fit">{fresh}</span> : null}
        {price}
      </div>
      {action}
    </li>
  );
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
  const { searchOpen } = useMenuChrome();
  const session = useGuest((state) => state.session);
  const guestName = useGuest((state) => state.guestName);
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [pendingAfterName, setPendingAfterName] = useState<
    { mode: "quick"; itemId: string } | { mode: "options"; itemId: string } | null
  >(null);
  const [nameOpen, setNameOpen] = useState(false);
  const optionsTriggerRef = useRef<HTMLElement | null>(null);
  const pendingRef = useRef<{ mode: "quick"; itemId: string } | { mode: "options"; itemId: string } | null>(null);
  const savingName = useRef(false);
  const tapOrigin = useRef<{ x: number; y: number } | null>(null);
  const tapStamp = useRef(0);
  const paused = useOrderingPaused();

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
    else setSearch("");
  }, [searchOpen]);

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

  function openOrAdd(next: { mode: "quick"; itemId: string } | { mode: "options"; itemId: string }) {
    if (next.mode === "options") {
      // Wait until this tap finishes, or the sheet treats it as a tap outside and closes.
      window.setTimeout(() => setActiveId(next.itemId), 0);
      return;
    }
    const item = items.find((entry) => entry.id === next.itemId);
    if (item) quickAdd.mutate(item);
  }

  function requireNameThen(next: { mode: "quick"; itemId: string } | { mode: "options"; itemId: string }) {
    if (guestName.trim()) {
      openOrAdd(next);
      return;
    }
    pendingRef.current = next;
    setPendingAfterName(next);
    window.setTimeout(() => setNameOpen(true), 0);
  }

  function onNicknameSaved() {
    savingName.current = true;
    const pending = pendingRef.current ?? pendingAfterName;
    pendingRef.current = null;
    setPendingAfterName(null);
    if (!pending) return;
    openOrAdd(pending);
  }

  function onAddPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.disabled) return;
    tapOrigin.current = { x: event.clientX, y: event.clientY };
  }

  function onAddPointerUp(event: ReactPointerEvent<HTMLButtonElement>, run: () => void) {
    if (event.currentTarget.disabled) return;
    const origin = tapOrigin.current;
    tapOrigin.current = null;
    if (!origin) return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 16) return;
    const now = performance.now();
    if (now - tapStamp.current < 450) return;
    tapStamp.current = now;
    run();
  }

  function onAddClick(event: React.MouseEvent<HTMLButtonElement>, run: () => void) {
    event.preventDefault();
    const now = performance.now();
    if (now - tapStamp.current < 450) return;
    tapStamp.current = now;
    run();
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
    <div className="grid min-w-0 max-w-full gap-0">
      <PresenceNote />
      {remoteNote ? (
        <p role="status" className="mb-3 guest-card px-4 py-3 text-sm">
          {t.cartUpdated}
        </p>
      ) : null}

      {!searchOpen && !query ? (
        <div className="guest-promo">
          <span className="guest-promo-icon" aria-hidden>
            <Sparkles className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold leading-4">{t.promoTitle}</span>
            <span className="mt-0.5 block truncate text-[11px] leading-[13px] text-[var(--guest-quiet)]">{t.promoBody}</span>
          </span>
          <ChevronRight className="size-[18px] shrink-0 rtl:-scale-x-100" aria-hidden />
        </div>
      ) : null}

      <div className="sticky top-0 z-20 -mx-5 min-w-0 max-w-[calc(100%+2.5rem)] bg-[var(--guest-canvas)] px-5 pb-2 pt-2">
        {searchOpen ? (
          <label className="guest-search mb-2.5 block">
            <span className="sr-only">{t.searchMenu}</span>
            <input
              ref={searchRef}
              className={guestField}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t.searchMenu}
              autoComplete="off"
            />
            {search ? (
              <button
                type="button"
                className="absolute end-1 top-1/2 z-10 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center px-3 text-xs font-semibold text-[var(--guest-quiet)]"
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
        ) : null}
        <div className="guest-cat-strip flex gap-2.5 overflow-x-auto" role="tablist" aria-label={t.menu}>
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
        <GuestReveal className="mt-3 grid gap-3.5" stagger={0.05} y={12}>
          {filteredCategories.map((category) => (
            <section
              key={category.id}
              id={`cat-${category.id}`}
              data-guest-reveal
              className="scroll-mt-16 grid gap-3.5"
            >
              <h2 className="sr-only">{optionName(category.name, locale)}</h2>
              <ul className="grid gap-3.5">
                {(category.items ?? []).map((item, itemIndex) => {
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
                  const featured =
                    !query &&
                    category.id === filteredCategories[0]?.id &&
                    item.is_available &&
                    item.id === (filteredCategories[0]?.items ?? []).find((entry) => entry.is_available)?.id;
                  const price = (
                    <>
                      {branchPrices.get(item.id) ? (
                        <p
                          className={
                            featured
                              ? "guest-price guest-price-accent text-base leading-none"
                              : "guest-price guest-row-price leading-none"
                          }
                          dir="ltr"
                        >
                          <Money amount={branchPrices.get(item.id) ?? ""} currency={currency} locale={locale} />
                        </p>
                      ) : (
                        <p className="guest-caption">{t.validate}</p>
                      )}
                      {needsOptions && !soldOut ? (
                        <p className="guest-caption mt-1 text-[var(--guest-orange-deep)]">* {t.requiredOptions}</p>
                      ) : null}
                    </>
                  );
                  const action = soldOut ? (
                    <span className="guest-badge guest-badge-soldout shrink-0">{t.unavailable}</span>
                  ) : (
                    <div className="guest-item-action">
                              {needsOptions ? (
                                <button
                                  type="button"
                                  className="guest-add guest-motion"
                                  style={guestAddStyle(paused)}
                                  aria-label={t.chooseOptions}
                                  disabled={paused}
                                  ref={(node) => {
                                    optionsTriggerRef.current = node;
                                  }}
                                  onPointerDown={onAddPointerDown}
                                  onPointerUp={(event) =>
                                    onAddPointerUp(event, () => requireNameThen({ mode: "options", itemId: item.id }))
                                  }
                                  onClick={(event) =>
                                    onAddClick(event, () => requireNameThen({ mode: "options", itemId: item.id }))
                                  }
                                >
                                  <Plus className="size-5" aria-hidden />
                                </button>
                              ) : qty > 0 && ownLine ? (
                                <div className="guest-stepper">
                                  <button
                                    type="button"
                                    aria-label={t.fewer}
                                    disabled={adjustQty.isPending || paused}
                                    onPointerDown={onAddPointerDown}
                                    onPointerUp={(event) =>
                                      onAddPointerUp(event, () => adjustQty.mutate({ line: ownLine, next: qty - 1 }))
                                    }
                                    onClick={(event) =>
                                      onAddClick(event, () => adjustQty.mutate({ line: ownLine, next: qty - 1 }))
                                    }
                                  >
                                    −
                                  </button>
                                  <span>{qty}</span>
                                  <button
                                    type="button"
                                    aria-label={t.more}
                                    disabled={adjustQty.isPending || paused || quickAdd.isPending}
                                    onPointerDown={onAddPointerDown}
                                    onPointerUp={(event) =>
                                      onAddPointerUp(event, () => adjustQty.mutate({ line: ownLine, next: qty + 1 }))
                                    }
                                    onClick={(event) =>
                                      onAddClick(event, () => adjustQty.mutate({ line: ownLine, next: qty + 1 }))
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="guest-add guest-motion"
                                  style={guestAddStyle(paused || quickAdd.isPending)}
                                  aria-label={t.add}
                                  disabled={paused || quickAdd.isPending}
                                  onPointerDown={onAddPointerDown}
                                  onPointerUp={(event) =>
                                    onAddPointerUp(event, () => requireNameThen({ mode: "quick", itemId: item.id }))
                                  }
                                  onClick={(event) =>
                                    onAddClick(event, () => requireNameThen({ mode: "quick", itemId: item.id }))
                                  }
                                >
                                  <Plus className="size-5" aria-hidden />
                                </button>
                              )}
                    </div>
                  );
                  return (
                    <DishCard
                      key={item.id}
                      featured={Boolean(featured)}
                      soldOut={soldOut}
                      image={image}
                      title={title}
                      description={description && description !== title ? description : ""}
                      badge={featured ? null : itemBadge(item)}
                      signature={t.signature}
                      popular={t.popular}
                      fresh={t.fresh}
                      price={price}
                      qty={qty}
                      tone={rowTone(itemIndex, soldOut)}
                      action={action}
                    />
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
          if (!open && !savingName.current) {
            pendingRef.current = null;
            setPendingAfterName(null);
          }
          savingName.current = false;
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
              className="guest-cart-bar guest-btn guest-motion w-full max-w-full"
            >
              <span className="guest-cart-chip" aria-hidden>
                <ShoppingBag className="size-4" />
              </span>
              <span className="min-w-0 flex-1 text-start">
                <span className="guest-cart-meta">{t.cartCount.replace("{n}", String(cartCount))}</span>
                {cartQuote.data ? (
                  <span className="guest-price guest-cart-total" dir="ltr">
                    <Money amount={quotedOrderTotal(cartQuote.data)} currency={currency} locale={locale} />
                  </span>
                ) : null}
              </span>
              <span className="guest-cart-go text-sm font-semibold">
                {t.viewCart}
                <ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden />
              </span>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
