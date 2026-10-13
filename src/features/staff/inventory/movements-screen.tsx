"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/ops/page-header";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { formatCairoDateTime } from "@/lib/format/time";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { control, InventoryFrame, useWarehouses, WarehouseSelect } from "./chrome";
import { formatQty } from "./qty";
import { convertQty, type ConversionEdge } from "./units";

type MovementType = components["schemas"]["MovementType"];
const TYPES: MovementType[] = [
  "OPENING",
  "PURCHASE_RECEIPT",
  "SALE",
  "SALE_REVERSAL",
  "WASTE",
  "ADJUSTMENT",
  "COUNT_VARIANCE",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "PREP_PRODUCE",
  "PREP_CONSUME",
  "TRANSFER_VARIANCE",
];

export function MovementsScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const brandId = useScope((state) => state.brandId);
  const warehouses = useWarehouses();
  const [warehouseId, setWarehouseId] = useState("");
  const [ingredientId, setIngredientId] = useState("");
  const [movementType, setMovementType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [displayUnitId, setDisplayUnitId] = useState("");
  const selected = warehouseId || warehouses.data?.[0]?.id || "";
  const ingredients = useQuery({
    queryKey: ["inventory", "ingredients", brandId, "all"],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/ingredients", {
        params: { query: { brand_id: brandId ?? "", active_only: false } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const units = useQuery({
    queryKey: ["inventory", "units", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/units", { params: { query: { brand_id: brandId ?? "" } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const conversions = useQuery({
    queryKey: ["inventory", "conversions", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/conversions", { params: { query: { brand_id: brandId ?? "" } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const movements = useQuery({
    queryKey: ["inventory", "movements", selected, ingredientId, movementType, from, to],
    enabled: Boolean(selected),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/warehouses/{warehouse_id}/movements", {
        params: {
          path: { warehouse_id: selected },
          query: {
            ingredient_id: ingredientId || null,
            movement_type: (movementType || null) as MovementType | null,
            created_from: from ? new Date(from).toISOString() : null,
            created_to: to ? new Date(to).toISOString() : null,
            limit: 200,
          },
        },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });

  const edges: ConversionEdge[] = (conversions.data ?? []).map((edge) => ({
    ingredientId: edge.ingredient_id,
    fromUnitId: edge.from_unit_id,
    toUnitId: edge.to_unit_id,
    factor: edge.factor,
  }));
  const byIngredient = useMemo(() => new Map((ingredients.data ?? []).map((item) => [item.id, item])), [ingredients.data]);
  const byUnit = useMemo(() => new Map((units.data ?? []).map((item) => [item.id, item])), [units.data]);

  return (
    <InventoryFrame page="movements">
      <PageHeader title={t.movements.title} detail={t.movements.detail} />
      {warehouses.isLoading || movements.isLoading ? <LoadingState label={t.loading} /> : null}
      {warehouses.isError ? <QueryErrorState error={warehouses.error} screen={t.tabs.movements} onRetry={() => void warehouses.refetch()} /> : null}
      {movements.isError ? <QueryErrorState error={movements.error} screen={t.tabs.movements} onRetry={() => void movements.refetch()} /> : null}
      {warehouses.data && warehouses.data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <WarehouseSelect warehouses={warehouses.data} value={selected} onChange={setWarehouseId} />
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t.ingredient}</span>
            <select className={control} value={ingredientId} onChange={(event) => setIngredientId(event.target.value)}>
              <option value="">{t.all}</option>
              {(ingredients.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>{pickLocale(item.name, locale)}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t.movements.type}</span>
            <select className={control} value={movementType} onChange={(event) => setMovementType(event.target.value)}>
              <option value="">{t.all}</option>
              {TYPES.map((type) => (
                <option key={type} value={type}>{t.movements.types[type]}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t.movements.from}</span>
            <input className={control} type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t.movements.to}</span>
            <input className={control} type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t.displayUnit}</span>
            <select className={control} value={displayUnitId} onChange={(event) => setDisplayUnitId(event.target.value)}>
              <option value="">{t.baseUnit}</option>
              {(units.data ?? []).map((unit) => (
                <option key={unit.id} value={unit.id}>{pickLocale(unit.name, locale)}</option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      {movements.data && movements.data.length === 0 ? <EmptyState title={t.movements.empty} body={t.movements.detail} /> : null}
      {movements.data && movements.data.length > 0 ? (
        <div className="overflow-x-auto bg-card">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b">
                {[t.movements.when, t.ingredient, t.movements.type, t.movements.qty, t.movements.who, t.movements.why, t.movements.reference].map((label) => (
                  <th key={label} className="px-3 py-2 text-start font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements.data.map((row) => {
                const ingredient = byIngredient.get(row.ingredient_id);
                const base = ingredient ? byUnit.get(ingredient.base_unit_id) : undefined;
                const display = displayUnitId && ingredient
                  ? convertQty(row.qty, edges, ingredient.id, ingredient.base_unit_id, displayUnitId)
                  : null;
                const displayUnit = displayUnitId ? byUnit.get(displayUnitId) : undefined;
                const qty = formatQty(display ?? row.qty, locale);
                const unit = display != null && displayUnit ? pickLocale(displayUnit.name, locale) : base ? pickLocale(base.name, locale) : "";
                const who = row.created_by_name ?? "";
                const reference = (row.movement_type === "SALE" || row.movement_type === "SALE_REVERSAL") && row.order_id
                  ? <Link href={`/app/orders?order=${row.order_id}`} className="underline">{t.movements.order}</Link>
                  : row.reference_type === "ORDER_ITEM"
                    ? t.movements.orderItem
                    : [row.reference_type, row.reference_id?.slice(0, 8)].filter(Boolean).join(" ");
                return (
                  <tr key={row.id} className="border-b">
                    <td className="px-3 py-2 whitespace-nowrap">{formatCairoDateTime(row.created_at, locale)}</td>
                    <td className="px-3 py-2">{ingredient ? pickLocale(ingredient.name, locale) : row.ingredient_id.slice(0, 8)}</td>
                    <td className="px-3 py-2">{t.movements.types[row.movement_type]}</td>
                    <td className="px-3 py-2 tabular-nums">{qty} {unit}</td>
                    <td className="px-3 py-2">{who}</td>
                    <td className="px-3 py-2">{row.reason ?? ""}</td>
                    <td className="px-3 py-2">{reference}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </InventoryFrame>
  );
}
