"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ops/kit/button";
import { Field, Input, Select } from "@/components/ops/kit/field";
import { PanelSection, SidePanel } from "@/components/ops/kit/side-panel";
import { formatAmount } from "@/components/ops/kit/money";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { INVENTORY_HREFS, useBranchCurrency, useWarehouses } from "./chrome";
import { packPricePerUnit, unitsFor, validAmount } from "./easy";
import { warehouseLabel } from "./transfers";
import { conversionFactor, type ConversionEdge } from "./units";

/** autoPrice: the price came from the supplier, so it follows a change of supplier or unit. */
type Line = { key: number; ingredientId: string; unitId: string; qty: string; price: string; autoPrice: boolean };
export type OrderPrefill = { suggest: boolean; ingredientId: string; qty: string };

let nextKey = 1;
const blank = (patch: Partial<Line> = {}): Line => ({ key: nextKey++, ingredientId: "", unitId: "", qty: "", price: "", autoPrice: false, ...patch });
const PRICE = /^\d+(\.\d{1,2})?$/;

/** A draft purchase order: supplier, then items with amount and price, and a running total. */
export function NewOrderPanel({ branchId, prefill, onClose }: { branchId: string; prefill: OrderPrefill; onClose: () => void }) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const brandId = useScope((state) => state.brandId) ?? "";
  const currency = useBranchCurrency();
  const queryClient = useQueryClient();
  const warehouses = useWarehouses();
  const stores = (warehouses.data ?? []).filter((item) => item.kind !== "CENTRAL_KITCHEN");
  const [storeChoice, setStoreChoice] = useState("");
  const storeId = storeChoice || stores[0]?.id || "";
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<Line[]>(() => [blank({ ingredientId: prefill.ingredientId, qty: prefill.qty })]);
  const [tried, setTried] = useState(false);
  const suggested = useRef(false);

  const suppliers = useQuery({
    queryKey: ["inventory", "suppliers", brandId, false],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/suppliers", { params: { query: { brand_id: brandId, include_inactive: false } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
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
  // The supplier's packs carry the unit and last price they sell each item at.
  const packs = useQuery({
    queryKey: ["inventory", "supplier", supplierId],
    enabled: Boolean(supplierId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/suppliers/{supplier_id}", { params: { path: { supplier_id: supplierId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.packs ?? [];
    },
  });

  const edges: ConversionEdge[] = useMemo(
    () => (conversions.data ?? []).map((edge) => ({ ingredientId: edge.ingredient_id, fromUnitId: edge.from_unit_id, toUnitId: edge.to_unit_id, factor: edge.factor })),
    [conversions.data],
  );
  const byIngredient = new Map((ingredients.data ?? []).map((item) => [item.id, item]));
  const packFor = (ingredientId: string) => (packs.data ?? []).find((pack) => pack.ingredient_id === ingredientId);

  // The supplier's last pack price, turned into a price for one of the line's own unit. The amount and unit the
  // cashier chose are never changed; only the price is suggested.
  const suggestPrice = (ingredientId: string, unitId: string): string | null => {
    const pack = packFor(ingredientId);
    const ingredient = byIngredient.get(ingredientId);
    if (!pack || !ingredient) return null;
    const factor = conversionFactor(edges, ingredientId, unitId || ingredient.base_unit_id, pack.pack_unit_id);
    // last_price buys one pack of pack_size pack units (the Suppliers page shows "EGP 120 · 12 Piece").
    return packPricePerUnit(pack.last_price, pack.pack_size, factor);
  };
  const priced = (line: Line): Line => {
    if (!line.ingredientId || (line.price && !line.autoPrice)) return line;
    const price = suggestPrice(line.ingredientId, line.unitId);
    return { ...line, price: price ?? "", autoPrice: price != null };
  };
  // A new supplier re-prices the lines it priced before, and clears prices it can't offer.
  useEffect(() => {
    if (supplierId && !packs.data) return;
    setLines((current) => {
      const next = current.map(priced);
      return next.some((line, index) => line.price !== current[index].price || line.autoPrice !== current[index].autoPrice) ? next : current;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-price when the supplier's packs or conversions arrive
  }, [packs.data, supplierId, edges]);

  const fillLow = useMutation({
    mutationFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/warehouses/{warehouse_id}/purchase-suggestions", { params: { path: { warehouse_id: storeId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items.filter((item) => Number(item.suggested_qty) > 0);
    },
    onSuccess: (items) => {
      if (items.length === 0) {
        toast.message(t.easy.filledNone);
        return;
      }
      setLines((current) => {
        const kept = current.filter((line) => line.ingredientId && !items.some((item) => item.ingredient_id === line.ingredientId));
        const added = items.map((item) => priced(blank({ ingredientId: item.ingredient_id, qty: String(Number(item.suggested_qty)) })));
        return [...kept, ...added];
      });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  // "Order these" on the Stock page opens with the low items already listed.
  useEffect(() => {
    if (!prefill.suggest || suggested.current || !storeId) return;
    suggested.current = true;
    fillLow.mutate();
  }, [prefill.suggest, storeId, fillLow]);

  const checked = lines.map((line, index) => {
    const ingredient = byIngredient.get(line.ingredientId);
    const duplicate = Boolean(line.ingredientId) && lines.findIndex((other) => other.ingredientId === line.ingredientId) !== index;
    const unitId = line.unitId || ingredient?.base_unit_id || "";
    const priceOk = PRICE.test(line.price.trim());
    const complete = Boolean(ingredient) && validAmount(line.qty) && priceOk && !duplicate;
    const total = complete ? Number(line.qty) * Number(line.price) : 0;
    return { line, ingredient, unitId, priceOk, complete, total, duplicate };
  });
  const filled = checked.filter((row) => row.line.ingredientId || row.line.qty || row.line.price);
  const ready = Boolean(storeId && supplierId) && filled.length > 0 && filled.every((row) => row.complete);
  const total = checked.reduce((sum, row) => sum + row.total, 0);

  const save = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/purchase-orders", {
        body: {
          warehouse_id: storeId,
          supplier_id: supplierId,
          lines: filled.map((row) => ({ ingredient_id: row.line.ingredientId, unit_id: row.unitId, qty: row.line.qty.trim(), unit_price: row.line.price.trim() })),
        },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.easy.orderSaved);
      await queryClient.invalidateQueries({ queryKey: ["inventory", "purchase-orders", branchId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory", "branch-overview"] });
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });

  function update(key: number, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }
  const unitName = (id: string) => {
    const unit = units.data?.find((item) => item.id === id);
    return unit ? pickLocale(unit.name, locale) : "";
  };

  return (
    <SidePanel
      open
      size="lg"
      onOpenChange={(open) => !open && onClose()}
      title={t.easy.orderTitle}
      description={t.easy.orderHint}
      footer={
        <div className="grid w-full gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-ink-secondary">{t.easy.orderTotal}</span>
            <span className="text-lg font-semibold tabular-nums">{formatAmount(total, currency, locale)}</span>
          </div>
          {tried && !ready ? (
            <p role="alert" className="text-xs text-danger">
              {t.easy.orderCheck}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button
              disabled={save.isPending}
              aria-disabled={!ready ? true : undefined}
              className={!ready ? "opacity-60" : undefined}
              onClick={() => (ready ? save.mutate() : setTried(true))}
            >
              {save.isPending ? t.easy.saving : t.easy.orderSubmit}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.purchaseOrders.supplier}>
          {suppliers.isSuccess && suppliers.data.length === 0 ? (
            <p className="text-sm text-ink-secondary">
              {t.easy.noSuppliers}{" "}
              <Link href={INVENTORY_HREFS.suppliers} className="font-medium text-ink underline underline-offset-4">
                {t.tabs.suppliers}
              </Link>
            </p>
          ) : (
            <Select value={supplierId} aria-invalid={tried && !supplierId ? true : undefined} onChange={(event) => setSupplierId(event.target.value)}>
              <option value="">{t.easy.supplierPick}</option>
              {(suppliers.data ?? []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t.easy.deliverTo}>
          {stores.length > 1 ? (
            <Select value={storeId} onChange={(event) => setStoreChoice(event.target.value)}>
              {stores.map((item) => (
                <option key={item.id} value={item.id}>
                  {warehouseLabel(item, locale, t)}
                </option>
              ))}
            </Select>
          ) : (
            <span className="inline-flex h-[42px] items-center rounded-staff bg-subtle px-3 text-sm text-ink">{stores[0] ? warehouseLabel(stores[0], locale, t) : "…"}</span>
          )}
        </Field>
      </div>

      <PanelSection
        title={`${t.easy.moveItems} · ${lines.length}`}
        action={
          <Button variant="ghost" size="sm" disabled={!storeId || fillLow.isPending} onClick={() => fillLow.mutate()}>
            <Sparkles aria-hidden />
            {fillLow.isPending ? t.easy.filling : t.easy.fillLow}
          </Button>
        }
      >
        <ul className="grid gap-3">
          {checked.map(({ line, ingredient, unitId, priceOk, total: lineTotal, duplicate }) => {
            const choices = ingredient ? unitsFor(units.data ?? [], edges, ingredient.id, ingredient.base_unit_id) : [];
            const unitLabel = unitName(unitId);
            const qtyBad = (tried || line.qty.trim().length > 0) && !validAmount(line.qty);
            const priceBad = (tried || line.price.trim().length > 0) && !priceOk;
            return (
              <li key={line.key} className="grid gap-2 rounded-staff border border-border bg-canvas p-3">
                <div className="flex items-start gap-2">
                  <Select
                    className="min-w-0 flex-1"
                    aria-label={t.easy.item}
                    aria-invalid={(tried && !ingredient) || duplicate ? true : undefined}
                    value={line.ingredientId}
                    onChange={(event) => {
                      const next = priced({ ...line, ingredientId: event.target.value, unitId: "", price: "", autoPrice: false });
                      update(line.key, next);
                    }}
                  >
                    <option value="">{t.easy.movePickItem}</option>
                    {(ingredients.data ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {pickLocale(item.name, locale)}
                      </option>
                    ))}
                  </Select>
                  {lines.length > 1 ? (
                    <Button variant="ghost" size="icon" aria-label={t.easy.moveRemoveLine} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>
                      <X aria-hidden />
                    </Button>
                  ) : null}
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                  <Input
                    inputMode="decimal"
                    className="tabular-nums"
                    aria-label={t.quantity}
                    placeholder={t.quantity}
                    aria-invalid={qtyBad ? true : undefined}
                    value={line.qty}
                    onChange={(event) => update(line.key, { qty: event.target.value.replace(/[^\d.]/g, "") })}
                  />
                  {choices.length > 1 ? (
                    <Select className="w-32" aria-label={t.unit} value={unitId} onChange={(event) => update(line.key, line.autoPrice ? priced({ ...line, unitId: event.target.value }) : { unitId: event.target.value })}>
                      {choices.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {pickLocale(unit.name, locale)}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <span className="inline-flex h-[42px] min-w-16 items-center justify-center rounded-staff bg-subtle px-3 text-sm text-ink-secondary">{unitLabel || t.unit}</span>
                  )}
                  <Input
                    inputMode="decimal"
                    className="col-span-2 tabular-nums sm:col-span-1"
                    aria-label={fill(t.easy.pricePer, { unit: unitLabel || t.unit })}
                    placeholder={fill(t.easy.pricePer, { unit: unitLabel || t.unit })}
                    aria-invalid={priceBad ? true : undefined}
                    value={line.price}
                    onChange={(event) => update(line.key, { price: event.target.value.replace(/[^\d.]/g, ""), autoPrice: false })}
                  />
                </div>
                {duplicate ? (
                  <p className="text-xs text-danger">{t.easy.moveDuplicate}</p>
                ) : qtyBad ? (
                  <p className="text-xs text-danger">{t.easy.enterAmount}</p>
                ) : lineTotal > 0 ? (
                  <p className="text-end text-xs text-ink-secondary tabular-nums">{formatAmount(lineTotal, currency, locale)}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
        <Button variant="secondary" size="field" className="w-fit" onClick={() => setLines((current) => [...current, blank()])}>
          <Plus aria-hidden />
          {t.easy.moveAddLine}
        </Button>
      </PanelSection>
    </SidePanel>
  );
}
