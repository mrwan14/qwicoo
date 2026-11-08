"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { PageHeader } from "@/components/ops/page-header";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { canWriteCatalogue } from "./access";
import { control, InventoryFrame, primaryButton } from "./chrome";
import { ItemPanel } from "./item-panel";

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
        action={canWrite ? <button type="button" className={primaryButton} onClick={() => setSelected("new")}>{t.easy.addItem}</button> : null}
      />
      <label className="grid max-w-sm gap-1 text-sm">
        <span className="text-ink-secondary">{t.search}</span>
        <input className={control} value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {ingredients.isLoading ? <LoadingState label={t.loading} /> : null}
      {ingredients.isError ? <QueryErrorState error={ingredients.error} screen={t.tabs.ingredients} onRetry={() => void ingredients.refetch()} /> : null}
      {ingredients.data && rows.length === 0 ? <EmptyState title={t.ingredients.empty} body={t.ingredients.detail} /> : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto bg-canvas">
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
      {selected && units.data ? (
        <ItemPanel
          key={selected === "new" ? "new" : selected.id}
          brandId={brandId ?? ""}
          ingredient={selected === "new" ? null : selected}
          units={units.data}
          existing={ingredients.data ?? []}
          canWrite={canWrite}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </InventoryFrame>
  );
}

function unitName(units: Unit[], id: string, locale: "en" | "ar") {
  const unit = units.find((item) => item.id === id);
  return unit ? pickLocale(unit.name, locale) : "";
}
