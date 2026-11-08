"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { AlertTriangle, ChefHat, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button, buttonClass } from "@/components/ops/kit/button";
import { Card } from "@/components/ops/kit/card";
import { EmptyState } from "@/components/ops/kit/empty-state";
import { formatAmount } from "@/components/ops/kit/money";
import { QueryErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { formatCairoDateTime } from "@/lib/format/time";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { canWriteCentralKitchen } from "./access";
import { INVENTORY_HREFS, InventoryFrame, useBranchCurrency, useWarehouses, WarehouseSelect } from "./chrome";
import { formatQty } from "./qty";

const MAX_BATCHES = 99;

/** Pick a prep item, choose how many batches, see what it takes from stock, then make it. */
export function PrepScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const currency = useBranchCurrency();
  const queryClient = useQueryClient();
  const brandId = useScope((state) => state.brandId) ?? "";
  const warehouses = useWarehouses();
  const [warehouseId, setWarehouseId] = useState("");
  const [prepId, setPrepId] = useState("");
  const [batches, setBatches] = useState(1);
  const selected = warehouseId || warehouses.data?.[0]?.id || "";
  const store = warehouses.data?.find((item) => item.id === selected);
  const locked = store?.kind === "CENTRAL_KITCHEN" && !canWriteCentralKitchen(me?.role);

  const ingredients = useQuery({
    queryKey: ["inventory", "ingredients", brandId, "all"],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/ingredients", { params: { query: { brand_id: brandId, active_only: false } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const units = useQuery({
    queryKey: ["inventory", "units", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/units", { params: { query: { brand_id: brandId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const recipes = useQuery({
    queryKey: ["inventory", "recipes", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/recipes", { params: { query: { brand_id: brandId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const stock = useQuery({
    queryKey: ["inventory", "stock", selected],
    enabled: Boolean(selected),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/warehouses/{warehouse_id}/stock", { params: { path: { warehouse_id: selected } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const recent = useQuery({
    queryKey: ["inventory", "prep-recent", selected],
    enabled: Boolean(selected),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/warehouses/{warehouse_id}/movements", {
        params: { path: { warehouse_id: selected }, query: { movement_type: "PREP_PRODUCE", limit: 8 } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });

  const preps = (ingredients.data ?? []).filter((item) => item.is_prep && item.is_active).sort((a, b) => pickLocale(a.name, locale).localeCompare(pickLocale(b.name, locale), locale));
  const recipeFor = (id: string) => (recipes.data ?? []).find((recipe) => recipe.is_active && recipe.target_type === "PREP" && recipe.prep_ingredient_id === id);
  const onHand = new Map((stock.data ?? []).map((row) => [row.ingredient_id, row.on_hand]));
  const byIngredient = new Map((ingredients.data ?? []).map((item) => [item.id, item]));
  const unitOf = (ingredientId: string) => {
    const base = byIngredient.get(ingredientId)?.base_unit_id;
    const unit = units.data?.find((item) => item.id === base);
    return unit ? pickLocale(unit.name, locale) : "";
  };
  const prep = preps.find((item) => item.id === prepId) ?? null;
  const hasRecipe = prep ? Boolean(recipeFor(prep.id)) : false;

  const preview = useQuery({
    queryKey: ["inventory", "prep-preview", selected, prepId, batches],
    enabled: Boolean(selected && prep && hasRecipe),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/warehouses/{warehouse_id}/prep/preview", {
        params: { path: { warehouse_id: selected }, query: { prep_ingredient_id: prepId, batches: String(batches) } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data;
    },
  });
  const produce = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/warehouses/{warehouse_id}/prep", {
        params: { path: { warehouse_id: selected } },
        body: { prep_ingredient_id: prepId, batches: String(batches) },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.produced_qty;
    },
    onSuccess: async (qty) => {
      toast.success(fill(t.prepx.made, { qty: formatQty(qty, locale), unit: unitOf(prepId), name: prep ? pickLocale(prep.name, locale) : "" }));
      setBatches(1);
      await queryClient.invalidateQueries({ queryKey: ["inventory", "stock", selected] });
      await queryClient.invalidateQueries({ queryKey: ["inventory", "prep-recent", selected] });
      await queryClient.invalidateQueries({ queryKey: ["inventory", "prep-preview", selected] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });

  const money = (value: string | number) => formatAmount(value, currency, locale);
  const empty = ingredients.isSuccess && preps.length === 0;

  return (
    <InventoryFrame page="prep">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid max-w-2xl gap-0.5">
          <h2 className="text-lg font-semibold text-ink">{t.prepx.title}</h2>
          <p className="text-sm text-ink-secondary">{t.prepx.intro}</p>
        </div>
        {(warehouses.data?.length ?? 0) > 1 && warehouses.data ? (
          <div className="w-full sm:w-64">
            <WarehouseSelect warehouses={warehouses.data} value={selected} onChange={setWarehouseId} />
          </div>
        ) : null}
      </div>

      {ingredients.isError ? <QueryErrorState error={ingredients.error} screen={t.tabs.prep} onRetry={() => void ingredients.refetch()} /> : null}

      {empty ? (
        <EmptyState
          icon={ChefHat}
          title={t.prepx.emptyTitle}
          body={t.prepx.emptyBody}
          action={
            <Link href={INVENTORY_HREFS.ingredients} className={buttonClass({ variant: "secondary" })}>
              {t.prepx.toIngredients}
            </Link>
          }
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <section className="grid gap-3" aria-labelledby="prep-pick">
            <h3 id="prep-pick" className="text-sm font-semibold text-ink">
              {t.prepx.pickTitle}
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {preps.map((item) => {
                const recipe = recipeFor(item.id);
                const unit = unitOf(item.id);
                const active = item.id === prepId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      className={cn(
                        "grid w-full gap-1 rounded-staff border p-3.5 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                        active ? "border-ink bg-subtle" : "border-border bg-canvas hover:border-ink-secondary/50",
                      )}
                      onClick={() => {
                        setPrepId(item.id);
                        setBatches(1);
                      }}
                    >
                      <span className="text-sm font-semibold text-ink">{pickLocale(item.name, locale)}</span>
                      <span className="text-xs text-ink-secondary">{fill(t.prepx.onHand, { qty: formatQty(onHand.get(item.id) ?? 0, locale), unit })}</span>
                      {recipe ? (
                        <span className="text-xs text-ink-secondary">{fill(t.prepx.perBatch, { qty: formatQty(recipe.yield_qty, locale), unit })}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-warning">
                          <AlertTriangle aria-hidden className="size-3" />
                          {t.prepx.noRecipe}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <Card title={prep ? fill(t.prepx.makeTitle, { name: pickLocale(prep.name, locale) }) : t.prepx.pickTitle} className="lg:sticky lg:top-[76px]">
            {!prep ? (
              <p className="text-sm text-ink-secondary">{t.prepx.pickFirst}</p>
            ) : !hasRecipe ? (
              <div className="grid gap-3">
                <p className="text-sm text-ink-secondary">{t.prepx.noRecipe}</p>
                <Link href={INVENTORY_HREFS.recipes} className={buttonClass({ variant: "secondary", size: "sm" })}>
                  {t.prepx.addRecipe}
                </Link>
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-ink">{t.prepx.howMany}</span>
                  <div className="flex items-center rounded-staff border border-border">
                    <button
                      type="button"
                      aria-label={t.prepx.fewer}
                      disabled={batches <= 1}
                      className="inline-flex size-11 items-center justify-center rounded-s-staff text-ink hover:bg-subtle disabled:text-disabled disabled:hover:bg-transparent"
                      onClick={() => setBatches((value) => Math.max(1, value - 1))}
                    >
                      <Minus aria-hidden className="size-4" />
                    </button>
                    <output aria-live="polite" className="w-12 border-x border-border text-center text-base leading-11 font-semibold tabular-nums">
                      {formatQty(batches, locale)}
                    </output>
                    <button
                      type="button"
                      aria-label={t.prepx.more}
                      disabled={batches >= MAX_BATCHES}
                      className="inline-flex size-11 items-center justify-center rounded-e-staff text-ink hover:bg-subtle disabled:text-disabled disabled:hover:bg-transparent"
                      onClick={() => setBatches((value) => Math.min(MAX_BATCHES, value + 1))}
                    >
                      <Plus aria-hidden className="size-4" />
                    </button>
                  </div>
                </div>

                {preview.isError ? <QueryErrorState error={preview.error} screen={t.tabs.prep} onRetry={() => void preview.refetch()} /> : null}
                {preview.data ? (
                  <>
                    <div className="grid gap-0.5 rounded-staff bg-subtle px-3.5 py-3">
                      <span className="text-xs text-ink-secondary">{t.prepx.youMake}</span>
                      <span className="text-2xl font-semibold tabular-nums">
                        {formatQty(preview.data.produced_qty, locale)} <span className="text-base font-normal text-ink-secondary">{unitOf(prepId)}</span>
                      </span>
                    </div>
                    <div className="grid gap-2">
                      <span className="text-xs font-medium text-ink-secondary">{t.prepx.uses}</span>
                      <ul className={cn("divide-y divide-border rounded-staff border border-border", preview.isFetching && "opacity-60")}>
                        {preview.data.components.map((leaf) => {
                          const ingredient = byIngredient.get(leaf.ingredient_id);
                          const unit = unitOf(leaf.ingredient_id);
                          return (
                            <li key={leaf.ingredient_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                              <span className="grid min-w-0 gap-0.5">
                                <span className="truncate font-medium text-ink">{ingredient ? pickLocale(ingredient.name, locale) : leaf.sku}</span>
                                <span className={cn("text-xs", leaf.short ? "text-danger" : "text-ink-secondary")}>
                                  {leaf.short ? `${t.prepx.notEnough} · ` : ""}
                                  {fill(t.prepx.have, { qty: `${formatQty(leaf.on_hand, locale)} ${unit}` })}
                                </span>
                              </span>
                              <span className="shrink-0 font-semibold tabular-nums">
                                {formatQty(leaf.qty, locale)} <span className="font-normal text-ink-secondary">{unit}</span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    {preview.data.has_shortage ? (
                      <p role="status" className="flex items-start gap-2 rounded-staff bg-warning-bg px-3 py-2.5 text-[13px] text-ink">
                        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                        {t.prepx.shortWarning}
                      </p>
                    ) : null}
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-ink-secondary">{t.prepx.cost}</span>
                      <span className="grid justify-items-end">
                        <span className="font-semibold tabular-nums">{money(preview.data.total_cost)}</span>
                        <span className="text-xs text-ink-secondary">{fill(t.prepx.costPer, { amount: money(preview.data.unit_cost), unit: unitOf(prepId) })}</span>
                      </span>
                    </div>
                  </>
                ) : preview.isLoading ? (
                  <p className="text-sm text-ink-secondary">…</p>
                ) : null}

                <Button size="touch" className="w-full" disabled={locked || produce.isPending || !preview.data} onClick={() => produce.mutate()}>
                  <ChefHat aria-hidden />
                  {produce.isPending ? t.prepx.making : batches === 1 ? t.prepx.makeOne : fill(t.prepx.make, { count: formatQty(batches, locale) })}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {!empty ? (
        <Card title={t.prepx.recentTitle}>
          {(recent.data ?? []).length === 0 ? (
            <p className="text-sm text-ink-secondary">{recent.isLoading ? "…" : t.prepx.recentNone}</p>
          ) : (
            <ul className="-mx-4 divide-y divide-border border-t border-border">
              {(recent.data ?? []).map((move) => {
                const ingredient = byIngredient.get(move.ingredient_id);
                return (
                  <li key={move.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm">
                    <span className="font-medium text-ink">{ingredient ? pickLocale(ingredient.name, locale) : ""}</span>
                    <span className="flex items-center gap-3 text-ink-secondary">
                      <span className="font-semibold text-ink tabular-nums">{fill(t.prepx.recentLine, { qty: formatQty(move.qty, locale), unit: unitOf(move.ingredient_id) })}</span>
                      <span>{formatCairoDateTime(move.created_at, locale)}</span>
                      {move.created_by_name ? <span>{move.created_by_name}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}
    </InventoryFrame>
  );
}
