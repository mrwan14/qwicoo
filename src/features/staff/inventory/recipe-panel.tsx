"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ops/kit/button";
import { Input, Select } from "@/components/ops/kit/field";
import { formatAmount } from "@/components/ops/kit/money";
import { PanelSection, SidePanel } from "@/components/ops/kit/side-panel";
import { SegmentedControl } from "@/components/ops/kit/segmented";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import { foodCostPct, foodCostTone, unitsFor, validAmount } from "./easy";
import { formatQty } from "./qty";
import { convertQty, type ConversionEdge } from "./units";

type Recipe = components["schemas"]["RecipeResponse"];
type Ingredient = components["schemas"]["IngredientResponse"];
export type TargetKind = "MENU_ITEM" | "MODIFIER_OPTION" | "PREP";
/** A recipe to start: what kind, and optionally which dish (from "Dishes without a recipe"). */
export type RecipeTarget = { kind: TargetKind; id: string };
type Line = {
  key: number;
  ingredientId: string;
  qty: string;
  unitId: string;
  waste: string;
  insteadOf: string;
};

let nextKey = 1;
const blank = (patch: Partial<Line> = {}): Line => ({
  key: nextKey++,
  ingredientId: "",
  qty: "",
  unitId: "",
  waste: "",
  insteadOf: "",
  ...patch,
});
const WASTE = /^\d{1,2}(\.\d{1,2})?$/;

/**
 * Build or edit a recipe as a list of ingredients and amounts, with the cost per portion and
 * the food cost worked out as you type from this store's current prices.
 */
export function RecipePanel({
  brandId,
  recipe,
  target,
  items,
  options,
  ingredients,
  warehouseId,
  currency,
  serverCost,
  canWrite,
  onClose,
}: {
  brandId: string;
  recipe: Recipe | null;
  target: RecipeTarget | null;
  items: { id: string; name: string; price: string }[];
  options: { id: string; name: string; itemName: string; price: string }[];
  ingredients: Ingredient[];
  warehouseId: string;
  currency: string;
  /** The saved recipe's cost from the server, shown until the recipe is changed. */
  serverCost?: { cost: string; price: string | null } | null;
  canWrite: boolean;
  onClose: () => void;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<TargetKind>((recipe?.target_type as TargetKind) ?? target?.kind ?? "MENU_ITEM");
  const [targetId, setTargetId] = useState(recipe?.menu_item_id ?? recipe?.modifier_option_id ?? recipe?.prep_ingredient_id ?? target?.id ?? "");
  const [yieldQty, setYieldQty] = useState(recipe ? String(Number(recipe.yield_qty)) : "1");
  const [lines, setLines] = useState<Line[]>(() =>
    recipe?.lines?.length
      ? recipe.lines.map((line) =>
          blank({
            ingredientId: line.ingredient_id,
            qty: String(Number(line.qty)),
            unitId: line.unit_id,
            waste: Number(line.waste_pct) ? String(Number(line.waste_pct)) : "",
            insteadOf: line.replaces_ingredient_id ?? "",
          }),
        )
      : [blank()],
  );
  const [tried, setTried] = useState(false);
  const [showWaste, setShowWaste] = useState<Set<number>>(new Set());
  // Until something changes, a saved recipe shows the exact cost the server worked out.
  const [dirty, setDirty] = useState(false);

  const units = useQuery({
    queryKey: ["inventory", "units", brandId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/units", {
        params: { query: { brand_id: brandId } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const conversions = useQuery({
    queryKey: ["inventory", "conversions", brandId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/conversions", {
        params: { query: { brand_id: brandId } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  // The store's average cost per base unit prices the estimate.
  const stock = useQuery({
    queryKey: ["inventory", "stock", warehouseId],
    enabled: Boolean(warehouseId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/warehouses/{warehouse_id}/stock", { params: { path: { warehouse_id: warehouseId } } });
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
  const byIngredient = new Map(ingredients.map((item) => [item.id, item]));
  const avgCost = new Map((stock.data ?? []).map((row) => [row.ingredient_id, Number(row.avg_cost)]));
  const money = (value: number | string) => formatAmount(value, currency, locale);

  const choices =
    kind === "MENU_ITEM"
      ? items.map((item) => ({ id: item.id, label: item.name }))
      : kind === "MODIFIER_OPTION"
        ? options.map((option) => ({
            id: option.id,
            label: `${option.itemName} · ${option.name}`,
          }))
        : ingredients
            .filter((item) => item.is_prep)
            .map((item) => ({
              id: item.id,
              label: pickLocale(item.name, locale),
            }));
  const targetLabel = choices.find((choice) => choice.id === targetId)?.label ?? "";
  const price =
    kind === "MENU_ITEM" ? items.find((item) => item.id === targetId)?.price : kind === "MODIFIER_OPTION" ? options.find((option) => option.id === targetId)?.price : null;

  const checked = lines.map((line, index) => {
    const ingredient = byIngredient.get(line.ingredientId);
    const unitId = line.unitId || ingredient?.base_unit_id || "";
    const duplicate = Boolean(line.ingredientId) && lines.findIndex((other) => other.ingredientId === line.ingredientId) !== index;
    const amountOk = validAmount(line.qty);
    const wasteOk = !line.waste.trim() || (WASTE.test(line.waste.trim()) && Number(line.waste) < 100);
    let cost: number | null = null;
    if (ingredient && amountOk) {
      const base = convertQty(line.qty, edges, ingredient.id, unitId, ingredient.base_unit_id);
      const unitCost = avgCost.get(ingredient.id);
      if (base != null && unitCost != null && unitCost > 0) cost = base * unitCost * (1 + (Number(line.waste) || 0) / 100);
    }
    return {
      line,
      ingredient,
      unitId,
      duplicate,
      amountOk,
      wasteOk,
      cost,
      complete: Boolean(ingredient) && amountOk && wasteOk && !duplicate,
    };
  });
  const portions = Number(yieldQty) > 0 ? Number(yieldQty) : 1;
  const priced = checked.filter((row) => row.cost != null);
  const estimated = priced.length ? priced.reduce((sum, row) => sum + (row.cost ?? 0), 0) / portions : null;
  const exact = recipe && !dirty && serverCost ? Number(serverCost.cost) : null;
  const estimate = exact ?? estimated;
  const pct = estimate != null && price != null ? foodCostPct(estimate, price) : null;
  const yieldOk = validAmount(yieldQty);
  const ready = canWrite && Boolean(targetId) && yieldOk && checked.length > 0 && checked.every((row) => row.complete);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        target_type: kind,
        menu_item_id: kind === "MENU_ITEM" ? targetId : null,
        modifier_option_id: kind === "MODIFIER_OPTION" ? targetId : null,
        prep_ingredient_id: kind === "PREP" ? targetId : null,
        yield_qty: yieldQty.trim() || "1",
        lines: checked.map((row) => ({
          ingredient_id: row.line.ingredientId,
          qty: row.line.qty.trim(),
          unit_id: row.unitId,
          waste_pct: row.line.waste.trim() || "0",
          replaces_ingredient_id: kind === "MODIFIER_OPTION" && row.line.insteadOf ? row.line.insteadOf : null,
        })),
      };
      const result = recipe
        ? await browserApi.PUT("/api/v1/inventory/recipes/{recipe_id}", {
            params: {
              path: { recipe_id: recipe.id },
              query: { brand_id: brandId },
            },
            body,
          })
        : await browserApi.POST("/api/v1/inventory/recipes", {
            params: { query: { brand_id: brandId } },
            body,
          });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.rx.recipeSaved);
      await queryClient.invalidateQueries({
        queryKey: ["inventory", "recipes", brandId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["inventory", "recipe-cost"],
      });
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });

  function update(key: number, patch: Partial<Line>) {
    setDirty(true);
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }
  const unitName = (id: string) => {
    const unit = units.data?.find((item) => item.id === id);
    return unit ? pickLocale(unit.name, locale) : "";
  };
  const fixedTarget = Boolean(recipe) || Boolean(target?.id);

  return (
    <SidePanel
      open
      size="lg"
      onOpenChange={(open) => !open && onClose()}
      title={targetLabel || t.rx.editorNew}
      description={recipe || target?.id ? t.rx.kinds[kind] : undefined}
      footer={
        <div className="grid w-full gap-3">
          <div className="grid gap-1 rounded-staff bg-subtle px-3.5 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-ink-secondary">
                {exact != null ? t.rx.costs : t.rx.estimate}
                {portions !== 1 ? ` · ${t.rx.perPortion}` : ""}
              </span>
              <span className="text-lg font-semibold tabular-nums">{estimate != null ? money(estimate) : t.rx.noCostYet}</span>
            </div>
            {price != null ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink-secondary">
                  {t.rx.price} {money(price)}
                  {estimate != null ? ` · ${t.rx.keep} ${money(Number(price) - estimate)}` : ""}
                </span>
                <FoodCostBar pct={pct} />
              </div>
            ) : null}
            {exact == null ? <span className="text-xs text-ink-secondary">{t.rx.estimateNote}</span> : null}
          </div>
          {tried && !ready ? (
            <p role="alert" className="text-xs text-danger">
              {t.rx.checkLines}
            </p>
          ) : null}
          {canWrite ? (
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
                {save.isPending ? t.easy.saving : t.rx.saveRecipe}
              </Button>
            </div>
          ) : null}
        </div>
      }
    >
      {!fixedTarget ? (
        <div className="grid gap-3">
          <span className="text-sm font-semibold text-ink">{t.rx.forWhat}</span>
          <SegmentedControl<TargetKind>
            label={t.rx.forWhat}
            value={kind}
            className="w-full [&>button]:flex-1 [&>button]:justify-center"
            onValueChange={(next) => {
              setKind(next);
              setTargetId("");
            }}
            items={(["MENU_ITEM", "MODIFIER_OPTION", "PREP"] as const).map((value) => ({ value, label: t.rx.kinds[value] }))}
          />
          {kind === "PREP" && choices.length === 0 ? (
            <p className="rounded-staff bg-subtle px-3 py-2.5 text-sm text-ink-secondary">{t.rx.noPrepItems}</p>
          ) : (
            <Select value={targetId} aria-label={t.rx.forWhat} aria-invalid={tried && !targetId ? true : undefined} onChange={(event) => setTargetId(event.target.value)}>
              <option value="">{kind === "MENU_ITEM" ? t.rx.pickDish : kind === "MODIFIER_OPTION" ? t.rx.pickAddon : t.rx.pickPrep}</option>
              {choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
            </Select>
          )}
        </div>
      ) : null}

      <PanelSection
        title={`${t.rx.ingredientsTitle} · ${lines.length}`}
        hint={fill(t.rx.ingredientsHint, {
          portion: kind === "PREP" ? t.rx.batch : t.rx.portion,
        })}
      >
        <ul className="grid gap-3">
          {checked.map(({ line, ingredient, unitId, duplicate, amountOk, wasteOk, cost }) => {
            const choicesForUnit = ingredient ? unitsFor(units.data ?? [], edges, ingredient.id, ingredient.base_unit_id) : [];
            const qtyBad = (tried || line.qty.trim().length > 0) && !amountOk;
            return (
              <li key={line.key} className="grid gap-2 rounded-staff border border-border bg-canvas p-3">
                <div className="flex items-start gap-2">
                  <Select
                    className="min-w-0 flex-1"
                    aria-label={t.rx.pickIngredient}
                    aria-invalid={(tried && !ingredient) || duplicate ? true : undefined}
                    value={line.ingredientId}
                    onChange={(event) =>
                      update(line.key, {
                        ingredientId: event.target.value,
                        unitId: "",
                      })
                    }
                  >
                    <option value="">{t.rx.pickIngredient}</option>
                    {ingredients.map((item) => (
                      <option key={item.id} value={item.id}>
                        {pickLocale(item.name, locale)}
                      </option>
                    ))}
                  </Select>
                  {lines.length > 1 && canWrite ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t.rx.removeIngredient}
                      onClick={() => {
                        setDirty(true);
                        setLines((current) => current.filter((item) => item.key !== line.key));
                      }}
                    >
                      <X aria-hidden />
                    </Button>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    inputMode="decimal"
                    className="w-28 tabular-nums"
                    aria-label={t.quantity}
                    placeholder={t.quantity}
                    aria-invalid={qtyBad ? true : undefined}
                    value={line.qty}
                    onChange={(event) =>
                      update(line.key, {
                        qty: event.target.value.replace(/[^\d.]/g, ""),
                      })
                    }
                  />
                  {choicesForUnit.length > 1 ? (
                    <Select className="w-32" aria-label={t.unit} value={unitId} onChange={(event) => update(line.key, { unitId: event.target.value })}>
                      {choicesForUnit.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {pickLocale(unit.name, locale)}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <span className="inline-flex h-[42px] min-w-16 items-center justify-center rounded-staff bg-subtle px-3 text-sm text-ink-secondary">
                      {unitName(unitId) || t.unit}
                    </span>
                  )}
                  <span className="ms-auto text-sm tabular-nums text-ink-secondary">{cost != null ? money(cost) : ""}</span>
                </div>
                {duplicate ? <p className="text-xs text-danger">{t.rx.duplicateLine}</p> : qtyBad ? <p className="text-xs text-danger">{t.easy.enterAmount}</p> : null}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  {line.waste !== "" || showWaste.has(line.key) ? (
                    <label className="inline-flex items-center gap-2 text-ink-secondary">
                      {t.rx.wasteLabel}
                      <Input
                        inputMode="decimal"
                        className="h-9 w-20 tabular-nums"
                        placeholder="0"
                        title={t.rx.wasteHint}
                        aria-invalid={!wasteOk ? true : undefined}
                        value={line.waste}
                        onChange={(event) =>
                          update(line.key, {
                            waste: event.target.value.replace(/[^\d.]/g, ""),
                          })
                        }
                      />
                    </label>
                  ) : canWrite ? (
                    <button
                      type="button"
                      className="text-[13px] text-ink-secondary underline-offset-4 hover:text-ink hover:underline"
                      onClick={() => setShowWaste((current) => new Set(current).add(line.key))}
                    >
                      + {t.rx.wasteLabel}
                    </button>
                  ) : null}
                  {kind === "MODIFIER_OPTION" ? (
                    <label className="inline-flex min-w-0 flex-1 items-center gap-2 text-ink-secondary">
                      {t.rx.insteadOf}
                      <Select className="min-w-0 flex-1 [&_select]:h-9" value={line.insteadOf} onChange={(event) => update(line.key, { insteadOf: event.target.value })}>
                        <option value="">{t.rx.insteadOfNone}</option>
                        {ingredients.map((item) => (
                          <option key={item.id} value={item.id}>
                            {pickLocale(item.name, locale)}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {canWrite ? (
          <Button variant="secondary" size="field" className="w-fit" onClick={() => setLines((current) => [...current, blank()])}>
            <Plus aria-hidden />
            {t.rx.addIngredient}
          </Button>
        ) : null}
      </PanelSection>

      <PanelSection title={t.rx.yieldLabel} hint={t.rx.yieldHint}>
        <Input
          inputMode="decimal"
          className="w-28 tabular-nums"
          aria-label={t.rx.yieldLabel}
          aria-invalid={!yieldOk ? true : undefined}
          value={yieldQty}
          onChange={(event) => {
            setDirty(true);
            setYieldQty(event.target.value.replace(/[^\d.]/g, ""));
          }}
        />
      </PanelSection>
    </SidePanel>
  );
}

const BAR: Record<ReturnType<typeof foodCostTone>, string> = {
  good: "bg-success",
  watch: "bg-warning",
  high: "bg-danger",
  none: "bg-border",
};

/** A short bar filled to the food cost share, coloured by how healthy it is. */
export function FoodCostBar({ pct }: { pct: number | null }) {
  const { locale } = useLocale();
  const tone = foodCostTone(pct);
  if (pct == null) return <span className="text-ink-secondary">—</span>;
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-subtle">
        <span className={cn("block h-full rounded-full", BAR[tone])} style={{ width: `${Math.min(pct, 100)}%` }} />
      </span>
      <span className={cn("text-sm font-semibold tabular-nums", tone === "high" && "text-danger")}>{formatQty(pct, locale)}%</span>
    </span>
  );
}
