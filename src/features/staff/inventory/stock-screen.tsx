"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { ArrowLeftRight, ClipboardList, Download, History, Plus, Search, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ops/kit/badge";
import { Button, buttonClass } from "@/components/ops/kit/button";
import { Card } from "@/components/ops/kit/card";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { Field, Input, Select, Textarea } from "@/components/ops/kit/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ops/kit/menu";
import { SegmentedControl } from "@/components/ops/kit/segmented";
import { SidePanel } from "@/components/ops/kit/side-panel";
import { Money } from "@/components/ops/money";
import { StatusChip } from "@/components/ops/status-chip";
import { QueryErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import type { LocaleCode } from "@/lib/i18n/locale-text";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { canOpenInventoryPage, canRecordWaste, canWriteCatalogue, canWriteCentralKitchen, canWriteStock } from "./access";
import { INVENTORY_HREFS, InventoryFrame, useBranchCurrency, useWarehouses, WarehouseSelect } from "./chrome";
import { needsAttention, suggestedOrder, unitsFor, validAmount } from "./easy";
import { downloadFromApi } from "./files";
import { ItemPanel } from "./item-panel";
import { formatQty, lineValue } from "./qty";
import { convertQty, type ConversionEdge } from "./units";

type StockRow = components["schemas"]["StockRowResponse"];
type Unit = components["schemas"]["UnitResponse"];
type Filter = "all" | "low" | "out";
const WASTE_REASONS = ["EXPIRED", "SPOILED", "DROPPED", "OVERPRODUCTION", "STAFF_MEAL", "OTHER"] as const;
const SHOWN_NEEDS = 6;

export function StockScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const currency = useBranchCurrency();
  const brandId = useScope((state) => state.brandId);
  const warehouses = useWarehouses();
  const [warehouseId, setWarehouseId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [moreFilters, setMoreFilters] = useState(false);
  const [category, setCategory] = useState("");
  const [displayUnitId, setDisplayUnitId] = useState("");
  const [row, setRow] = useState<StockRow | null>(null);
  const [adding, setAdding] = useState(false);
  const canAddItem = canWriteCatalogue(me?.role);
  // Matches the API: stock managers export their store; brand admins can export every store at once.
  const canExport = Boolean(me && canWriteStock(me.role));
  const canExportAll = canWriteCatalogue(me?.role);
  const exportStock = useMutation({
    mutationFn: (input: { format: "xlsx" | "csv"; all: boolean }) =>
      downloadFromApi(
        "/inventory/stock/export",
        { brand_id: brandId ?? "", format: input.format, ...(input.all ? {} : { warehouse_id: selected }) },
        `stock.${input.format}`,
        t.loadFailed,
        locale,
      ),
    onError: (error: Error) => toast.error(error.message),
  });
  const selected = warehouseId || warehouses.data?.[0]?.id || "";
  const warehouse = warehouses.data?.find((item) => item.id === selected);
  const central = warehouse?.kind === "CENTRAL_KITCHEN";
  const centralLocked = central && !canWriteCentralKitchen(me?.role);
  const canAdjust = Boolean(me && canWriteStock(me.role) && !centralLocked);
  const canWaste = Boolean(me && canRecordWaste(me.role) && !centralLocked);
  // Purchase orders are for branch stores; a central kitchen is filled by transfers.
  const canOrder = Boolean(me && canWriteStock(me.role) && canOpenInventoryPage(me.role, "purchaseOrders") && !central);

  const stock = useQuery({
    queryKey: ["inventory", "stock", selected, "with-unstocked"],
    enabled: Boolean(selected),
    queryFn: async () => {
      // include_unstocked lists new items at 0; older backends ignore it and the merge below covers them.
      const result = await browserApi.GET("/api/v1/inventory/warehouses/{warehouse_id}/stock", {
        params: { path: { warehouse_id: selected }, query: { include_unstocked: true } },
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

  const edges: ConversionEdge[] = useMemo(
    () =>
      (conversions.data ?? []).map((edge) => ({
        ingredientId: edge.ingredient_id,
        fromUnitId: edge.from_unit_id,
        toUnitId: edge.to_unit_id,
        factor: edge.factor,
      })),
    [conversions.data],
  );
  const byIngredient = useMemo(() => new Map((ingredients.data ?? []).map((item) => [item.id, item])), [ingredients.data]);
  const byUnit = useMemo(() => new Map((units.data ?? []).map((item) => [item.id, item])), [units.data]);
  const categories = [...new Set((ingredients.data ?? []).map((item) => item.category).filter(Boolean))] as string[];
  // An item with no stock movement yet may have no stock row. List it at 0 so a new item can
  // be found and stocked here; rows the API already returns win.
  const all = useMemo(() => {
    if (!stock.data) return [];
    const stocked = new Set(stock.data.map((row) => row.ingredient_id));
    const missing: StockRow[] = (ingredients.data ?? [])
      .filter((item) => item.is_active && !stocked.has(item.id))
      .map((item) => ({
        ingredient_id: item.id,
        name: item.name,
        sku: item.sku,
        on_hand: "0",
        par_level: item.par_level,
        reorder_level: item.reorder_level,
        avg_cost: "0",
        base_unit_code: "",
        // Same rule as the backend's stock_status: nothing on hand is "out".
        status: "out",
      }));
    return [...stock.data, ...missing];
  }, [stock.data, ingredients.data]);
  const unstocked = useMemo(() => new Set(all.filter((row) => !stock.data?.some((item) => item.ingredient_id === row.ingredient_id)).map((row) => row.ingredient_id)), [all, stock.data]);
  // Switched-off items aren't ordered any more, so they don't belong in "need ordering".
  const inactive = useMemo(() => new Set((ingredients.data ?? []).filter((item) => !item.is_active).map((item) => item.id)), [ingredients.data]);
  const needs = needsAttention(all.filter((row) => !inactive.has(row.ingredient_id)));

  const needle = query.trim().toLowerCase();
  const rows = all.filter((item) => {
    const meta = byIngredient.get(item.ingredient_id);
    const matchesQuery =
      !needle ||
      pickLocale(item.name, locale).toLowerCase().includes(needle) ||
      item.sku.toLowerCase().includes(needle) ||
      (meta?.category ?? "").toLowerCase().includes(needle);
    const matchesFilter =
      filter === "all" || (filter === "low" ? item.status === "low" : item.status === "out" || item.status === "negative");
    const matchesCategory = !category || meta?.category === category;
    return matchesQuery && matchesFilter && matchesCategory;
  });

  const unitLabel = (item: StockRow) => {
    const meta = byIngredient.get(item.ingredient_id);
    const base = meta ? byUnit.get(meta.base_unit_id) : undefined;
    return base ? pickLocale(base.name, locale) : item.base_unit_code;
  };
  const shown = (item: StockRow, qty: string) => {
    const meta = byIngredient.get(item.ingredient_id);
    return showQty(qty, item.ingredient_id, meta?.base_unit_id, displayUnitId, edges, meta ? byUnit.get(meta.base_unit_id) : undefined, units.data ?? [], locale, item.base_unit_code);
  };

  const columns: Column<StockRow>[] = [
    {
      key: "item",
      header: t.easy.item,
      strong: true,
      cell: (item) => (
        <span className="grid gap-0.5">
          <span className="font-medium">{pickLocale(item.name, locale)}</span>
          <span className="text-xs font-normal text-ink-secondary">
            {unstocked.has(item.ingredient_id) ? t.easy.noStockYet : byIngredient.get(item.ingredient_id)?.category || item.sku}
          </span>
        </span>
      ),
    },
    {
      key: "onHand",
      header: t.stock.onHand,
      align: "end",
      cell: (item) => {
        const value = shown(item, item.on_hand);
        return (
          <span className={cn("tabular-nums", item.status !== "ok" && "font-semibold")}>
            {value.qty} <span className="font-normal text-ink-secondary">{value.unit}</span>
          </span>
        );
      },
    },
    { key: "below", header: t.stock.reorder, align: "end", cell: (item) => <span className="tabular-nums text-ink-secondary">{shown(item, item.reorder_level).qty}</span> },
    { key: "upTo", header: t.stock.par, align: "end", cell: (item) => <span className="tabular-nums text-ink-secondary">{shown(item, item.par_level).qty}</span> },
    { key: "cost", header: t.stock.avgCost, align: "end", cell: (item) => <Money amount={item.avg_cost} currency={currency} /> },
    { key: "value", header: t.stock.value, align: "end", cell: (item) => <Money amount={lineValue(item.on_hand, item.avg_cost)} currency={currency} /> },
    {
      key: "status",
      header: t.stock.status,
      cell: (item) => <StatusChip tone={item.status === "ok" ? "available" : item.status === "low" ? "browsing" : "soldout"}>{t.status[item.status]}</StatusChip>,
    },
  ];

  const storeCount = warehouses.data?.length ?? 0;

  return (
    <InventoryFrame page="stock">
      {warehouses.isError ? <QueryErrorState error={warehouses.error} screen={t.tabs.stock} onRetry={() => void warehouses.refetch()} /> : null}
      {stock.isError ? <QueryErrorState error={stock.error} screen={t.tabs.stock} onRetry={() => void stock.refetch()} /> : null}

      {stock.data ? (
        <NeedsOrdering
          rows={needs}
          canOrder={canOrder}
          unitLabel={unitLabel}
          onOpen={setRow}
        />
      ) : null}

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {storeCount > 1 && warehouses.data ? (
            <div className="w-full sm:w-64">
              <WarehouseSelect warehouses={warehouses.data} value={selected} onChange={setWarehouseId} />
            </div>
          ) : null}
          <Input
            icon={Search}
            type="search"
            className="min-w-0 flex-1 basis-56"
            aria-label={t.easy.search}
            placeholder={t.easy.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <SegmentedControl<Filter>
            label={t.stock.status}
            value={filter}
            onValueChange={setFilter}
            items={[
              { value: "all", label: t.easy.filterAll },
              { value: "low", label: t.easy.filterLow },
              { value: "out", label: t.easy.filterOut },
            ]}
          />
          <Button variant="ghost" size="sm" aria-expanded={moreFilters} onClick={() => setMoreFilters((value) => !value)}>
            {moreFilters ? t.easy.fewerFilters : t.easy.moreFilters}
          </Button>
          {canExport ? (
            <Menu>
              <MenuTrigger className={cn(buttonClass({ variant: "secondary", size: "field" }), "ms-auto")} disabled={exportStock.isPending || !selected}>
                <Download aria-hidden />
                {exportStock.isPending ? t.easy.exporting : t.easy.export}
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem onClick={() => exportStock.mutate({ format: "xlsx", all: false })}>{t.easy.exportExcel}</MenuItem>
                <MenuItem onClick={() => exportStock.mutate({ format: "csv", all: false })}>{t.easy.exportCsv}</MenuItem>
                {canExportAll ? (
                  <>
                    <MenuSeparator />
                    <MenuItem onClick={() => exportStock.mutate({ format: "xlsx", all: true })}>{t.easy.exportAll}</MenuItem>
                  </>
                ) : null}
              </MenuContent>
            </Menu>
          ) : null}
          {canAddItem ? (
            <Button size="field" className={canExport ? undefined : "ms-auto"} disabled={!units.data} onClick={() => setAdding(true)}>
              <Plus aria-hidden />
              {t.easy.addItem}
            </Button>
          ) : null}
        </div>
        {moreFilters ? (
          <div className="grid gap-3 rounded-staff border border-border bg-subtle p-3 sm:grid-cols-2">
            <Field label={t.stock.category}>
              <Select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">{t.all}</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.displayUnit}>
              <Select value={displayUnitId} onChange={(event) => setDisplayUnitId(event.target.value)}>
                <option value="">{t.baseUnit}</option>
                {(units.data ?? []).map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {pickLocale(unit.name, locale)} ({unit.code})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}
        <DataTable
          caption={t.stock.title}
          columns={columns}
          rows={rows}
          rowKey={(item) => item.ingredient_id}
          onRowClick={setRow}
          selectedKey={row?.ingredient_id ?? null}
          loading={warehouses.isLoading || stock.isLoading}
          empty={all.length === 0 ? t.stock.empty : t.easy.noMatch}
        />
        {rows.length > 0 ? <p className="text-xs text-ink-secondary">{t.easy.tapRow}</p> : null}
      </div>

      {adding && units.data ? (
        <ItemPanel brandId={brandId ?? ""} ingredient={null} units={units.data} existing={ingredients.data ?? []} canWrite={canAddItem} onClose={() => setAdding(false)} />
      ) : null}
      {row ? (
        <StockItemPanel
          key={row.ingredient_id}
          row={row}
          warehouseId={selected}
          units={unitsFor(units.data ?? [], edges, row.ingredient_id, byIngredient.get(row.ingredient_id)?.base_unit_id)}
          unitLabel={unitLabel(row)}
          edges={edges}
          baseUnitId={byIngredient.get(row.ingredient_id)?.base_unit_id}
          canAdjust={canAdjust}
          canWaste={canWaste}
          canOrder={canOrder}
          canCount={Boolean(me && canOpenInventoryPage(me.role, "counts") && !centralLocked)}
          canMove={Boolean(me && canWriteStock(me.role) && !centralLocked)}
          onClose={() => setRow(null)}
        />
      ) : null}
    </InventoryFrame>
  );
}

function orderHref(row: StockRow) {
  const qty = suggestedOrder(row);
  return `${INVENTORY_HREFS.purchaseOrders}?new=1&ingredient=${row.ingredient_id}${qty > 0 ? `&qty=${qty}` : ""}`;
}

/** What to order next: the low and out items with how much to order. */
function NeedsOrdering({
  rows,
  canOrder,
  unitLabel,
  onOpen,
}: {
  rows: StockRow[];
  canOrder: boolean;
  unitLabel: (row: StockRow) => string;
  onOpen: (row: StockRow) => void;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-staff border border-border bg-canvas px-4 py-3 text-sm text-ink-secondary" role="status">
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-success" />
        {t.easy.needsNone}
      </p>
    );
  }
  const visible = expanded ? rows : rows.slice(0, SHOWN_NEEDS);
  return (
    <Card
      title={rows.length === 1 ? t.easy.needsOne : fill(t.easy.needsCount, { count: rows.length })}
      action={
        canOrder ? (
          <Link href={`${INVENTORY_HREFS.purchaseOrders}?new=1&suggest=1`} className={buttonClass({ size: "sm" })}>
            <ShoppingCart aria-hidden />
            {t.easy.orderAll}
          </Link>
        ) : undefined
      }
    >
      <ul className="-mx-4 divide-y divide-border border-t border-border">
        {visible.map((item) => {
          const unit = unitLabel(item);
          const qty = suggestedOrder(item);
          const out = item.status !== "low";
          return (
            <li key={item.ingredient_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
              <button
                type="button"
                className="grid min-w-0 flex-1 basis-48 gap-0.5 text-start focus-visible:outline-2 focus-visible:outline-focus"
                onClick={() => onOpen(item)}
              >
                <span className="text-sm font-medium text-ink">{pickLocale(item.name, locale)}</span>
                <span className="text-xs text-ink-secondary">
                  {out ? t.easy.outNow : fill(t.easy.left, { qty: formatQty(item.on_hand, locale), unit })}
                </span>
              </button>
              <Badge tone={out ? "danger" : "warning"}>{out ? t.status.out : t.status.low}</Badge>
              {canOrder ? (
                <Link href={orderHref(item)} className={buttonClass({ variant: "secondary", size: "sm" })}>
                  {qty > 0 ? fill(t.easy.suggest, { qty: formatQty(qty, locale), unit }) : t.easy.order}
                </Link>
              ) : qty > 0 ? (
                <span className="text-xs text-ink-secondary">{fill(t.easy.suggest, { qty: formatQty(qty, locale), unit })}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {rows.length > SHOWN_NEEDS ? (
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => setExpanded((value) => !value)}>
          {expanded ? t.easy.showFewer : fill(t.easy.showAll, { count: rows.length })}
        </Button>
      ) : null}
    </Card>
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
  fallbackUnit: string,
) {
  const display = displayUnitId ? units.find((unit) => unit.id === displayUnitId) : undefined;
  if (display && baseUnitId) {
    const converted = convertQty(qty, edges, ingredientId, baseUnitId, display.id);
    if (converted != null) return { qty: formatQty(converted, locale), unit: pickLocale(display.name, locale) };
  }
  return { qty: formatQty(qty, locale), unit: base ? pickLocale(base.name, locale) : fallbackUnit };
}

type Mode = "add" | "remove" | "waste";

/** One item: what's on hand, and add, take out or log waste in a couple of taps. */
function StockItemPanel({
  row,
  warehouseId,
  units,
  unitLabel,
  edges,
  baseUnitId,
  canAdjust,
  canWaste,
  canOrder,
  canCount,
  canMove,
  onClose,
}: {
  row: StockRow;
  warehouseId: string;
  units: Unit[];
  unitLabel: string;
  edges: ConversionEdge[];
  baseUnitId: string | undefined;
  canAdjust: boolean;
  canWaste: boolean;
  canOrder: boolean;
  canCount: boolean;
  canMove: boolean;
  onClose: () => void;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const modes: Mode[] = [...(canAdjust ? (["add", "remove"] as const) : []), ...(canWaste ? (["waste"] as const) : [])];
  const [mode, setMode] = useState<Mode>(modes[0] ?? "add");
  const [qty, setQty] = useState("");
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState(false);
  const [wasteReason, setWasteReason] = useState<(typeof WASTE_REASONS)[number]>("SPOILED");
  const [note, setNote] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const amountOk = validAmount(qty);
  const chosenUnit = units.find((unit) => unit.id === unitId);
  const chosenLabel = chosenUnit ? pickLocale(chosenUnit.name, locale) : unitLabel;
  const presets = mode === "add" ? t.easy.reasonsAdd : t.easy.reasonsRemove;
  const reasonText = reason.trim();
  // Taking out more than is here is allowed (stock can be wrong), but say so before saving.
  const outBase = amountOk && mode !== "add" && baseUnitId ? convertQty(qty, edges, row.ingredient_id, unitId, baseUnitId) : null;
  const overdraw = outBase != null && outBase > Math.max(Number(row.on_hand), 0);
  const ready = amountOk && (mode === "waste" ? wasteReason !== "OTHER" || note.trim().length > 0 : reasonText.length > 0);

  const save = useMutation({
    mutationFn: async () => {
      const amount = qty.trim();
      const result =
        mode === "waste"
          ? await browserApi.POST("/api/v1/inventory/warehouses/{warehouse_id}/waste", {
              params: { path: { warehouse_id: warehouseId } },
              body: { ingredient_id: row.ingredient_id, qty: amount, unit_id: unitId, reason_code: wasteReason, note: note.trim() || null },
            })
          : await browserApi.POST("/api/v1/inventory/warehouses/{warehouse_id}/adjustments", {
              params: { path: { warehouse_id: warehouseId } },
              body: {
                ingredient_id: row.ingredient_id,
                // The API takes one signed quantity: negative takes stock out.
                qty: mode === "remove" ? `-${amount}` : amount,
                unit_id: unitId,
                reason: reasonText,
                unit_cost: mode === "add" && unitCost.trim() ? unitCost.trim() : null,
              },
            });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.saved);
      await queryClient.invalidateQueries({ queryKey: ["inventory", "stock", warehouseId] });
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });

  const label = { qty: qty.trim() || "0", unit: chosenLabel };
  const saveLabel = mode === "add" ? fill(t.easy.saveAdd, label) : mode === "remove" ? fill(t.easy.saveRemove, label) : fill(t.easy.saveWaste, label);
  const out = row.status !== "ok" && row.status !== "low";

  return (
    <SidePanel
      open
      onOpenChange={(open) => !open && onClose()}
      title={pickLocale(row.name, locale)}
      meta={<StatusChip tone={row.status === "ok" ? "available" : row.status === "low" ? "browsing" : "soldout"}>{t.status[row.status]}</StatusChip>}
      footer={
        modes.length > 0 ? (
          <Button className="w-full" disabled={!ready || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? t.easy.saving : saveLabel}
          </Button>
        ) : undefined
      }
    >
      <dl className="grid grid-cols-3 gap-2">
        {[
          [t.easy.nowHave, `${formatQty(row.on_hand, locale)} ${unitLabel}`, out],
          [t.easy.orderBelow, formatQty(row.reorder_level, locale), false],
          [t.easy.orderUpTo, formatQty(row.par_level, locale), false],
        ].map(([term, value, alert]) => (
          <div key={String(term)} className="grid gap-1 rounded-staff bg-subtle px-3 py-2.5">
            <dt className="text-xs text-ink-secondary">{term}</dt>
            <dd className={cn("text-base font-semibold tabular-nums", alert && "text-danger")}>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2">
        {canOrder && row.status !== "ok" ? (
          <Link href={orderHref(row)} className={buttonClass({ variant: "secondary", size: "sm" })}>
            <ShoppingCart aria-hidden />
            {t.easy.order}
          </Link>
        ) : null}
        {canCount ? (
          <Link href={`${INVENTORY_HREFS.counts}?ingredient=${row.ingredient_id}`} className={buttonClass({ variant: "secondary", size: "sm" })}>
            <ClipboardList aria-hidden />
            {t.easy.countThis}
          </Link>
        ) : null}
        {canMove ? (
          <Link href={`${INVENTORY_HREFS.transfers}?ingredient=${row.ingredient_id}`} className={buttonClass({ variant: "secondary", size: "sm" })}>
            <ArrowLeftRight aria-hidden />
            {t.easy.moveThis}
          </Link>
        ) : null}
        <Link href={`${INVENTORY_HREFS.movements}?ingredient=${row.ingredient_id}`} className={buttonClass({ variant: "ghost", size: "sm" })}>
          <History aria-hidden />
          {t.easy.history}
        </Link>
      </div>

      {modes.length > 0 ? (
        <section className="grid gap-4 border-t border-border pt-4">
          {modes.length > 1 ? (
            <SegmentedControl<Mode>
              label={t.stock.adjustTitle}
              value={mode}
              onValueChange={(next) => {
                setMode(next);
                setReason("");
                setOtherReason(false);
              }}
              className="w-full [&>button]:flex-1 [&>button]:justify-center"
              items={modes.map((value) => ({ value, label: value === "add" ? t.easy.addStock : value === "remove" ? t.easy.removeStock : t.easy.logWaste }))}
            />
          ) : null}

          <Field
            label={mode === "add" ? t.easy.howMuchAdd : mode === "remove" ? t.easy.howMuchRemove : t.easy.howMuchWaste}
            error={qty.trim() && !amountOk ? t.easy.enterAmount : overdraw ? fill(t.easy.overOnHand, { qty: formatQty(Math.max(Number(row.on_hand), 0), locale), unit: unitLabel }) : undefined}
          >
            <div className="flex gap-2">
              <Input
                inputMode="decimal"
                autoFocus
                className="h-12 min-w-0 flex-1 text-lg tabular-nums"
                value={qty}
                aria-invalid={qty.trim() && !amountOk ? true : undefined}
                onChange={(event) => setQty(event.target.value.replace(/[^\d.]/g, ""))}
              />
              {units.length > 1 ? (
                <Select className="w-36 [&_select]:h-12" aria-label={t.unit} value={unitId} onChange={(event) => setUnitId(event.target.value)}>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {pickLocale(unit.name, locale)}
                    </option>
                  ))}
                </Select>
              ) : (
                <span className="inline-flex h-12 items-center rounded-staff bg-subtle px-3 text-sm text-ink-secondary">{chosenLabel}</span>
              )}
            </div>
          </Field>

          {mode === "waste" ? (
            <>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-ink-secondary">{t.easy.why}</span>
                <div className="flex flex-wrap gap-2">
                  {WASTE_REASONS.map((code) => (
                    <Chip key={code} active={wasteReason === code} onClick={() => setWasteReason(code)}>
                      {t.waste.reasons[code]}
                    </Chip>
                  ))}
                </div>
              </div>
              <Field label={wasteReason === "OTHER" ? t.easy.noteNeeded : t.easy.noteOptional}>
                <Textarea className="min-h-16" value={note} onChange={(event) => setNote(event.target.value)} />
              </Field>
            </>
          ) : (
            <>
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-ink-secondary">{t.easy.why}</span>
                <div className="flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <Chip
                      key={preset}
                      active={!otherReason && reason === preset}
                      onClick={() => {
                        setOtherReason(false);
                        setReason(preset);
                      }}
                    >
                      {preset}
                    </Chip>
                  ))}
                  <Chip
                    active={otherReason}
                    onClick={() => {
                      setOtherReason(true);
                      setReason("");
                    }}
                  >
                    {t.easy.otherReason}
                  </Chip>
                </div>
                {otherReason ? (
                  <Input autoFocus placeholder={t.easy.typeReason} aria-label={t.easy.typeReason} value={reason} onChange={(event) => setReason(event.target.value)} />
                ) : null}
              </div>
              {mode === "add" ? (
                <Field label={fill(t.easy.costPaid, { unit: chosenLabel })} hint={t.easy.costPaidHint}>
                  <Input inputMode="decimal" className="max-w-40" value={unitCost} onChange={(event) => setUnitCost(event.target.value.replace(/[^\d.]/g, ""))} />
                </Field>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </SidePanel>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
        active ? "border-brand bg-brand text-on-brand" : "border-border bg-canvas text-ink hover:bg-subtle",
      )}
    >
      {children}
    </button>
  );
}
