"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ops/page-header";
import { LoadingState } from "@/components/ops/states";
import Link from "next/link";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { control, INVENTORY_HREFS, InventoryFrame, primaryButton, useWarehouses, WarehouseSelect } from "./chrome";

const REASONS = ["EXPIRED", "SPOILED", "DROPPED", "OVERPRODUCTION", "STAFF_MEAL", "OTHER"] as const;

export function WasteScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const brandId = useScope((state) => state.brandId) ?? "";
  const warehouses = useWarehouses();
  const [warehouseId, setWarehouseId] = useState("");
  const [ingredientId, setIngredientId] = useState("");
  const [qty, setQty] = useState("");
  const [unitId, setUnitId] = useState("");
  const [reason, setReason] = useState<(typeof REASONS)[number]>("SPOILED");
  const [note, setNote] = useState("");
  const selected = warehouseId || warehouses.data?.[0]?.id || "";
  const ingredients = useQuery({
    queryKey: ["inventory", "ingredients", brandId, "active"],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/ingredients", { params: { query: { brand_id: brandId, active_only: true } } });
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
  const save = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/warehouses/{warehouse_id}/waste", {
        params: { path: { warehouse_id: selected } },
        body: { ingredient_id: ingredientId, qty, unit_id: unitId, reason_code: reason, note: note.trim() || null },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: () => {
      toast.success(t.saved);
      setQty("");
      setNote("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });

  return (
    <InventoryFrame page="waste">
      <PageHeader title={t.waste.title} detail={t.waste.detail} />
      {warehouses.isLoading || ingredients.isLoading ? <LoadingState label={t.loading} /> : null}
      <form
        className="grid max-w-xl gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        {warehouses.data && warehouses.data.length > 0 ? (
          <WarehouseSelect warehouses={warehouses.data} value={selected} onChange={setWarehouseId} />
        ) : null}
        <label className="grid gap-1 text-sm">
          <span>{t.ingredient}</span>
          <select className={`${control} h-14 text-base`} value={ingredientId} onChange={(event) => setIngredientId(event.target.value)} required>
            <option value="">{t.ingredient}</option>
            {(ingredients.data ?? []).map((item) => <option key={item.id} value={item.id}>{pickLocale(item.name, locale)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>{t.quantity}</span>
          <input className={`${control} h-14 text-lg`} inputMode="decimal" value={qty} onChange={(event) => setQty(event.target.value)} required />
        </label>
        <label className="grid gap-1 text-sm">
          <span>{t.unit}</span>
          <select className={`${control} h-14 text-base`} value={unitId} onChange={(event) => setUnitId(event.target.value)} required>
            <option value="">{t.unit}</option>
            {(units.data ?? []).map((unit) => <option key={unit.id} value={unit.id}>{pickLocale(unit.name, locale)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>{t.reason}</span>
          <select className={`${control} h-14 text-base`} value={reason} onChange={(event) => setReason(event.target.value as (typeof REASONS)[number])}>
            {REASONS.map((item) => <option key={item} value={item}>{t.waste.reasons[item]}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>{t.note}</span>
          <input className={`${control} h-14 text-base`} value={note} onChange={(event) => setNote(event.target.value)} required={reason === "OTHER"} />
        </label>
        <button type="submit" className={`${primaryButton} h-14 text-base`} disabled={save.isPending || !selected}>{t.waste.submit}</button>
      </form>
      <p className="text-sm text-muted-foreground">
        <Link href={INVENTORY_HREFS.movements} className="underline">{t.waste.history}</Link>
      </p>
    </InventoryFrame>
  );
}
