"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import {
  addGuestCartItem,
  isCartConflict,
  patchGuestCartItem,
  lineBelongsToGuest,
  removeGuestCartItem,
  type GuestCartItem,
} from "@/features/guest/cart-client";
import { branchUnitPrice, quotedOrderTotal } from "@/features/guest/guest-prices";
import { itemNeedsOptions } from "@/features/guest/item-options";
import { ItemSheet } from "@/features/guest/item-sheet";
import { AddControl, FeaturedCard, ItemRow, badgeLabels, isFeaturedItem } from "@/features/guest/menu-parts";
import { GuestReveal } from "@/features/guest/guest-motion";
import { GuestSkeleton, useOrderingPaused } from "@/features/guest/ordering-status";
import { JoinTableSheet, previewFromQr } from "@/features/guest/presence-form";
import { rememberPaymobOffer, resumeIfSessionGone } from "@/features/guest/session";
import {
  GuestQueryError,
  PresenceNote,
  guestSecondaryButton,
  useAbsorbBranding,
  useGuestCopy,
  useMenuChrome,
} from "@/features/guest/shell";
import { useCartActivity } from "@/features/guest/use-cart-activity";
import { useCategoryScrollSpy } from "@/features/guest/use-category-scrollspy";
import { useGuestOrderQuote, type QuoteItemInput } from "@/features/guest/use-guest-quote";
import { ensureGuestName, latestCartVersion, useSharedCart } from "@/features/guest/use-shared-cart";
import { asApiError } from "@/lib/api/error";
import { guestApi } from "@/lib/api/guest";
import type { components } from "@/lib/api/schema";
import { comboSaving } from "@/lib/combo-saving";
import { formatMoney } from "@/lib/format/money";
import { pickLocale } from "@/lib/i18n/locale-text";
import { mediaUrl } from "@/lib/media";
import { useGuest } from "@/stores/guest";

type MenuItem = components["schemas"]["MenuItemResponse"];

/** Id of the Offers section the guest menu builds from every combo. Not a real category id. */
const OFFERS_SECTION_ID = "offers";
const BEST_SECTION_ID = "best-sellers";
/** The guest row shows up to this many best sellers, and only when at least BEST_MIN are on sale. */
const BEST_MAX = 6;
const BEST_MIN = 3;

const isComboItem = (item: MenuItem) => item.item_type.toUpperCase() === "COMBO";

function optionName(value: unknown, locale: "en" | "ar") {
  return pickLocale(value, locale);
}

const qty = (line: GuestCartItem | undefined) => line?.quantity ?? 0;


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
  const optionsTriggerRef = useRef<HTMLElement | null>(null);
  const tapOrigin = useRef<{ x: number; y: number } | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const pendingJoin = useRef<{ mode: "quick"; itemId: string } | { run: () => void } | null>(null);
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

  // Before joining, the menu comes from the scanned QR (read-only, no session).
  const tableToken = useGuest((state) => state.tableToken);
  const preview = useQuery({
    queryKey: ["guest-qr-menu", tableToken, locale],
    enabled: !session && Boolean(tableToken),
    staleTime: 60_000,
    queryFn: async () => {
      const response = await fetch("/api/guest/api/v1/qr/menu", {
        method: "POST",
        headers: { "content-type": "application/json", "accept-language": locale },
        body: JSON.stringify({ token: tableToken }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw asApiError(payload, response, t.oops, locale);
      return payload as {
        branch_id: string;
        table_number: string;
        branch_name: unknown;
        tree: NonNullable<typeof menu.data>;
        branch_menu: NonNullable<typeof branchMenu.data>;
      };
    },
  });
  const menuData = menu.data ?? preview.data?.tree;
  const branchData = branchMenu.data ?? preview.data?.branch_menu;
  useEffect(() => {
    if (preview.data) useGuest.getState().setTablePreview(previewFromQr(preview.data, locale));
  }, [locale, preview.data]);

  useAbsorbBranding(branchData);
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
    for (const category of branchData?.categories ?? []) {
      for (const item of category.items ?? []) {
        prices.set(item.id, branchUnitPrice({ base_price: item.base_price, final_price: item.final_price }));
      }
    }
    return prices;
  }, [branchData]);

  const items = useMemo(() => {
    const list: MenuItem[] = [];
    for (const category of menuData?.categories ?? []) {
      for (const item of category.items ?? []) list.push(item);
    }
    return list;
  }, [menuData]);
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  // This branch's best sellers that guests can order right now, most sold first.
  const bestSellers = useMemo(
    () =>
      ((menuData as { best_seller_ids?: string[] } | undefined)?.best_seller_ids ?? [])
        .map((id) => itemsById.get(id))
        .filter((item): item is MenuItem => Boolean(item && item.is_available))
        .slice(0, BEST_MAX),
    [itemsById, menuData],
  );
  const bestIds = useMemo(() => new Set(bestSellers.map((item) => item.id)), [bestSellers]);

  const query = search.trim().toLowerCase();
  const filteredCategories = useMemo(() => {
    // Every combo is pulled into one Offers section at the top, whatever category staff filed it under.
    const offers: MenuItem[] = [];
    const regular = (menuData?.categories ?? []).map((category) => ({
      ...category,
      items: (category.items ?? []).filter((item) => {
        if (!matchesSearch(item, query, locale)) return false;
        if (isComboItem(item)) {
          offers.push(item);
          return false;
        }
        return true;
      }),
    }));
    const offersSection =
      offers.length > 0 && menuData
        ? [{ ...regular[0], id: OFFERS_SECTION_ID, branch_id: menuData.branch_id, name: t.offers, display_order: -1, image_url: null, items: offers }]
        : [];
    const bestSection =
      !query && bestSellers.length >= BEST_MIN && menuData
        ? [{ ...regular[0], id: BEST_SECTION_ID, branch_id: menuData.branch_id, name: t.bestSellers, display_order: -2, image_url: null, items: bestSellers }]
        : [];
    return [...bestSection, ...offersSection, ...regular.filter((category) => (category.items?.length ?? 0) > 0)];
  }, [bestSellers, locale, menuData, query, t.bestSellers, t.offers]);

  const categoryIds = useMemo(() => filteredCategories.map((category) => category.id), [filteredCategories]);
  const { activeId: activeCategoryId, registerTab, scrollToCategory } = useCategoryScrollSpy(categoryIds);

  const active = items.find((item) => item.id === activeId) ?? null;
  const currency = branchData?.currency || "EGP";
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
      await nameGuest();
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
      const latest = await latestCartVersion(queryClient, locale, t.oops);
      return addGuestCartItem(useGuest.getState().session?.sessionId ?? "", latest, body, locale, t.oops);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["guest-cart", useGuest.getState().session?.sessionId], data);
      // No toast: the stepper, the count and the order bar already confirm the add.
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
      const version = await latestCartVersion(queryClient, locale, t.oops);
      if (next <= 0) {
        return removeGuestCartItem(useGuest.getState().session?.sessionId ?? "", line.id, version, locale, t.oops);
      }
      return patchGuestCartItem(useGuest.getState().session?.sessionId ?? "", line.id, version, next, locale, t.oops);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["guest-cart", useGuest.getState().session?.sessionId], data);
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

  /** Browsing needs nothing; the first add asks the guest to confirm they're at the table. */
  function requireNameThen(next: { mode: "quick"; itemId: string } | { mode: "options"; itemId: string }) {
    if (!useGuest.getState().session) {
      if (next.mode === "options") {
        // Looking at an item is still browsing: open it; adding from the sheet asks to join.
        window.setTimeout(() => setActiveId(next.itemId), 0);
        return;
      }
      pendingJoin.current = next;
      window.setTimeout(() => setJoinOpen(true), 0);
      return;
    }
    nameAndGo(next);
  }

  /** No name prompt: a guest who hasn't picked a name becomes the next free "Guest N" (renamable in the cart). */
  const nameGuest = () => ensureGuestName(queryClient, locale, t.oops, t.defaultGuest);

  function nameAndGo(next: { mode: "quick"; itemId: string } | { mode: "options"; itemId: string }) {
    // Quick adds name the guest inside the mutation, after the cart has loaded.
    if (next.mode === "options") void nameGuest();
    openOrAdd(next);
  }

  /** The item sheet's add: join the table first when needed, then add with a name. */
  function beforeSheetAdd(add: () => void) {
    if (useGuest.getState().session) {
      void nameGuest().then(add);
      return;
    }
    pendingJoin.current = { run: () => void nameGuest().then(add) };
    setJoinOpen(true);
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

  if (!menuData || !branchData) {
    if (session && menu.isError) return <GuestQueryError error={menu.error} onRetry={() => void menu.refetch()} />;
    if (session && branchMenu.isError) {
      return <GuestQueryError error={branchMenu.error} onRetry={() => void branchMenu.refetch()} />;
    }
    if (!session && preview.isError) return <GuestQueryError error={preview.error} onRetry={() => void preview.refetch()} />;
    return <GuestSkeleton label={t.loading} />;
  }

  const tap = { onPointerDown: onAddPointerDown, onPointerUp: onAddPointerUp, onClick: onAddClick };
  const addLabels = { add: t.add, fewer: t.fewer, more: t.more };

  return (
    <div className="grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-0">
      <PresenceNote />
      {remoteNote ? (
        <p role="status" className="mb-3 guest-card px-4 py-3 text-sm">
          {t.cartUpdated}
        </p>
      ) : null}

      <div className="guest-menu-sticky">
        {searchOpen ? (
          <label className="guest-search-bar">
            <span className="sr-only">{t.searchMenu}</span>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-[18px] shrink-0 text-[var(--guest-quiet)]">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
              <path d="M16.2 16.2 20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t.searchMenu}
              autoComplete="off"
              enterKeyHint="search"
            />
            {search ? (
              <button type="button" className="guest-search-clear" onClick={() => setSearch("")}>
                {t.clearSearch}
              </button>
            ) : null}
          </label>
        ) : null}
        <div className="guest-cat-strip flex gap-2 overflow-x-auto" role="tablist" aria-label={t.menu}>
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
        <div className="grid justify-items-center gap-4 py-16 text-center">
          <p className="guest-title">{t.noResults.replace("{q}", search.trim())}</p>
          <button type="button" className={guestSecondaryButton} onClick={() => setSearch("")}>
            {t.clearSearch}
          </button>
        </div>
      ) : (
        <GuestReveal className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-7" stagger={0.05} y={12}>
          {filteredCategories.map((category) => {
            // Sold-out items sink to the end of their section; a "signature" item leads it.
            const list = [...(category.items ?? [])].sort((a, b) => Number(!a.is_available) - Number(!b.is_available));
            const hero =
              query || category.id === BEST_SECTION_ID ? null : list.find((item) => item.is_available && isFeaturedItem(item.dietary_badges));
            const rows = hero ? list.filter((item) => item !== hero) : list;

            const render = (item: MenuItem) => {
              const image = mediaUrl(item.image_url);
              const title = optionName(item.name, locale);
              const rawDescription = item.description ? optionName(item.description, locale) : "";
              const needsOptions = itemNeedsOptions(item);
              const ownLine = simpleLineForItem(cart.data?.items ?? [], item.id, session?.guestId ?? null, guestName);
              const ownTotal = (cart.data?.items ?? [])
                .filter((line) => line.item_id === item.id && lineBelongsToGuest(line, session?.guestId ?? null, guestName))
                .reduce((sum, line) => sum + line.quantity, 0);
              const soldOut = !item.is_available;
              const saving = comboSaving(branchPrices.get(item.id), item.combo_regular_price);
              const includes = (item.combo_items ?? [])
                .map((part) => {
                  const name = optionName(itemsById.get(part.item_id)?.name, locale);
                  return name && part.quantity > 1 ? `${part.quantity}× ${name}` : name;
                })
                .filter(Boolean)
                .join(" + ");
              const description = includes
                ? t.comboIncludes.replace("{items}", includes)
                : rawDescription && rawDescription !== title
                  ? rawDescription
                  : "";
              const deal = saving && saving.percent > 0 && !soldOut ? t.comboSave.replace("{n}", String(saving.percent)) : null;
              const price = branchPrices.get(item.id) ? (
                <span className="flex flex-wrap items-baseline gap-x-2" dir="ltr">
                  <span className="guest-price">
                    <Money amount={branchPrices.get(item.id) ?? ""} currency={currency} locale={locale} />
                  </span>
                  {saving ? (
                    <span className="guest-price-was">
                      <span className="sr-only">{t.comboWas} </span>
                      <Money amount={saving.regular} currency={currency} locale={locale} />
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="guest-caption">{t.validate}</span>
              );
              const note = saving ? (
                <p className="guest-deal-note">{t.comboSaveAmount.replace("{amount}", formatMoney(saving.saving, currency, locale))}</p>
              ) : null;
              const openSheet = () => requireNameThen({ mode: "options", itemId: item.id });
              const action = (
                <AddControl
                  qty={needsOptions ? ownTotal : qty(ownLine)}
                  disabled={paused}
                  busy={quickAdd.isPending || adjustQty.isPending}
                  labels={needsOptions ? { ...addLabels, add: t.chooseOptions } : addLabels}
                  tap={tap}
                  triggerRef={(node) => {
                    if (needsOptions && node) optionsTriggerRef.current = node;
                  }}
                  onAdd={needsOptions ? openSheet : () => requireNameThen({ mode: "quick", itemId: item.id })}
                  onLess={!needsOptions && ownLine ? () => adjustQty.mutate({ line: ownLine, next: ownLine.quantity - 1 }) : undefined}
                  onMore={!needsOptions && ownLine ? () => adjustQty.mutate({ line: ownLine, next: ownLine.quantity + 1 }) : undefined}
                />
              );
              return { image, title, description, soldOut, price, note, deal, action, openSheet };
            };

            return (
              <section key={category.id} id={`cat-${category.id}`} data-guest-reveal className="grid min-w-0 scroll-mt-[7.5rem] grid-cols-[minmax(0,1fr)] gap-3">
                <header className="guest-section-title">
                  <h2>{optionName(category.name, locale)}</h2>
                  <span>{t.itemCount.replace("{n}", String(list.length))}</span>
                </header>
                {hero
                  ? (() => {
                      const view = render(hero);
                      return (
                        <FeaturedCard
                          title={view.title}
                          description={view.description}
                          image={view.image}
                          label={t.signature}
                          price={view.price}
                          action={view.action}
                          onOpen={view.openSheet}
                        />
                      );
                    })()
                  : null}
                {rows.length > 0 ? (
                  <ul className="guest-list">
                    {rows.map((item) => {
                      const view = render(item);
                      return (
                        <ItemRow
                          key={item.id}
                          title={view.title}
                          description={view.description}
                          image={view.image}
                          badges={badgeLabels(item.dietary_badges, locale, category.id !== BEST_SECTION_ID && bestIds.has(item.id))}
                          price={view.price}
                          note={view.note}
                          deal={view.deal}
                          soldOut={view.soldOut}
                          soldOutLabel={t.soldOutToday}
                          action={view.action}
                          onOpen={view.openSheet}
                        />
                      );
                    })}
                  </ul>
                ) : null}
              </section>
            );
          })}
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
        onBeforeAdd={beforeSheetAdd}
      />

      <JoinTableSheet
        open={joinOpen}
        onOpenChange={(open) => {
          setJoinOpen(open);
          if (!open && !useGuest.getState().session) pendingJoin.current = null;
        }}
        onJoined={() => {
          const next = pendingJoin.current;
          pendingJoin.current = null;
          // Give the new session a tick to reach the queries, then do what the guest tapped.
          if (!next) return;
          window.setTimeout(() => ("run" in next ? next.run() : nameAndGo(next)), 0);
        }}
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
                {t.viewOrder}
                <ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden />
              </span>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
