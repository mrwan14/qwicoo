"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { History, Trash2 } from "lucide-react";

import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { formatAmount } from "@/components/ops/kit/money";
import { Panel } from "@/components/ops/kit/panel";
import { Money } from "@/components/ops/money";
import { PageHeader } from "@/components/ops/page-header";
import { LoadingState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { formatCairoDateTime } from "@/lib/format/time";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { control, InventoryFrame, primaryButton, useBranchCurrency, useWarehouses, WarehouseSelect } from "./chrome";
import { unitsFor, validAmount } from "./easy";
import { formatQty } from "./qty";
import { Chip } from "./stock-screen";

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
  const queryClient = useQueryClient();
  const currency = useBranchCurrency();
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
  const conversions = useQuery({
    queryKey: ["inventory", "conversions", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/conversions", { params: { query: { brand_id: brandId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  // Only the units this item converts to, starting with its own; the item's unit is the default.
  const ingredient = (ingredients.data ?? []).find((item) => item.id === ingredientId);
  const edges = (conversions.data ?? []).map((edge) => ({ ingredientId: edge.ingredient_id, fromUnitId: edge.from_unit_id, toUnitId: edge.to_unit_id, factor: edge.factor }));
  const unitChoices = ingredient ? unitsFor(units.data ?? [], edges, ingredient.id, ingredient.base_unit_id) : [];
  const chosenUnit = unitChoices.some((unit) => unit.id === unitId) ? unitId : (ingredient?.base_unit_id ?? "");
  const amountOk = validAmount(qty);
  const ready = Boolean(selected && ingredient && chosenUnit && amountOk && (reason !== "OTHER" || note.trim()));
  const save = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/warehouses/{warehouse_id}/waste", {
        params: { path: { warehouse_id: selected } },
        body: { ingredient_id: ingredientId, qty: qty.trim(), unit_id: chosenUnit, reason_code: reason, note: note.trim() || null },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.saved);
      setQty("");
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["inventory", "waste", selected] });
      await queryClient.invalidateQueries({ queryKey: ["inventory", "stock", selected] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });

  const field = `${control} h-11 text-base`;
  const label = "grid gap-1.5 text-sm";
  const caption = "text-ink-secondary";

  return (
    <InventoryFrame page="waste">
      <PageHeader title={t.waste.title} detail={t.waste.detail} />
      {warehouses.isLoading || ingredients.isLoading ? <LoadingState label={t.loading} /> : null}
      {/* The form stays narrow and close to the hand; what was logged sits beside it to check against. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
        <Panel title={t.waste.submit} icon={Trash2} padded>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            {warehouses.data && warehouses.data.length > 1 ? (
              <WarehouseSelect warehouses={warehouses.data} value={selected} onChange={setWarehouseId} />
            ) : null}
            <label className={label}>
              <span className={caption}>{t.ingredient}</span>
              <select className={field} value={ingredientId} onChange={(event) => { setIngredientId(event.target.value); setUnitId(""); }} required>
                <option value="">{t.ingredient}</option>
                {(ingredients.data ?? []).map((item) => <option key={item.id} value={item.id}>{pickLocale(item.name, locale)}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <label className={label}>
                <span className={caption}>{t.quantity}</span>
                <input className={`${field} tabular-nums`} inputMode="decimal" aria-invalid={qty.trim() && !amountOk ? true : undefined} value={qty} onChange={(event) => setQty(event.target.value.replace(/[^\d.]/g, ""))} required />
              </label>
              <label className={label}>
                <span className={caption}>{t.unit}</span>
                <select className={field} value={chosenUnit} disabled={!ingredient} onChange={(event) => setUnitId(event.target.value)} required>
                  {!ingredient ? <option value="">{t.unit}</option> : null}
                  {unitChoices.map((unit) => <option key={unit.id} value={unit.id}>{pickLocale(unit.name, locale)}</option>)}
                </select>
              </label>
              {qty.trim() && !amountOk ? <span className="col-span-2 -mt-2 text-xs text-danger">{t.easy.enterAmount}</span> : null}
            </div>
            <fieldset className="grid gap-1.5">
              <legend className="mb-1.5 text-sm text-ink-secondary">{t.reason}</legend>
              <div className="flex flex-wrap gap-2">
                {REASONS.map((item) => (
                  <Chip key={item} active={reason === item} onClick={() => setReason(item)}>
                    {t.waste.reasons[item]}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <label className={label}>
              <span className={caption}>{reason === "OTHER" ? t.easy.noteNeeded : t.easy.noteOptional}</span>
              <input className={field} value={note} onChange={(event) => setNote(event.target.value)} required={reason === "OTHER"} />
            </label>
            <button type="submit" className={`${primaryButton} h-12 w-full text-base`} disabled={save.isPending || !ready}>{t.waste.submit}</button>
          </form>
        </Panel>
        <WasteHistory warehouseId={selected} currency={currency} ingredients={ingredients.data ?? []} />
      </div>
    </InventoryFrame>
  );
}

/** The Cairo calendar day of an ISO time, as YYYY-MM-DD. */
function cairoDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

type WasteRow = components["schemas"]["WasteEventResponse"];

function WasteHistory({
  warehouseId,
  currency,
  ingredients,
}: {
  warehouseId: string;
  currency: string;
  ingredients: { id: string; name: { en?: string | null; ar?: string | null } }[];
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const history = useQuery({
    queryKey: ["inventory", "waste", warehouseId],
    enabled: Boolean(warehouseId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/warehouses/{warehouse_id}/waste", {
        params: { path: { warehouse_id: warehouseId }, query: { limit: 50 } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const byId = new Map(ingredients.map((item) => [item.id, item]));
  const rows = history.data ?? [];
  const today = cairoDay(new Date().toISOString());
  const todayCost = rows.filter((row) => cairoDay(row.created_at) === today).reduce((sum, row) => sum + (Number(row.total_cost) || 0), 0);
  const columns: Column<WasteRow>[] = [
    { key: "when", header: t.movements.when, cell: (row) => <span className="whitespace-nowrap tabular-nums">{formatCairoDateTime(row.created_at, locale)}</span> },
    { key: "item", header: t.ingredient, strong: true, cell: (row) => { const item = byId.get(row.ingredient_id); return item ? pickLocale(item.name, locale) : row.ingredient_sku; } },
    { key: "qty", header: t.quantity, align: "end", cell: (row) => <span className="tabular-nums">{formatQty(row.qty, locale)}</span> },
    {
      key: "reason",
      header: t.waste.reason,
      cell: (row) => {
        const reason = REASONS.find((item) => item === row.reason_code);
        return (
          <span className="grid gap-0.5">
            <span>{reason ? t.waste.reasons[reason] : row.reason_code}</span>
            {row.note ? <span className="text-xs text-ink-secondary">{row.note}</span> : null}
          </span>
        );
      },
    },
    { key: "who", header: t.movements.who, cell: (row) => <span className="text-ink-secondary">{row.created_by_name ?? "—"}</span> },
    { key: "value", header: t.stock.value, align: "end", cell: (row) => <Money amount={row.total_cost} currency={currency} /> },
  ];
  return (
    <Panel
      title={t.waste.recent}
      icon={History}
      action={rows.length > 0 ? <span className="font-medium text-ink tabular-nums">{fill(t.waste.today, { amount: formatAmount(todayCost, currency, locale) })}</span> : undefined}
    >
      <DataTable
        stack
        flush
        caption={t.waste.recent}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={history.isLoading}
        empty={t.waste.empty}
      />
    </Panel>
  );
}
