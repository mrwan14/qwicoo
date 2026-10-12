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

type Unit = components["schemas"]["UnitResponse"];
type Dimension = components["schemas"]["UnitDimension"];

export function UnitsScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const brandId = useScope((state) => state.brandId);
  const canWrite = canWriteCatalogue(me?.role);
  const [open, setOpen] = useState(false);
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
    queryKey: ["inventory", "conversions", brandId, "brand"],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/conversions", { params: { query: { brand_id: brandId ?? "" } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items.filter((item) => item.ingredient_id == null);
    },
  });

  return (
    <InventoryFrame page="units">
      <PageHeader
        title={t.units.title}
        detail={t.units.detail}
        action={canWrite ? <button type="button" className={primaryButton} onClick={() => setOpen(true)}>{t.units.add}</button> : null}
      />
      {units.isLoading ? <LoadingState label={t.loading} /> : null}
      {units.isError ? <QueryErrorState error={units.error} screen={t.tabs.units} onRetry={() => void units.refetch()} /> : null}
      {units.data && units.data.length === 0 ? <EmptyState title={t.units.empty} body={t.units.detail} /> : null}
      {units.data && units.data.length > 0 ? (
        <div className="overflow-x-auto bg-card">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b">
                {[t.units.code, t.ingredient, t.units.dimension, t.units.base].map((label) => (
                  <th key={label} className="px-3 py-2 text-start font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.data.map((unit) => (
                <tr key={unit.id} className="border-b">
                  <td className="px-3 py-2">{unit.code}</td>
                  <td className="px-3 py-2">{pickLocale(unit.name, locale)}</td>
                  <td className="px-3 py-2">{t.units.dimensions[unit.dimension]}</td>
                  <td className="px-3 py-2">{unit.is_base ? t.units.base : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <h2 className="font-medium">{t.units.brandConversions}</h2>
      <p className="text-sm text-muted-foreground">{t.units.conversionHint}</p>
      <BrandConversions brandId={brandId ?? ""} units={units.data ?? []} rows={conversions.data ?? []} canWrite={canWrite} />
      {open && brandId ? <UnitDrawer brandId={brandId} onClose={() => setOpen(false)} /> : null}
    </InventoryFrame>
  );
}

function BrandConversions({
  brandId,
  units,
  rows,
  canWrite,
}: {
  brandId: string;
  units: Unit[];
  rows: components["schemas"]["ConversionResponse"][];
  canWrite: boolean;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [fromUnit, setFromUnit] = useState("");
  const [toUnit, setToUnit] = useState("");
  const [factor, setFactor] = useState("");
  const name = (id: string) => {
    const unit = units.find((item) => item.id === id);
    return unit ? pickLocale(unit.name, locale) : id;
  };
  const add = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/conversions", {
        params: { query: { brand_id: brandId } },
        body: { from_unit_id: fromUnit, to_unit_id: toUnit, factor, ingredient_id: null },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      setFactor("");
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
  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm">
          <span>{fill(t.ingredients.conversionHint, { from: name(row.from_unit_id), factor: row.factor, to: name(row.to_unit_id) })}</span>
          {canWrite ? <button type="button" className={secondaryButton} onClick={() => remove.mutate(row.id)}>{t.ingredients.remove}</button> : null}
        </div>
      ))}
      {canWrite ? (
        <div className="grid gap-2 sm:grid-cols-4">
          <select className={control} value={fromUnit} onChange={(event) => setFromUnit(event.target.value)}>
            <option value="">{t.ingredients.fromUnit}</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code}</option>)}
          </select>
          <select className={control} value={toUnit} onChange={(event) => setToUnit(event.target.value)}>
            <option value="">{t.ingredients.toUnit}</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.code}</option>)}
          </select>
          <input className={control} inputMode="decimal" placeholder={t.ingredients.factor} value={factor} onChange={(event) => setFactor(event.target.value)} />
          <button type="button" className={primaryButton} disabled={!fromUnit || !toUnit || !factor || add.isPending} onClick={() => add.mutate()}>{t.ingredients.addConversion}</button>
        </div>
      ) : null}
    </div>
  );
}

function UnitDrawer({ brandId, onClose }: { brandId: string; onClose: () => void }) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [dimension, setDimension] = useState<Dimension>("COUNT");
  const save = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/units", {
        params: { query: { brand_id: brandId } },
        body: { code: code.trim(), name: { en: nameEn.trim(), ar: nameAr.trim() }, dimension, is_base: false },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.saved);
      await queryClient.invalidateQueries({ queryKey: ["inventory", "units", brandId] });
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  return (
    <Sheet open onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto rounded-none sm:max-w-lg">
        <SheetHeader><SheetTitle>{t.units.add}</SheetTitle></SheetHeader>
        <form className="grid gap-3 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
          <label className="grid gap-1 text-sm"><span>{t.units.code}</span><input className={control} value={code} onChange={(event) => setCode(event.target.value)} required /></label>
          <label className="grid gap-1 text-sm"><span>{t.units.nameEn}</span><input className={control} value={nameEn} onChange={(event) => setNameEn(event.target.value)} required /></label>
          <label className="grid gap-1 text-sm"><span>{t.units.nameAr}</span><input className={control} value={nameAr} onChange={(event) => setNameAr(event.target.value)} required dir="rtl" /></label>
          <label className="grid gap-1 text-sm">
            <span>{t.units.dimension}</span>
            <select className={control} value={dimension} onChange={(event) => setDimension(event.target.value as Dimension)}>
              {(["WEIGHT", "VOLUME", "COUNT"] as const).map((item) => <option key={item} value={item}>{t.units.dimensions[item]}</option>)}
            </select>
          </label>
          <button type="submit" className={primaryButton} disabled={save.isPending}>{t.save}</button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
