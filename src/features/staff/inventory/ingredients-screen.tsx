"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ops/page-header";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { canWriteCatalogue } from "./access";
import { control, InventoryFrame, primaryButton, secondaryButton } from "./chrome";

type Ingredient = components["schemas"]["IngredientResponse"];
type Unit = components["schemas"]["UnitResponse"];

export function IngredientsScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const brandId = useScope((state) => state.brandId);
  const canWrite = canWriteCatalogue(me?.role);
  const [selected, setSelected] = useState<Ingredient | "new" | null>(null);
  const [query, setQuery] = useState("");
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
  const rows = (ingredients.data ?? []).filter((item) => {
    const haystack = `${item.sku} ${pickLocale(item.name, locale)} ${item.category ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <InventoryFrame page="ingredients">
      <PageHeader
        title={t.ingredients.title}
        detail={t.ingredients.detail}
        action={canWrite ? <button type="button" className={primaryButton} onClick={() => setSelected("new")}>{t.ingredients.add}</button> : null}
      />
      <label className="grid max-w-sm gap-1 text-sm">
        <span className="text-muted-foreground">{t.search}</span>
        <input className={control} value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {ingredients.isLoading ? <LoadingState label={t.loading} /> : null}
      {ingredients.isError ? <QueryErrorState error={ingredients.error} screen={t.tabs.ingredients} onRetry={() => void ingredients.refetch()} /> : null}
      {ingredients.data && rows.length === 0 ? <EmptyState title={t.ingredients.empty} body={t.ingredients.detail} /> : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto bg-card">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b">
                {[t.ingredients.sku, t.ingredient, t.ingredients.category, t.ingredients.base, t.ingredients.prep, t.ingredients.reorder, t.ingredients.par, t.ingredients.active].map((label) => (
                  <th key={label} className="px-3 py-2 text-start font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="cursor-pointer border-b hover:bg-muted/40" onClick={() => setSelected(item)}>
                  <td className="px-3 py-2">{item.sku}</td>
                  <td className="px-3 py-2">{pickLocale(item.name, locale)}</td>
                  <td className="px-3 py-2">{item.category ?? ""}</td>
                  <td className="px-3 py-2">{unitName(units.data ?? [], item.base_unit_id, locale)}</td>
                  <td className="px-3 py-2">{item.is_prep ? t.ingredients.prep : ""}</td>
                  <td className="px-3 py-2 tabular-nums">{item.reorder_level}</td>
                  <td className="px-3 py-2 tabular-nums">{item.par_level}</td>
                  <td className="px-3 py-2">{item.is_active ? t.ingredients.active : t.ingredients.inactive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <IngredientDrawer
        key={selected === "new" ? "new" : selected?.id ?? "closed"}
        brandId={brandId ?? ""}
        ingredient={selected}
        units={units.data ?? []}
        canWrite={canWrite}
        onClose={() => setSelected(null)}
      />
    </InventoryFrame>
  );
}

function unitName(units: Unit[], id: string, locale: "en" | "ar") {
  const unit = units.find((item) => item.id === id);
  return unit ? pickLocale(unit.name, locale) : "";
}

function IngredientDrawer({
  brandId,
  ingredient,
  units,
  canWrite,
  onClose,
}: {
  brandId: string;
  ingredient: Ingredient | "new" | null;
  units: Unit[];
  canWrite: boolean;
  onClose: () => void;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const current = ingredient && ingredient !== "new" ? ingredient : null;
  const [sku, setSku] = useState(current?.sku ?? "");
  const [nameEn, setNameEn] = useState(current?.name.en ?? "");
  const [nameAr, setNameAr] = useState(current?.name.ar ?? "");
  const [category, setCategory] = useState(current?.category ?? "");
  const [baseUnitId, setBaseUnitId] = useState(current?.base_unit_id ?? units.find((unit) => unit.is_base)?.id ?? "");
  const [isPrep, setIsPrep] = useState(current?.is_prep ?? false);
  const [deductAsPrep, setDeductAsPrep] = useState(current?.deduct_as_prep ?? false);
  const [reorder, setReorder] = useState(current?.reorder_level ?? "0");
  const [par, setPar] = useState(current?.par_level ?? "0");
  const [active, setActive] = useState(current?.is_active ?? true);
  const [fromUnit, setFromUnit] = useState("");
  const [toUnit, setToUnit] = useState("");
  const [factor, setFactor] = useState("");

  const conversions = useQuery({
    queryKey: ["inventory", "conversions", brandId, current?.id],
    enabled: Boolean(brandId && current),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/conversions", {
        params: { query: { brand_id: brandId, ingredient_id: current?.id } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items.filter((item) => item.ingredient_id === current?.id);
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const name = { en: nameEn.trim(), ar: nameAr.trim() };
      if (current) {
        const result = await browserApi.PATCH("/api/v1/inventory/ingredients/{ingredient_id}", {
          params: { path: { ingredient_id: current.id }, query: { brand_id: brandId } },
          body: {
            name,
            category: category.trim() || null,
            is_prep: isPrep,
            deduct_as_prep: isPrep ? deductAsPrep : false,
            reorder_level: reorder,
            par_level: par,
            is_active: active,
          },
        });
        if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
        return;
      }
      const result = await browserApi.POST("/api/v1/inventory/ingredients", {
        params: { query: { brand_id: brandId } },
        body: {
          sku: sku.trim(),
          name,
          category: category.trim() || null,
          base_unit_id: baseUnitId,
          is_prep: isPrep,
          deduct_as_prep: isPrep ? deductAsPrep : false,
          reorder_level: reorder || "0",
          par_level: par || "0",
        },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.saved);
      await queryClient.invalidateQueries({ queryKey: ["inventory", "ingredients", brandId] });
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  const addConversion = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/conversions", {
        params: { query: { brand_id: brandId } },
        body: { from_unit_id: fromUnit, to_unit_id: toUnit, factor, ingredient_id: current?.id },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      setFactor("");
      await queryClient.invalidateQueries({ queryKey: ["inventory", "conversions", brandId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  const removeConversion = useMutation({
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

  return (
    <Sheet open={ingredient !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto rounded-none sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{current ? pickLocale(current.name, locale) : t.ingredients.add}</SheetTitle>
        </SheetHeader>
        {ingredient ? (
          <form
            className="grid gap-3 px-4 pb-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (canWrite) save.mutate();
            }}
          >
            {!current ? (
              <label className="grid gap-1 text-sm"><span>{t.ingredients.sku}</span><input className={control} value={sku} onChange={(event) => setSku(event.target.value)} required /></label>
            ) : null}
            <label className="grid gap-1 text-sm"><span>{t.ingredients.nameEn}</span><input className={control} value={nameEn} onChange={(event) => setNameEn(event.target.value)} required /></label>
            <label className="grid gap-1 text-sm"><span>{t.ingredients.nameAr}</span><input className={control} value={nameAr} onChange={(event) => setNameAr(event.target.value)} required dir="rtl" /></label>
            <label className="grid gap-1 text-sm"><span>{t.ingredients.category}</span><input className={control} value={category} onChange={(event) => setCategory(event.target.value)} /></label>
            <label className="grid gap-1 text-sm">
              <span>{t.ingredients.base}</span>
              <select className={control} value={baseUnitId} disabled={Boolean(current)} onChange={(event) => setBaseUnitId(event.target.value)}>
                {units.map((unit) => <option key={unit.id} value={unit.id}>{pickLocale(unit.name, locale)} ({unit.code})</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isPrep} onChange={(event) => setIsPrep(event.target.checked)} />{t.ingredients.prep}</label>
            {isPrep ? (
              <div className="grid w-full gap-1 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="size-4 shrink-0" checked={deductAsPrep} onChange={(event) => setDeductAsPrep(event.target.checked)} />
                  <span>{t.ingredients.stockedPrep}</span>
                </label>
                <p className="text-start text-muted-foreground">{t.ingredients.stockedPrepHint}</p>
              </div>
            ) : null}
            <label className="grid gap-1 text-sm"><span>{t.ingredients.reorder}</span><input className={control} inputMode="decimal" value={reorder} onChange={(event) => setReorder(event.target.value)} /></label>
            <label className="grid gap-1 text-sm"><span>{t.ingredients.par}</span><input className={control} inputMode="decimal" value={par} onChange={(event) => setPar(event.target.value)} /></label>
            {current ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />{t.ingredients.active}</label> : null}
            {canWrite ? <button type="submit" className={primaryButton} disabled={save.isPending}>{t.save}</button> : null}
            {current ? (
              <div className="grid gap-2 border-t pt-3">
                <h3 className="font-medium">{t.ingredients.conversions}</h3>
                {(conversions.data ?? []).map((edge) => (
                  <div key={edge.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{fill(t.ingredients.conversionHint, { from: unitName(units, edge.from_unit_id, locale), factor: edge.factor, to: unitName(units, edge.to_unit_id, locale) })}</span>
                    {canWrite ? <button type="button" className={secondaryButton} onClick={() => removeConversion.mutate(edge.id)}>{t.ingredients.remove}</button> : null}
                  </div>
                ))}
                {canWrite ? (
                  <div className="grid gap-2">
                    <select className={control} value={fromUnit} onChange={(event) => setFromUnit(event.target.value)}>
                      <option value="">{t.ingredients.fromUnit}</option>
                      {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code}</option>)}
                    </select>
                    <select className={control} value={toUnit} onChange={(event) => setToUnit(event.target.value)}>
                      <option value="">{t.ingredients.toUnit}</option>
                      {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code}</option>)}
                    </select>
                    <input className={control} inputMode="decimal" placeholder={t.ingredients.factor} value={factor} onChange={(event) => setFactor(event.target.value)} />
                    <button type="button" className={secondaryButton} disabled={!fromUnit || !toUnit || !factor} onClick={() => addConversion.mutate()}>{t.ingredients.addConversion}</button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </form>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
