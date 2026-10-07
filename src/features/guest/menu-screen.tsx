"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { resumeIfSessionGone } from "@/features/guest/session";
import { GuestQueryError, PresenceNote, guestField, guestPrimaryButton, guestSecondaryButton, useAbsorbBranding, useGuestCopy } from "@/features/guest/shell";
import { Money } from "@/components/ops/money";
import { LoadingState } from "@/components/ops/states";
import { GuestQuoteSummary } from "@/features/guest/guest-quote-summary";
import { branchUnitPrice, quotedOrderTotal } from "@/features/guest/guest-prices";
import { useGuestOrderQuote, type QuoteItemInput } from "@/features/guest/use-guest-quote";
import { asApiError } from "@/lib/api/error";
import { guestApi } from "@/lib/api/guest";
import { pickLocale } from "@/lib/i18n/locale-text";
import { mediaUrl } from "@/lib/media";
import type { components } from "@/lib/api/schema";
import { useGuest } from "@/stores/guest";

type MenuItem = components["schemas"]["MenuItemResponse"];
type ModifierGroup = components["schemas"]["ModifierGroupResponse"];
type Validated = components["schemas"]["ValidatedItemSelectionResponse"];

function optionName(value: unknown, locale: "en" | "ar") {
  return pickLocale(value, locale);
}

export function MenuScreen() {
  const { t, locale } = useGuestCopy();
  const session = useGuest((state) => state.session);
  const guestName = useGuest((state) => state.guestName);
  const setGuestName = useGuest((state) => state.setGuestName);
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

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
    const brandId = branchMenu.data?.brand_id;
    const current = useGuest.getState().session;
    if (brandId && current && current.branchId === branchMenu.data?.branch_id && current.brandId !== brandId) {
      useGuest.getState().setSession({ ...current, brandId });
    }
  }, [branchMenu.data]);

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

  if (!session) return null;
  if (menu.isLoading || branchMenu.isLoading) return <LoadingState label={t.loading} />;
  if (menu.isError) {
    return <GuestQueryError error={menu.error} onRetry={() => void menu.refetch()} />;
  }
  if (branchMenu.isError) {
    return <GuestQueryError error={branchMenu.error} onRetry={() => void branchMenu.refetch()} />;
  }

  return (
    <div className="grid gap-4">
      <PresenceNote />
      <label className="grid gap-1 text-sm font-medium">
        {t.yourName}
        <input
          className={guestField}
          autoComplete="name"
          value={guestName}
          onChange={(event) => setGuestName(event.target.value)}
        />
        <span className="font-normal text-muted-foreground">{t.nameHint}</span>
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(menu.data?.categories ?? []).map((category) => {
          const image = mediaUrl(category.image_url);
          return (
          <a
            key={category.id}
            href={`#cat-${category.id}`}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="size-8 shrink-0 rounded-lg bg-secondary object-contain" />
            ) : null}
            {optionName(category.name, locale)}
          </a>
          );
        })}
      </div>
      {(menu.data?.categories ?? []).map((category) => (
        <section key={category.id} id={`cat-${category.id}`} className="grid scroll-mt-4 gap-3">
          <h2 className="font-display text-[length:var(--text-20)]">
            {optionName(category.name, locale)}
          </h2>
          {mediaUrl(category.image_url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(category.image_url) ?? ""} alt="" className="h-40 w-full rounded-2xl bg-secondary object-contain" />
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {(category.items ?? []).map((item) => {
              const image = mediaUrl(item.image_url);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.is_available}
                  onClick={() => setActiveId(item.id)}
                  className="flex min-h-24 overflow-hidden rounded-2xl bg-card text-start shadow-elev-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-70"
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" className="h-24 w-24 shrink-0 bg-secondary object-contain" />
                  ) : (
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center bg-secondary text-2xl font-semibold text-primary">
                      {optionName(item.name, locale).trim().charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-3">
                    <span className="font-medium">{optionName(item.name, locale)}</span>
                    <span className="text-sm text-muted-foreground">
                      {item.is_available ? (
                        branchPrices.get(item.id) ? (
                          <Money amount={branchPrices.get(item.id) ?? ""} currency={currency} locale={locale} />
                        ) : (
                          <span>{branchMenu.isLoading ? t.loading : t.validate}</span>
                        )
                      ) : (
                        <span className="inline-flex rounded-full bg-[var(--status-soldout-bg)] px-2 py-0.5 text-xs font-medium text-[var(--status-soldout)]">{t.unavailable}</span>
                      )}
                    </span>
                    {item.is_available ? <span className="text-sm font-medium text-primary">{t.add}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {active ? (
        <Sheet open onOpenChange={(open) => !open && setActiveId(null)}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="mx-auto flex max-h-[92dvh] w-full max-w-md flex-col gap-0 overflow-hidden rounded-t-3xl p-0"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-4 pb-2">
              <SheetTitle className="text-lg">{optionName(active.name, locale)}</SheetTitle>
              <SheetClose className="inline-flex min-h-11 shrink-0 items-center rounded-xl border bg-card px-3 text-sm font-medium">
                {t.close}
              </SheetClose>
            </div>
            <ItemConfigurator
              item={active}
              currency={currency}
              branchPrice={branchPrices.get(active.id) ?? null}
              onDone={() => {
                setActiveId(null);
                void queryClient.invalidateQueries({ queryKey: ["guest-cart"] });
                void queryClient.invalidateQueries({ queryKey: ["guest-quote"] });
              }}
            />
          </SheetContent>
        </Sheet>
      ) : null}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto grid max-w-md grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <Link href="/order/checkout" className={`${(cart.data?.total_items ?? 0) > 0 ? guestPrimaryButton : guestSecondaryButton} gap-2`}>
            <span>
              {t.checkout}
              {(cart.data?.total_items ?? 0) > 0 ? ` (${cart.data?.total_items})` : ""}
            </span>
            {(cart.data?.total_items ?? 0) > 0 && cartQuote.data ? (
              <Money amount={quotedOrderTotal(cartQuote.data)} currency={currency} locale={locale} />
            ) : null}
          </Link>
          <Link
            href="/order/service"
            className="inline-flex min-h-14 items-center justify-center rounded-xl border bg-card px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t.service}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ItemConfigurator({
  item,
  currency,
  branchPrice,
  onDone,
}: {
  item: MenuItem;
  currency: string;
  branchPrice: string | null;
  onDone: () => void;
}) {
  const { t, locale } = useGuestCopy();
  const session = useGuest((state) => state.session);
  const guestName = useGuest((state) => state.guestName);
  const setGuestName = useGuest((state) => state.setGuestName);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [choiceError, setChoiceError] = useState("");

  const groups = (item.modifier_groups ?? []) as ModifierGroup[];

  function missingGroup(): string | null {
    for (const group of groups) {
      const count = (selected[group.id] ?? []).length;
      const minimum = group.is_required ? Math.max(1, group.min_choices ?? 1) : (group.min_choices ?? 0);
      if (count < minimum) return optionName(group.name, locale);
    }
    return null;
  }

  const missing = missingGroup();

  function toggle(group: ModifierGroup, optionId: string) {
    setSelected((current) => {
      const existing = current[group.id] ?? [];
      const max = group.max_choices ?? 1;
      const has = existing.includes(optionId);
      const next = has
        ? existing.filter((id) => id !== optionId)
        : max <= 1
          ? [optionId]
          : [...existing, optionId].slice(-max);
      return { ...current, [group.id]: next };
    });
  }

  const selectedGroups = Object.entries(selected)
    .filter(([, optionIds]) => optionIds.length > 0)
    .map(([group_id, option_ids]) => ({ group_id, option_ids }));

  const quoteItems = useMemo<QuoteItemInput[] | null>(() => {
    if (missing !== null) return null;
    const optionIds = Object.values(selected).flat();
    return [{
      item_id: item.id,
      quantity,
      selected_option_ids: optionIds,
      special_instructions: notes || null,
    }];
  }, [item.id, missing, notes, quantity, selected]);
  const quote = useGuestOrderQuote(quoteItems, t.oops);

  const priced = useQuery({
    queryKey: ["validate", item.id, quantity, selectedGroups, session?.tableId],
    enabled: missing === null,
    queryFn: async () => {
      const body: components["schemas"]["ValidateItemSelectionRequest"] = {
        item_id: item.id,
        quantity,
        selected_groups: selectedGroups,
        special_instructions: notes || null,
        table_id: session?.tableId,
        guest_label: guestName || null,
      };
      const result = await guestApi.POST("/api/v1/menu/validate-item-selection", { body });
      if (!result.response.ok || !result.data) {
        throw asApiError(result.error, result.response, t.oops, locale);
      }
      return result.data;
    },
  });

  const add = useMutation({
    mutationFn: async (validated: Validated) => {
      const body: components["schemas"]["AddCartItemRequest"] = {
        guest_name: guestName || "Guest",
        item_id: validated.item_id,
        item_name: validated.item_name,
        unit_price: branchPrice ?? validated.base_price,
        quantity: validated.quantity,
        notes: notes || null,
        modifiers: (validated.selected_modifiers ?? []).map((modifier) => ({
          option_id: modifier.option_id,
          name: modifier.name,
          price: modifier.price_delta,
        })),
      };
      const result = await guestApi.POST("/api/v1/sessions/{session_id}/cart/items", {
        params: { path: { session_id: session?.sessionId ?? "" } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.oops, locale);
      return result.data;
    },
    onSuccess: () => {
      toast.success(t.added);
      onDone();
    },
    onError: (error: Error, validated) => {
      void resumeIfSessionGone(error).then((gone) => {
        if (gone) {
          if (useGuest.getState().session) add.mutate(validated);
          return;
        }
        toast.error(error.message);
      });
    },
  });

  const title = optionName(item.name, locale);
  const description = item.description ? optionName(item.description, locale) : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 pb-4">
      {mediaUrl(item.image_url) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl(item.image_url) ?? ""} alt="" className="max-h-40 w-full rounded-xl bg-secondary object-contain" />
      ) : null}
      {description && description !== title ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
      {groups.map((group) => (
        <fieldset key={group.id} className="grid gap-2">
          <legend className="text-sm font-medium">
            {optionName(group.name, locale)}
            {group.is_required ? ` · ${t.required}` : ""}
          </legend>
          {(group.options ?? []).map((option) => {
            const soldOut = option.is_available === false;
            const delta = Number(option.price_delta);
            const chosen = (selected[group.id] ?? []).includes(option.id);
            return (
              <label key={option.id} className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 text-sm ${chosen ? "border-primary bg-secondary" : "bg-card"} ${soldOut ? "text-muted-foreground" : ""}`}>
                <input
                  type={group.max_choices === 1 ? "radio" : "checkbox"}
                  name={group.id}
                  className="size-5"
                  checked={chosen}
                  disabled={soldOut}
                  onChange={() => {
                    if (soldOut) return;
                    setChoiceError("");
                    toggle(group, option.id);
                  }}
                />
                <span className="flex-1">
                  {optionName(option.name, locale)}
                  {soldOut ? ` · ${t.unavailable}` : ""}
                </span>
                {!soldOut && Number.isFinite(delta) && delta !== 0 ? (
                  <Money amount={option.price_delta} currency={currency} locale={locale} />
                ) : null}
              </label>
            );
          })}
        </fieldset>
      ))}
      <div className="grid gap-1 text-sm font-medium">
        {t.quantity}
        <div className="flex items-center gap-3">
          <button type="button" className="inline-flex size-12 items-center justify-center rounded-xl border bg-card text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={t.fewer} onClick={() => setQuantity((current) => Math.max(1, current - 1))}>−</button>
          <span className="min-w-8 text-center text-base">{quantity}</span>
          <button type="button" className="inline-flex size-12 items-center justify-center rounded-xl border bg-card text-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={t.more} onClick={() => setQuantity((current) => current + 1)}>+</button>
        </div>
      </div>
      <label className="grid gap-1 text-sm font-medium">
        {t.yourName}
        <input className={guestField} autoComplete="name" value={guestName} onChange={(event) => setGuestName(event.target.value)} />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        {t.notes}
        <textarea
          className="min-h-20 rounded-xl border bg-background px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      {choiceError ? (
        <p role="alert" className="text-sm text-destructive">
          {choiceError}
        </p>
      ) : null}
      {missing ? (
        <p className="text-sm">{t.pricePending}</p>
      ) : quote.isLoading ? (
        <p className="text-sm">{t.validate}</p>
      ) : quote.isError ? (
        <p className="text-sm text-destructive">{quote.error instanceof Error ? quote.error.message : t.oops}</p>
      ) : quote.data ? (
        <GuestQuoteSummary
          pricing={quote.data}
          labels={{ subtotal: t.subtotal, discount: t.discount, serviceFee: t.serviceFee, tax: t.tax, total: t.total }}
          locale={locale}
          currency={currency}
        />
      ) : (
        <p className="text-sm">{t.pricePending}</p>
      )}
    </div>
    <div className="shrink-0 border-t bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        className={`${guestPrimaryButton} gap-2`}
        disabled={add.isPending || !guestName.trim()}
        onClick={() => {
          const needed = missingGroup();
          if (needed) {
            setChoiceError(t.chooseRequired.replace("{name}", needed));
            return;
          }
          if (!priced.data || !quote.data) return;
          add.mutate(priced.data);
        }}
      >
        {add.isPending ? t.paying : t.add}
        {quote.data ? <Money amount={quotedOrderTotal(quote.data)} currency={currency} locale={locale} /> : null}
      </button>
    </div>
    </div>
  );
}
