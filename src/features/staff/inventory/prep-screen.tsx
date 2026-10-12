"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ops/page-header";
import { EmptyState, LoadingState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { control, InventoryFrame, primaryButton, useWarehouses, WarehouseSelect } from "./chrome";
import { formatQty } from "./qty";
import { previewPrepConsumption, type PrepIngredient, type PrepRecipe } from "./prep";
import type { ConversionEdge } from "./units";

export function PrepScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const brandId = useScope((state) => state.brandId) ?? "";
  const warehouses = useWarehouses();
  const [warehouseId, setWarehouseId] = useState("");
  const [prepId, setPrepId] = useState("");
  const [batches, setBatches] = useState("1");
  const selected = warehouseId || warehouses.data?.[0]?.id || "";
  const ingredients = useQuery({
    queryKey: ["inventory", "ingredients", brandId, "all"],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/ingredients", {
        params: { query: { brand_id: brandId, active_only: false } },
      });
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
  const conversions = useQuery({
    queryKey: ["inventory", "conversions", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/conversions", { params: { query: { brand_id: brandId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const preps = (ingredients.data ?? []).filter((item) => item.is_prep);
  const preview = useMemo(() => {
    const recipe = (recipes.data ?? []).find((item) => item.prep_ingredient_id === prepId && item.is_active);
    if (!prepId || !recipe) return null;
    const graph: PrepRecipe[] = (recipes.data ?? []).map((item) => ({
      id: item.id,
      prepIngredientId: item.prep_ingredient_id,
      yieldQty: item.yield_qty,
      isActive: item.is_active,
      lines: (item.lines ?? []).map((line) => ({
        ingredientId: line.ingredient_id,
        qty: line.qty,
        unitId: line.unit_id,
        wastePct: line.waste_pct,
      })),
    }));
    const catalog: PrepIngredient[] = (ingredients.data ?? []).map((item) => ({
      id: item.id,
      sku: item.sku,
      isPrep: item.is_prep,
      baseUnitId: item.base_unit_id,
    }));
    const edges: ConversionEdge[] = (conversions.data ?? []).map((edge) => ({
      ingredientId: edge.ingredient_id,
      fromUnitId: edge.from_unit_id,
      toUnitId: edge.to_unit_id,
      factor: edge.factor,
    }));
    const current = graph.find((item) => item.id === recipe.id);
    if (!current) return null;
    return previewPrepConsumption(current, Number(batches), graph, catalog, edges);
  }, [batches, conversions.data, ingredients.data, prepId, recipes.data]);
  const produce = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/warehouses/{warehouse_id}/prep", {
        params: { path: { warehouse_id: selected } },
        body: { prep_ingredient_id: prepId, batches },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
      const body = result.data as { produced_qty?: string | number } | undefined;
      return body?.produced_qty;
    },
    onSuccess: (qty) => toast.success(fill(t.prep.produced, { qty: formatQty(qty ?? batches, locale) })),
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });

  return (
    <InventoryFrame page="prep">
      <PageHeader title={t.prep.title} detail={t.prep.detail} />
      {ingredients.isLoading ? <LoadingState label={t.loading} /> : null}
      {preps.length === 0 && ingredients.data ? <EmptyState title={t.prep.empty} body={t.prep.detail} /> : null}
      <form className="grid max-w-xl gap-4" onSubmit={(event) => { event.preventDefault(); produce.mutate(); }}>
        {warehouses.data && warehouses.data.length > 0 ? (
          <WarehouseSelect warehouses={warehouses.data} value={selected} onChange={setWarehouseId} />
        ) : null}
        <label className="grid gap-1 text-sm">
          <span>{t.prep.item}</span>
          <select className={control} value={prepId} onChange={(event) => setPrepId(event.target.value)} required>
            <option value="">{t.prep.item}</option>
            {preps.map((item) => <option key={item.id} value={item.id}>{pickLocale(item.name, locale)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>{t.prep.batches}</span>
          <input className={`${control} h-14 text-lg`} inputMode="decimal" value={batches} onChange={(event) => setBatches(event.target.value)} required />
        </label>
        {preview && !preview.ok ? <p className="text-sm text-destructive">{preview.code === "RECIPE_TOO_DEEP" || preview.code === "RECIPE_CYCLE" ? t.prep.depth : t.prep.noRecipe}</p> : null}
        {preview && preview.ok ? (
          <div className="grid gap-2">
            <h2 className="font-medium">{t.prep.preview}</h2>
            <ul className="grid gap-1 text-sm">
              {preview.leaves.map((leaf) => {
                const ingredient = (ingredients.data ?? []).find((item) => item.id === leaf.ingredientId);
                return <li key={leaf.ingredientId}>{ingredient ? pickLocale(ingredient.name, locale) : leaf.sku} · {formatQty(leaf.qty, locale)}</li>;
              })}
            </ul>
          </div>
        ) : null}
        <button type="submit" className={primaryButton} disabled={produce.isPending || !preview || !preview.ok || !selected}>{t.prep.confirm}</button>
      </form>
    </InventoryFrame>
  );
}
