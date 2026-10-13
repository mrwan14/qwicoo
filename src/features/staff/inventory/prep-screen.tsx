"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { PageHeader } from "@/components/ops/page-header";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { control, InventoryFrame, primaryButton, useBranchCurrency, useWarehouses, WarehouseSelect } from "./chrome";
import { formatQty } from "./qty";

export function PrepScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const currency = useBranchCurrency();
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
  const units = useQuery({
    queryKey: ["inventory", "units", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/units", { params: { query: { brand_id: brandId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const preps = (ingredients.data ?? []).filter((item) => item.is_prep);
  const preview = useQuery({
    queryKey: ["inventory", "prep-preview", selected, prepId, batches],
    enabled: Boolean(selected && prepId && Number(batches) > 0),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/warehouses/{warehouse_id}/prep/preview", {
        params: { path: { warehouse_id: selected }, query: { prep_ingredient_id: prepId, batches } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data;
    },
  });
  const produce = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/warehouses/{warehouse_id}/prep", {
        params: { path: { warehouse_id: selected } },
        body: { prep_ingredient_id: prepId, batches },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.produced_qty;
    },
    onSuccess: (qty) => {
      const prep = (ingredients.data ?? []).find((item) => item.id === prepId);
      const unit = (units.data ?? []).find((item) => item.id === prep?.base_unit_id);
      const unitName = unit ? pickLocale(unit.name, locale) : "";
      toast.success(fill(t.prep.produced, { qty: formatQty(qty, locale), unit: unitName ? ` ${unitName}` : "" }));
    },
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
        {preview.isLoading ? <LoadingState label={t.loading} /> : null}
        {preview.isError ? <QueryErrorState error={preview.error} screen={t.tabs.prep} onRetry={() => void preview.refetch()} /> : null}
        {preview.data ? (
          <div className="grid gap-2">
            <h2 className="font-medium">{t.prep.preview}</h2>
            <p className="text-sm">{t.prep.cost} <Money amount={preview.data.total_cost} currency={currency} /></p>
            <ul className="grid gap-1 text-sm">
              {preview.data.components.map((leaf) => {
                const ingredient = (ingredients.data ?? []).find((item) => item.id === leaf.ingredient_id);
                const unit = (units.data ?? []).find((item) => item.id === ingredient?.base_unit_id);
                const unitName = unit ? pickLocale(unit.name, locale) : "";
                return (
                  <li key={leaf.ingredient_id}>
                    {ingredient ? pickLocale(ingredient.name, locale) : leaf.sku} · {formatQty(leaf.qty, locale)}{unitName ? ` ${unitName}` : ""}
                    {leaf.short ? ` · ${t.prep.short}` : ""}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        <button type="submit" className={primaryButton} disabled={produce.isPending || !preview.data || !selected}>{t.prep.confirm}</button>
      </form>
    </InventoryFrame>
  );
}
