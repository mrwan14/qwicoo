"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ops/kit/button";
import { Field, Input, Select, Switch } from "@/components/ops/kit/field";
import { MoreOptions, PanelSection, SidePanel } from "@/components/ops/kit/side-panel";
import { useStaffSession } from "@/components/ops/staff-session";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import { canRetireCatalogue } from "./access";
import { autoSku } from "./easy";

type Ingredient = components["schemas"]["IngredientResponse"];
type Unit = components["schemas"]["UnitResponse"];

const LEVEL = /^\d+(\.\d{1,3})?$/;

/**
 * Add or edit a stock item. A new item needs only a name and the unit it is counted in;
 * the code, prep settings and extra units stay folded away.
 */
export function ItemPanel({
  brandId,
  ingredient,
  units,
  existing,
  canWrite,
  onClose,
}: {
  brandId: string;
  ingredient: Ingredient | null;
  units: Unit[];
  /** Every item in the brand, for the category suggestions and a unique code. */
  existing: Ingredient[];
  canWrite: boolean;
  onClose: () => void;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const listId = useId();
  const canRetire = canRetireCatalogue(useStaffSession()?.role);
  const current = ingredient;
  const [nameEn, setNameEn] = useState(current?.name.en ?? "");
  const [nameAr, setNameAr] = useState(current && current.name.ar !== current.name.en ? current.name.ar : "");
  const [category, setCategory] = useState(current?.category ?? "");
  const [baseUnitId, setBaseUnitId] = useState(current?.base_unit_id ?? units.find((unit) => unit.is_base)?.id ?? units[0]?.id ?? "");
  const [below, setBelow] = useState(trimLevel(current?.reorder_level ?? "0"));
  const [upTo, setUpTo] = useState(trimLevel(current?.par_level ?? "0"));
  const [sku, setSku] = useState(current?.sku ?? "");
  const [isPrep, setIsPrep] = useState(current?.is_prep ?? false);
  const [deductAsPrep, setDeductAsPrep] = useState(current?.deduct_as_prep ?? false);
  const [active, setActive] = useState(current?.is_active ?? true);

  const baseUnit = units.find((unit) => unit.id === baseUnitId);
  const baseLabel = baseUnit ? pickLocale(baseUnit.name, locale) : "";
  const categories = [...new Set(existing.map((item) => item.category).filter(Boolean))] as string[];
  const levelsValid = LEVEL.test(below.trim() || "0") && LEVEL.test(upTo.trim() || "0");
  const levelsOrdered = Number(upTo || 0) === 0 || Number(upTo) >= Number(below || 0);
  const ready = canWrite && nameEn.trim().length > 0 && Boolean(baseUnitId) && levelsValid && levelsOrdered;

  const save = useMutation({
    mutationFn: async () => {
      const name = { en: nameEn.trim(), ar: nameAr.trim() || nameEn.trim() };
      const levels = { reorder_level: below.trim() || "0", par_level: upTo.trim() || "0" };
      if (current) {
        const result = await browserApi.PATCH("/api/v1/inventory/ingredients/{ingredient_id}", {
          params: { path: { ingredient_id: current.id }, query: { brand_id: brandId } },
          body: { name, category: category.trim() || null, is_prep: isPrep, deduct_as_prep: isPrep ? deductAsPrep : false, is_active: active, ...levels },
        });
        if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
        return;
      }
      const result = await browserApi.POST("/api/v1/inventory/ingredients", {
        params: { query: { brand_id: brandId } },
        body: {
          sku: sku.trim() || autoSku(name.en, existing.map((item) => item.sku)),
          name,
          category: category.trim() || null,
          base_unit_id: baseUnitId,
          is_prep: isPrep,
          deduct_as_prep: isPrep ? deductAsPrep : false,
          ...levels,
        },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(fill(current ? t.easy.updated : t.easy.created, { name: nameEn.trim() }));
      await queryClient.invalidateQueries({ queryKey: ["inventory", "ingredients", brandId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory", "stock"] });
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });

  return (
    <SidePanel
      open
      size="lg"
      onOpenChange={(open) => !open && onClose()}
      title={current ? pickLocale(current.name, locale) : t.easy.newItem}
      description={current ? current.sku : undefined}
      footer={
        canWrite ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" form={`${listId}-form`} disabled={!ready || save.isPending}>
              {save.isPending ? t.easy.saving : current ? t.easy.saveChanges : t.easy.createItem}
            </Button>
          </>
        ) : undefined
      }
    >
      <form
        id={`${listId}-form`}
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) save.mutate();
        }}
      >
        <fieldset disabled={!canWrite} className="grid gap-4">
          <Field label={t.easy.nameLabel}>
            <Input autoFocus={!current} required placeholder={t.easy.namePlaceholder} value={nameEn} onChange={(event) => setNameEn(event.target.value)} />
          </Field>
          <Field label={t.easy.nameArLabel} hint={t.easy.nameArHint}>
            <Input dir="rtl" placeholder={nameEn.trim() || undefined} value={nameAr} onChange={(event) => setNameAr(event.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.easy.unitLabel} hint={current ? undefined : t.easy.unitHint}>
              {current ? (
                <span className="inline-flex h-[42px] items-center rounded-staff bg-subtle px-3 text-sm text-ink">{baseLabel}</span>
              ) : (
                <Select value={baseUnitId} onChange={(event) => setBaseUnitId(event.target.value)}>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {pickLocale(unit.name, locale)} ({unit.code})
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t.easy.categoryLabel}>
              <Input list={`${listId}-categories`} placeholder={t.easy.categoryPlaceholder} value={category} onChange={(event) => setCategory(event.target.value)} />
              <datalist id={`${listId}-categories`}>
                {categories.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </Field>
          </div>
        </fieldset>

        <PanelSection title={t.easy.levelsTitle} hint={t.easy.levelsHint}>
          <fieldset disabled={!canWrite} className="grid gap-4 sm:grid-cols-2">
            <LevelField label={t.easy.orderBelow} hint={t.easy.belowHint} unit={baseLabel} value={below} onChange={setBelow} />
            <LevelField label={t.easy.orderUpTo} hint={t.easy.upToHint} unit={baseLabel} value={upTo} onChange={setUpTo} />
          </fieldset>
          {!levelsOrdered ? (
            <p role="alert" className="text-xs text-danger">
              {t.easy.levelsWrong}
            </p>
          ) : null}
        </PanelSection>

        <MoreOptions label={t.easy.moreOptions} summary={[t.easy.skuLabel, t.easy.prepLabel, current && canRetire ? t.easy.activeLabel : null].filter(Boolean).join(", ")}>
          <fieldset disabled={!canWrite} className="grid gap-4">
            {current ? null : (
              <Field label={t.easy.skuLabel} hint={t.easy.skuHint}>
                <Input
                  dir="ltr"
                  placeholder={autoSku(nameEn || "ITEM", existing.map((item) => item.sku))}
                  value={sku}
                  onChange={(event) => setSku(event.target.value.toUpperCase())}
                />
              </Field>
            )}
            <ToggleRow label={t.easy.prepLabel} hint={t.easy.prepHint} checked={isPrep} onChange={setIsPrep} />
            {isPrep ? <ToggleRow label={t.ingredients.stockedPrep} hint={t.ingredients.stockedPrepHint} checked={deductAsPrep} onChange={setDeductAsPrep} /> : null}
            {current && canRetire ? <ToggleRow label={t.easy.activeLabel} hint={t.easy.activeHint} checked={active} onChange={setActive} /> : null}
          </fieldset>
        </MoreOptions>
      </form>

      {current ? <OtherUnits brandId={brandId} ingredient={current} units={units} canWrite={canWrite} /> : null}
    </SidePanel>
  );
}

function trimLevel(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : value;
}

function LevelField({ label, hint, unit, value, onChange }: { label: string; hint: string; unit: string; value: string; onChange: (value: string) => void }) {
  const t = useStaffSection(inventoryCopy);
  return (
    <Field label={label} hint={hint} error={value.trim() && !LEVEL.test(value.trim()) ? t.easy.enterAmount : undefined}>
      <div className="relative">
        <Input
          inputMode="decimal"
          className="pe-16 tabular-nums"
          value={value}
          onFocus={(event) => event.target.select()}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.]/g, ""))}
        />
        {unit ? <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-ink-secondary">{unit}</span> : null}
      </div>
    </Field>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="grid gap-0.5">
        <span id={id} className="text-sm font-medium text-ink">
          {label}
        </span>
        <span className="text-xs text-ink-secondary">{hint}</span>
      </div>
      <Switch aria-labelledby={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** "1 box = 12 pcs": the extra units an item is bought or used in. */
function OtherUnits({ brandId, ingredient, units, canWrite }: { brandId: string; ingredient: Ingredient; units: Unit[]; canWrite: boolean }) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const base = units.find((unit) => unit.id === ingredient.base_unit_id);
  const [fromUnit, setFromUnit] = useState("");
  const [factor, setFactor] = useState("");
  const name = (id: string) => {
    const unit = units.find((item) => item.id === id);
    return unit ? pickLocale(unit.name, locale) : "";
  };
  const conversions = useQuery({
    queryKey: ["inventory", "conversions", brandId, ingredient.id],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/conversions", {
        params: { query: { brand_id: brandId, ingredient_id: ingredient.id } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items.filter((item) => item.ingredient_id === ingredient.id);
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/conversions", {
        params: { query: { brand_id: brandId } },
        body: { from_unit_id: fromUnit, to_unit_id: ingredient.base_unit_id, factor: factor.trim(), ingredient_id: ingredient.id },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      setFactor("");
      setFromUnit("");
      await queryClient.invalidateQueries({ queryKey: ["inventory", "conversions", brandId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const result = await browserApi.DELETE("/api/v1/inventory/conversions/{conversion_id}", {
        params: { path: { conversion_id: id }, query: { brand_id: brandId } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventory", "conversions", brandId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  const others = units.filter((unit) => unit.id !== ingredient.base_unit_id);
  const factorOk = /^\d+(\.\d{1,6})?$/.test(factor.trim()) && Number(factor) > 0;

  return (
    <PanelSection title={t.easy.otherUnitsTitle} hint={t.easy.otherUnitsHint}>
      {(conversions.data ?? []).length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {(conversions.data ?? []).map((edge) => (
            <li key={edge.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-canvas py-1 ps-3 pe-1 text-sm text-ink">
              <span dir="ltr">{fill(t.ingredients.conversionHint, { from: name(edge.from_unit_id), factor: trimLevel(edge.factor), to: name(edge.to_unit_id) })}</span>
              {canWrite ? (
                <button
                  type="button"
                  aria-label={t.ingredients.remove}
                  className="inline-flex size-7 items-center justify-center rounded-full text-ink-secondary hover:bg-subtle hover:text-ink"
                  onClick={() => remove.mutate(edge.id)}
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {canWrite && base ? (
        <form
          className="flex flex-wrap items-center gap-2 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (fromUnit && factorOk) add.mutate();
          }}
        >
          <span className="text-ink-secondary">{t.easy.oneUnit}</span>
          <Select className="w-32" aria-label={t.ingredients.fromUnit} value={fromUnit} onChange={(event) => setFromUnit(event.target.value)}>
            <option value="">{t.unit}</option>
            {others.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {pickLocale(unit.name, locale)}
              </option>
            ))}
          </Select>
          <span className="text-ink-secondary">{t.easy.equals}</span>
          <Input inputMode="decimal" className="w-24 tabular-nums" aria-label={t.ingredients.factor} value={factor} onChange={(event) => setFactor(event.target.value.replace(/[^\d.]/g, ""))} />
          <span className="text-ink">{pickLocale(base.name, locale)}</span>
          <Button type="submit" variant="secondary" size="field" disabled={!fromUnit || !factorOk || add.isPending}>
            {t.easy.addUnit}
          </Button>
        </form>
      ) : null}
    </PanelSection>
  );
}
