"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ops/kit/button";
import { Field, Input, Select } from "@/components/ops/kit/field";
import { PanelSection, SidePanel } from "@/components/ops/kit/side-panel";
import { QueryErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import { canWriteCentralKitchen } from "./access";
import { useWarehouses } from "./chrome";
import { unitsFor, validAmount } from "./easy";
import { formatQty } from "./qty";
import { transferTargets, warehouseLabel } from "./transfers";
import { convertQty, type ConversionEdge } from "./units";

type Line = { key: number; ingredientId: string; unitId: string; qty: string };

let nextKey = 1;
const blank = (ingredientId = ""): Line => ({ key: nextKey++, ingredientId, unitId: "", qty: "" });

/**
 * Ask to move stock from this branch's store to another store. Shows what each store holds,
 * offers only the units an item converts to, and checks amounts before sending.
 */
export function MoveStockPanel({ brandId, presetIngredient, onClose }: { brandId: string; presetIngredient: string; onClose: () => void }) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const me = useStaffSession();
  const warehouses = useWarehouses();
  // Only stores this role may take stock out of can be the source.
  const sources = (warehouses.data ?? []).filter((item) => item.kind !== "CENTRAL_KITCHEN" || canWriteCentralKitchen(me?.role));
  const [fromChoice, setFromChoice] = useState("");
  const fromId = fromChoice || sources[0]?.id || "";
  const [toChoice, setToChoice] = useState("");
  const [lines, setLines] = useState<Line[]>(() => [blank(presetIngredient)]);
  const [tried, setTried] = useState(false);

  const destinations = useQuery({
    queryKey: ["inventory", "transfer-destinations", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/brands/{brand_id}/transfer-destinations", {
        params: { path: { brand_id: brandId } },
      });
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
  // What the sending store holds, so each line can say how much is there.
  const stock = useQuery({
    queryKey: ["inventory", "stock", fromId],
    enabled: Boolean(fromId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/warehouses/{warehouse_id}/stock", { params: { path: { warehouse_id: fromId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });

  const targets = transferTargets(destinations.data ?? [], fromId);
  const toId = targets.some((item) => item.id === toChoice) ? toChoice : targets.length === 1 ? targets[0].id : "";
  const edges: ConversionEdge[] = useMemo(
    () => (conversions.data ?? []).map((edge) => ({ ingredientId: edge.ingredient_id, fromUnitId: edge.from_unit_id, toUnitId: edge.to_unit_id, factor: edge.factor })),
    [conversions.data],
  );
  const byIngredient = new Map((ingredients.data ?? []).map((item) => [item.id, item]));
  const onHand = new Map((stock.data ?? []).map((row) => [row.ingredient_id, Number(row.on_hand)]));
  const unitName = (id: string) => {
    const unit = units.data?.find((item) => item.id === id);
    return unit ? pickLocale(unit.name, locale) : "";
  };

  const checked = lines.map((line, index) => {
    const ingredient = byIngredient.get(line.ingredientId);
    const unitId = line.unitId || ingredient?.base_unit_id || "";
    const duplicate = Boolean(line.ingredientId) && lines.findIndex((other) => other.ingredientId === line.ingredientId) !== index;
    const available = ingredient ? onHand.get(ingredient.id) ?? 0 : null;
    const inBase = ingredient && validAmount(line.qty) ? convertQty(line.qty, edges, ingredient.id, unitId, ingredient.base_unit_id) : null;
    const tooMuch = available != null && inBase != null && inBase > available;
    const complete = Boolean(ingredient) && validAmount(line.qty) && !duplicate;
    return { line, ingredient, unitId, duplicate, available, tooMuch, complete };
  });
  const ready = Boolean(fromId && toId) && checked.every((row) => row.complete && !row.tooMuch);
  const fromLabel = sources.find((item) => item.id === fromId);
  const toLabel = targets.find((item) => item.id === toId);

  const save = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/transfers", {
        body: {
          from_warehouse_id: fromId,
          to_warehouse_id: toId,
          lines: checked.map((row) => ({ ingredient_id: row.line.ingredientId, unit_id: row.unitId, qty: row.line.qty.trim() })),
        },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.easy.moveSent);
      await queryClient.invalidateQueries({ queryKey: ["inventory", "transfers"] });
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });

  function update(key: number, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  const summary =
    fromLabel && toLabel
      ? fill(lines.length === 1 ? t.easy.moveSummaryOne : t.easy.moveSummaryMany, {
          count: lines.length,
          from: warehouseLabel(fromLabel, locale, t),
          to: warehouseLabel(toLabel, locale, t),
        })
      : null;

  return (
    <SidePanel
      open
      size="lg"
      onOpenChange={(open) => !open && onClose()}
      title={t.easy.moveTitle}
      description={t.easy.moveHint}
      footer={
        <div className="grid w-full gap-2">
          {tried && !ready ? (
            <p role="alert" className="text-xs text-danger">
              {t.easy.moveCheck}
            </p>
          ) : summary ? (
            <p className="text-xs text-ink-secondary">{summary}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button
              disabled={save.isPending || targets.length === 0}
              aria-disabled={!ready ? true : undefined}
              className={!ready ? "opacity-60" : undefined}
              onClick={() => (ready ? save.mutate() : setTried(true))}
            >
              {save.isPending ? t.easy.saving : t.easy.moveSubmit}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-2">
        <Field label={t.easy.moveFrom}>
          {sources.length > 1 ? (
            <Select value={fromId} onChange={(event) => setFromChoice(event.target.value)}>
              {sources.map((item) => (
                <option key={item.id} value={item.id}>
                  {warehouseLabel(item, locale, t)}
                </option>
              ))}
            </Select>
          ) : (
            <span className="inline-flex h-[42px] items-center rounded-staff bg-subtle px-3 text-sm text-ink">{fromLabel ? warehouseLabel(fromLabel, locale, t) : "…"}</span>
          )}
        </Field>
        <ArrowDown aria-hidden className="mx-auto size-4 text-ink-secondary" />
        <Field label={t.easy.moveTo}>
          {destinations.isError ? (
            <QueryErrorState error={destinations.error} screen={t.tabs.transfers} onRetry={() => void destinations.refetch()} />
          ) : targets.length === 0 && destinations.isSuccess ? (
            <p className="rounded-staff bg-subtle px-3 py-2.5 text-sm text-ink-secondary">{t.easy.moveNoTargets}</p>
          ) : (
            <Select value={toId} onChange={(event) => setToChoice(event.target.value)} aria-invalid={tried && !toId ? true : undefined}>
              <option value="">{t.easy.moveToPick}</option>
              {targets.map((item) => (
                <option key={item.id} value={item.id}>
                  {warehouseLabel(item, locale, t)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <PanelSection title={`${t.easy.moveItems} · ${lines.length}`}>
        <ul className="grid gap-3">
          {checked.map(({ line, ingredient, unitId, duplicate, available, tooMuch }) => {
            const choices = ingredient ? unitsFor(units.data ?? [], edges, ingredient.id, ingredient.base_unit_id) : [];
            const baseName = ingredient ? unitName(ingredient.base_unit_id) : "";
            const amountBad = (tried || line.qty.trim().length > 0) && !validAmount(line.qty);
            return (
              <li key={line.key} className="grid gap-2 rounded-staff border border-border bg-canvas p-3">
                <div className="flex items-start gap-2">
                  <Select
                    className="min-w-0 flex-1"
                    aria-label={t.easy.item}
                    aria-invalid={(tried && !ingredient) || duplicate ? true : undefined}
                    value={line.ingredientId}
                    onChange={(event) => update(line.key, { ingredientId: event.target.value, unitId: "" })}
                  >
                    <option value="">{t.easy.movePickItem}</option>
                    {(ingredients.data ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {pickLocale(item.name, locale)}
                      </option>
                    ))}
                  </Select>
                  {lines.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t.easy.moveRemoveLine}
                      onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                    >
                      <X aria-hidden />
                    </Button>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Input
                    inputMode="decimal"
                    className="min-w-0 flex-1 tabular-nums"
                    aria-label={t.quantity}
                    placeholder={t.quantity}
                    aria-invalid={amountBad || tooMuch ? true : undefined}
                    value={line.qty}
                    onChange={(event) => update(line.key, { qty: event.target.value.replace(/[^\d.]/g, "") })}
                  />
                  {choices.length > 1 ? (
                    <Select className="w-36" aria-label={t.unit} value={unitId} onChange={(event) => update(line.key, { unitId: event.target.value })}>
                      {choices.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {pickLocale(unit.name, locale)}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <span className="inline-flex h-[42px] min-w-16 items-center justify-center rounded-staff bg-subtle px-3 text-sm text-ink-secondary">{baseName || t.unit}</span>
                  )}
                </div>
                {duplicate ? (
                  <p className="text-xs text-danger">{t.easy.moveDuplicate}</p>
                ) : tooMuch && available != null ? (
                  <p className="text-xs text-danger">{fill(t.easy.moveTooMuch, { qty: formatQty(available, locale), unit: baseName })}</p>
                ) : amountBad ? (
                  <p className="text-xs text-danger">{t.easy.enterAmount}</p>
                ) : ingredient && available != null ? (
                  <p className="text-xs text-ink-secondary">{fill(t.easy.moveAvailable, { qty: formatQty(available, locale), unit: baseName })}</p>
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
