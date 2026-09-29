"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PresenceNote, useAbsorbBranding, useGuestCopy } from "@/features/guest/shell";
import { Money } from "@/components/ops/money";
import { ErrorState, LoadingState } from "@/components/ops/states";
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
  const [wide, setWide] = useState(false);

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
      if (!result.response.ok || !result.data) return null;
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

  const items = useMemo(() => {
    const list: MenuItem[] = [];
    for (const category of menu.data?.categories ?? []) {
      for (const item of category.items ?? []) list.push(item);
    }
    return list;
  }, [menu.data]);

  const active = items.find((item) => item.id === activeId) ?? null;
  const currency = branchMenu.data?.currency || "EGP";

  if (!session) {
    return (
      <p className="text-sm text-muted-foreground">
        {t.scanAgain}
      </p>
    );
  }

  if (menu.isLoading) return <LoadingState label={t.loading} />;
  if (menu.isError) {
    return (
      <ErrorState
        title={t.oopsTitle}
        body={menu.error instanceof Error ? menu.error.message : t.oops}
        onRetry={() => void menu.refetch()}
        retryLabel={t.retry}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <PresenceNote />
      <label className="grid gap-1 text-sm font-medium">
        {t.yourName}
        <input
          className="h-12 rounded-lg border px-3"
          value={guestName}
          onChange={(event) => setGuestName(event.target.value)}
        />
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(menu.data?.categories ?? []).map((category) => (
          <a
            key={category.id}
            href={`#cat-${category.id}`}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-sm"
          >
            {optionName(category.name, locale)}
          </a>
        ))}
      </div>
      {(menu.data?.categories ?? []).map((category) => (
        <section key={category.id} id={`cat-${category.id}`} className="grid gap-3">
          <h2 className="font-display text-[length:var(--text-20)]">
            {optionName(category.name, locale)}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(category.items ?? []).map((item) => {
              const image = mediaUrl(item.image_url);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.is_available}
                  onClick={() => {
                    setWide(window.matchMedia("(min-width: 1024px)").matches);
                    setActiveId(item.id);
                  }}
                  className="min-h-14 overflow-hidden rounded-2xl bg-card text-start shadow-elev-1 disabled:opacity-70"
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" className="h-36 w-full object-cover" />
                  ) : (
                    <div className="flex h-24 items-center justify-center bg-secondary text-2xl font-semibold text-primary">
                      {optionName(item.name, locale).trim().charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="grid gap-1 p-3">
                    <span className="font-medium">{optionName(item.name, locale)}</span>
                    <span className="text-sm text-muted-foreground">
                      {item.is_available ? (
                        <Money amount={item.base_price} currency={currency} locale={locale} />
                      ) : (
                        <span className="inline-flex rounded-full bg-[var(--status-soldout-bg)] px-2 py-0.5 text-xs font-medium text-[var(--status-soldout)]">{t.unavailable}</span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {active && wide ? (
        <Dialog open onOpenChange={(open) => !open && setActiveId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{optionName(active.name, locale)}</DialogTitle>
            </DialogHeader>
            <ItemConfigurator
              item={active}
              currency={currency}
              onDone={() => {
                setActiveId(null);
                void queryClient.invalidateQueries({ queryKey: ["guest-cart"] });
              }}
            />
          </DialogContent>
        </Dialog>
      ) : null}
      {active && !wide ? (
        <Sheet open onOpenChange={(open) => !open && setActiveId(null)}>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{optionName(active.name, locale)}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">
              <ItemConfigurator
                item={active}
                currency={currency}
                onDone={() => {
                  setActiveId(null);
                  void queryClient.invalidateQueries({ queryKey: ["guest-cart"] });
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-elev-2">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{t.cart}</p>
            <p className="text-base font-semibold">
              <Money amount={cart.data?.subtotal ?? "0.00"} currency={currency} locale={locale} />
            </p>
          </div>
          <Link
            href="/order/checkout"
            className="inline-flex min-h-14 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            {t.checkout} ({cart.data?.total_items ?? 0})
          </Link>
        </div>
      </div>
    </div>
  );
}

function ItemConfigurator({
  item,
  currency,
  onDone,
}: {
  item: MenuItem;
  currency: string;
  onDone: () => void;
}) {
  const { t, locale } = useGuestCopy();
  const session = useGuest((state) => state.session);
  const guestName = useGuest((state) => state.guestName);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  const groups = (item.modifier_groups ?? []) as ModifierGroup[];

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

  const priced = useQuery({
    queryKey: ["validate", item.id, quantity, selectedGroups, session?.tableId],
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
        unit_price: validated.unit_price,
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
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid gap-4">
      {item.description ? (
        <p className="text-sm text-muted-foreground">{optionName(item.description, locale)}</p>
      ) : null}
      {groups.map((group) => (
        <fieldset key={group.id} className="grid gap-2">
          <legend className="text-sm font-medium">
            {optionName(group.name, locale)}
            {group.is_required ? ` · ${t.required}` : ""}
          </legend>
          {(group.options ?? []).map((option) => (
            <label key={option.id} className="flex min-h-12 items-center gap-3 text-sm">
              <input
                type={group.max_choices === 1 ? "radio" : "checkbox"}
                name={group.id}
                checked={(selected[group.id] ?? []).includes(option.id)}
                disabled={option.is_available === false}
                onChange={() => toggle(group, option.id)}
              />
              <span className="flex-1">{optionName(option.name, locale)}</span>
              <span className="text-muted-foreground">{option.price_delta}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <label className="grid gap-1 text-sm font-medium">
        {t.quantity}
        <input
          type="number"
          min={1}
          className="h-12 rounded-lg border px-3"
          value={quantity}
          onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        {t.notes}
        <textarea
          className="min-h-20 rounded-lg border px-3 py-2"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      <p className="text-sm">
        {priced.isLoading ? t.validate : priced.isError ? t.retry : priced.data ? (
          <Money amount={priced.data.subtotal} currency={currency} locale={locale} />
        ) : (
          t.pricePending
        )}
      </p>
      <button
        type="button"
        className="min-h-14 rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
        disabled={!priced.data || add.isPending || !guestName.trim()}
        onClick={() => priced.data && add.mutate(priced.data)}
      >
        {t.add}
      </button>
    </div>
  );
}
