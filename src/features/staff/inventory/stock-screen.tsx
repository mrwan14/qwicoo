"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { PageHeader } from "@/components/ops/page-header";
import { StatusChip } from "@/components/ops/status-chip";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useLocale } from "@/lib/i18n/locale-store";
import type { LocaleCode } from "@/lib/i18n/locale-text";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { canOpenInventoryPage, canRecordWaste, canWriteCentralKitchen, canWriteStock } from "./access";
import { control, INVENTORY_HREFS, InventoryFrame, primaryButton, secondaryButton, useBranchCurrency, useWarehouses, WarehouseSelect } from "./chrome";
import { formatQty, lineValue } from "./qty";
import { convertQty, type ConversionEdge } from "./units";

type StockRow = components["schemas"]["StockRowResponse"];
type Unit = components["schemas"]["UnitResponse"];
const WASTE_REASONS = ["EXPIRED", "SPOILED", "DROPPED", "OVERPRODUCTION", "STAFF_MEAL", "OTHER"] as const;

export function StockScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const currency = useBranchCurrency();
  const brandId = useScope((state) => state.brandId);
  const warehouses = useWarehouses();
  const [warehouseId, setWarehouseId] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [displayUnitId, setDisplayUnitId] = useState("");
  const [row, setRow] = useState<StockRow | null>(null);
  const selected = warehouseId || warehouses.data?.[0]?.id || "";
  const warehouse = warehouses.data?.find((item) => item.id === selected);
  const centralLocked = warehouse?.kind === "CENTRAL_KITCHEN" && !canWriteCentralKitchen(me?.role);
  const canAdjust = Boolean(me && canWriteStock(me.role) && !centralLocked);
  const canWaste = Boolean(me && canRecordWaste(me.role) && !centralLocked);

  const stock = useQuery({
    queryKey: ["inventory", "stock", selected],
    enabled: Boolean(selected),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/warehouses/{warehouse_id}/stock", {
        params: { path: { warehouse_id: selected } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
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

  const edges: ConversionEdge[] = (conversions.data ?? []).map((edge) => ({
    ingredientId: edge.ingredient_id,
    fromUnitId: edge.from_unit_id,
    toUnitId: edge.to_unit_id,
    factor: edge.factor,
  }));
  const byIngredient = useMemo(() => new Map((ingredients.data ?? []).map((item) => [item.id, item])), [ingredients.data]);
  const byUnit = useMemo(() => new Map((units.data ?? []).map((item) => [item.id, item])), [units.data]);
  const categories = [...new Set((ingredients.data ?? []).map((item) => item.category).filter(Boolean))] as string[];

  const rows = (stock.data ?? []).filter((item) => {
    const meta = byIngredient.get(item.ingredient_id);
    const name = pickLocale(item.name, locale).toLowerCase();
    const matchesQuery = !query || name.includes(query.toLowerCase()) || item.sku.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = !category || meta?.category === category;
    const matchesStatus = !status || item.status === status;
    return matchesQuery && matchesCategory && matchesStatus;
  });

  return (
    <InventoryFrame page="stock">
      <PageHeader title={t.stock.title} detail={t.stock.detail} />
      {warehouses.isLoading || stock.isLoading ? <LoadingState label={t.loading} /> : null}
      {warehouses.isError ? <QueryErrorState error={warehouses.error} screen={t.tabs.stock} onRetry={() => void warehouses.refetch()} /> : null}
      {stock.isError ? <QueryErrorState error={stock.error} screen={t.tabs.stock} onRetry={() => void stock.refetch()} /> : null}
      {warehouses.data && warehouses.data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <WarehouseSelect warehouses={warehouses.data} value={selected} onChange={setWarehouseId} />
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t.search}</span>
            <input className={control} value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t.stock.category}</span>
            <select className={control} value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">{t.all}</option>
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t.stock.status}</span>
            <select className={control} value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">{t.all}</option>
              {(["ok", "low", "out", "negative"] as const).map((item) => (
                <option key={item} value={item}>{t.status[item]}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">{t.displayUnit}</span>
            <select className={control} value={displayUnitId} onChange={(event) => setDisplayUnitId(event.target.value)}>
              <option value="">{t.baseUnit}</option>
              {(units.data ?? []).map((unit) => (
                <option key={unit.id} value={unit.id}>{pickLocale(unit.name, locale)} ({unit.code})</option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      {stock.data && rows.length === 0 ? <EmptyState title={t.stock.empty} body={t.stock.detail} /> : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto bg-card">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-start">
                {[t.ingredient, t.stock.onHand, t.stock.par, t.stock.reorder, t.stock.avgCost, t.stock.value, t.stock.status].map((label) => (
                  <th key={label} className="px-3 py-2 text-start font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const meta = byIngredient.get(item.ingredient_id);
                const base = meta ? byUnit.get(meta.base_unit_id) : undefined;
                const shown = showQty(item.on_hand, item.ingredient_id, meta?.base_unit_id, displayUnitId, edges, base, units.data ?? [], locale);
                return (
                  <tr key={item.ingredient_id} className="cursor-pointer border-b hover:bg-muted/40" onClick={() => setRow(item)}>
                    <td className="px-3 py-2">
                      <span className="font-medium">{pickLocale(item.name, locale)}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{item.sku}</span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{shown.qty} {shown.unit}</td>
                    <td className="px-3 py-2 tabular-nums">{showQty(item.par_level, item.ingredient_id, meta?.base_unit_id, displayUnitId, edges, base, units.data ?? [], locale).qty}</td>
                    <td className="px-3 py-2 tabular-nums">{showQty(item.reorder_level, item.ingredient_id, meta?.base_unit_id, displayUnitId, edges, base, units.data ?? [], locale).qty}</td>
                    <td className="px-3 py-2"><Money amount={item.avg_cost} currency={currency} /></td>
                    <td className="px-3 py-2"><Money amount={lineValue(item.on_hand, item.avg_cost)} currency={currency} /></td>
                    <td className="px-3 py-2">
                      <StatusChip tone={item.status === "ok" ? "available" : item.status === "low" ? "ordered" : "soldout"}>
                        {t.status[item.status]}
                      </StatusChip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      <StockDrawer
        key={row?.ingredient_id ?? "closed"}
        row={row}
        warehouseId={selected}
        units={units.data ?? []}
        baseUnitId={row ? byIngredient.get(row.ingredient_id)?.base_unit_id : undefined}
        canAdjust={canAdjust}
        canWaste={canWaste}
        canCount={Boolean(me && canOpenInventoryPage(me.role, "counts") && !centralLocked)}
        onClose={() => setRow(null)}
      />
    </InventoryFrame>
  );
}

function showQty(
  qty: string,
  ingredientId: string,
  baseUnitId: string | undefined,
  displayUnitId: string,
  edges: ConversionEdge[],
  base: Unit | undefined,
  units: Unit[],
  locale: LocaleCode,
) {
  const display = displayUnitId ? units.find((unit) => unit.id === displayUnitId) : undefined;
  if (display && baseUnitId) {
    const converted = convertQty(qty, edges, ingredientId, baseUnitId, display.id);
    if (converted != null) return { qty: formatQty(converted, locale), unit: pickLocale(display.name, locale) };
  }
  return { qty: formatQty(qty, locale), unit: base ? pickLocale(base.name, locale) : "" };
}

function StockDrawer({
  row,
  warehouseId,
  units,
  baseUnitId,
  canAdjust,
  canWaste,
  canCount,
  onClose,
}: {
  row: StockRow | null;
  warehouseId: string;
  units: Unit[];
  baseUnitId: string | undefined;
  canAdjust: boolean;
  canWaste: boolean;
  canCount: boolean;
  onClose: () => void;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"adjust" | "waste">(canAdjust ? "adjust" : "waste");
  const [qty, setQty] = useState("");
  const [unitId, setUnitId] = useState(baseUnitId ?? "");
  const [reason, setReason] = useState("");
  const [wasteReason, setWasteReason] = useState<(typeof WASTE_REASONS)[number]>("SPOILED");
  const [note, setNote] = useState("");
  const [unitCost, setUnitCost] = useState("");

  const adjust = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/warehouses/{warehouse_id}/adjustments", {
        params: { path: { warehouse_id: warehouseId } },
        body: {
          ingredient_id: row?.ingredient_id ?? "",
          qty,
          unit_id: unitId || baseUnitId || "",
          reason: reason.trim(),
          unit_cost: unitCost.trim() ? unitCost.trim() : null,
        },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.saved);
      setQty("");
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["inventory", "stock", warehouseId] });
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  const waste = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/warehouses/{warehouse_id}/waste", {
        params: { path: { warehouse_id: warehouseId } },
        body: {
          ingredient_id: row?.ingredient_id ?? "",
          qty,
          unit_id: unitId || baseUnitId || "",
          reason_code: wasteReason,
          note: note.trim() || null,
        },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.saved);
      setQty("");
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["inventory", "stock", warehouseId] });
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });

  return (
    <Sheet open={row !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto rounded-none sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{row ? pickLocale(row.name, locale) : ""}</SheetTitle>
        </SheetHeader>
        {row ? (
          <div className="grid gap-4 px-4 pb-6">
            <div className="flex gap-2">
              {canAdjust ? (
                <button type="button" className={mode === "adjust" ? primaryButton : secondaryButton} onClick={() => setMode("adjust")}>{t.stock.adjust}</button>
              ) : null}
              {canWaste ? (
                <button type="button" className={mode === "waste" ? primaryButton : secondaryButton} onClick={() => setMode("waste")}>{t.stock.waste}</button>
              ) : null}
              {canCount && row ? (
                <Link href={`${INVENTORY_HREFS.counts}?ingredient=${row.ingredient_id}`} className={secondaryButton}>{t.counts.start}</Link>
              ) : null}
            </div>
            <label className="grid gap-1 text-sm">
              <span>{t.quantity}</span>
              <input className={`${control} text-base`} inputMode="decimal" value={qty} onChange={(event) => setQty(event.target.value)} />
              {mode === "adjust" ? <span className="text-muted-foreground">{t.stock.signedQty}</span> : null}
            </label>
            <label className="grid gap-1 text-sm">
              <span>{t.unit}</span>
              <select className={control} value={unitId || baseUnitId || ""} onChange={(event) => setUnitId(event.target.value)}>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>{pickLocale(unit.name, locale)}</option>
                ))}
              </select>
            </label>
            {mode === "adjust" && canAdjust ? (
              <>
                <label className="grid gap-1 text-sm">
                  <span>{t.reason}</span>
                  <input className={control} value={reason} onChange={(event) => setReason(event.target.value)} />
                  <span className="text-muted-foreground">{t.stock.reasonHint}</span>
                </label>
                <label className="grid gap-1 text-sm">
                  <span>{t.stock.unitCost}</span>
                  <input className={control} inputMode="decimal" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} />
                  <span className="text-muted-foreground">{t.stock.unitCostHint}</span>
                </label>
                <button type="button" className={primaryButton} disabled={adjust.isPending || !reason.trim() || !qty} onClick={() => adjust.mutate()}>
                  {t.save}
                </button>
              </>
            ) : null}
            {mode === "waste" && canWaste ? (
              <>
                <label className="grid gap-1 text-sm">
                  <span>{t.reason}</span>
                  <select className={control} value={wasteReason} onChange={(event) => setWasteReason(event.target.value as (typeof WASTE_REASONS)[number])}>
                    {WASTE_REASONS.map((reasonCode) => (
                      <option key={reasonCode} value={reasonCode}>{t.waste.reasons[reasonCode]}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  <span>{t.note}</span>
                  <input className={control} value={note} onChange={(event) => setNote(event.target.value)} />
                </label>
                <button type="button" className={primaryButton} disabled={waste.isPending || !qty || (wasteReason === "OTHER" && !note.trim())} onClick={() => waste.mutate()}>
                  {t.waste.submit}
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
