"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { EmptyState } from "@/components/ops/kit/empty-state";
import { Input, Select } from "@/components/ops/kit/field";
import { SegmentedControl } from "@/components/ops/kit/segmented";
import { QueryErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
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
import { InventoryFrame } from "./chrome";
import { ItemPanel } from "./item-panel";
import { formatQty } from "./qty";

type Ingredient = components["schemas"]["IngredientResponse"];
type Filter = "all" | "bought" | "made" | "off";

const MATCH: Record<Filter, (item: Ingredient) => boolean> = {
  all: (item) => item.is_active,
  bought: (item) => item.is_active && !item.is_prep,
  made: (item) => item.is_active && item.is_prep,
  off: (item) => !item.is_active,
};

/** The brand's ingredient list: what it's counted in, when to order it, and whether it's made in house. */
export function IngredientsScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const brandId = useScope((state) => state.brandId);
  const canWrite = canWriteCatalogue(me?.role);
  const [selected, setSelected] = useState<Ingredient | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState("");
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

  const all = ingredients.data ?? [];
  const categories = [...new Set(all.map((item) => item.category).filter(Boolean))].sort() as string[];
  const unitName = (id: string) => {
    const unit = units.data?.find((item) => item.id === id);
    return unit ? pickLocale(unit.name, locale) : "";
  };
  const needle = query.trim().toLowerCase();
  const rows = all
    .filter(MATCH[filter])
    .filter((item) => !category || item.category === category)
    .filter((item) => !needle || `${pickLocale(item.name, locale)} ${item.sku} ${item.category ?? ""}`.toLowerCase().includes(needle))
    .sort((a, b) => pickLocale(a.name, locale).localeCompare(pickLocale(b.name, locale), locale));

  const columns: Column<Ingredient>[] = [
    {
      key: "item",
      header: t.ing.item,
      cell: (item) => (
        <span className="grid gap-0.5">
          <span className="font-medium text-ink">{pickLocale(item.name, locale)}</span>
          <span className="text-xs text-ink-secondary">{[item.category, item.sku].filter(Boolean).join(" · ")}</span>
        </span>
      ),
    },
    { key: "unit", header: t.ing.countedIn, cell: (item) => unitName(item.base_unit_id) },
    {
      key: "order",
      header: t.ing.whenToOrder,
      cell: (item) => {
        const below = Number(item.reorder_level);
        const upTo = Number(item.par_level);
        if (!below && !upTo) return <span className="text-ink-secondary">{t.ing.noReminder}</span>;
        const unit = unitName(item.base_unit_id);
        return (
          <span className="tabular-nums">
            {fill(t.ing.levels, { below: formatQty(below, locale), upTo: formatQty(upTo, locale) })} <span className="text-ink-secondary">{unit}</span>
          </span>
        );
      },
    },
    {
      key: "status",
      header: "",
      align: "end",
      cell: (item) => (
        <span className="inline-flex flex-wrap justify-end gap-1.5">
          {item.is_prep ? <Badge tone="info">{t.ing.made}</Badge> : null}
          {item.is_active ? null : <Badge>{t.ing.notInUse}</Badge>}
        </span>
      ),
    },
  ];

  return (
    <InventoryFrame page="ingredients">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 className="text-lg font-semibold text-ink">{t.ing.title}</h2>
          <p className="text-sm text-ink-secondary">{t.ing.intro}</p>
        </div>
        {canWrite ? (
          <Button disabled={!units.data} onClick={() => setSelected("new")}>
            <Plus aria-hidden />
            {t.easy.addItem}
          </Button>
        ) : null}
      </div>

      {ingredients.isError ? <QueryErrorState error={ingredients.error} screen={t.tabs.ingredients} onRetry={() => void ingredients.refetch()} /> : null}

      {ingredients.isSuccess && all.length === 0 ? (
        <EmptyState
          title={t.ing.emptyTitle}
          body={t.ing.emptyBody}
          action={
            canWrite ? (
              <Button disabled={!units.data} onClick={() => setSelected("new")}>
                <Plus aria-hidden />
                {t.easy.addItem}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl<Filter>
              label={t.ing.item}
              value={filter}
              onValueChange={setFilter}
              items={(["all", "bought", "made", "off"] as const).map((value) => ({
                value,
                label: `${t.ing.filters[value]} · ${formatQty(all.filter(MATCH[value]).length, locale)}`,
              }))}
            />
            <Input icon={Search} type="search" className="min-w-0 flex-1 basis-48" aria-label={t.ing.search} placeholder={t.ing.search} value={query} onChange={(event) => setQuery(event.target.value)} />
            {categories.length > 1 ? (
              <Select className="w-48" aria-label={t.easy.categoryLabel} value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">{t.ing.allCategories}</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
          <DataTable
            caption={t.ing.title}
            columns={columns}
            rows={rows}
            rowKey={(item) => item.id}
            onRowClick={setSelected}
            selectedKey={selected && selected !== "new" ? selected.id : null}
            loading={ingredients.isLoading}
            empty={t.ing.none}
          />
        </div>
      )}

      {selected && units.data ? (
        <ItemPanel
          key={selected === "new" ? "new" : selected.id}
          brandId={brandId ?? ""}
          ingredient={selected === "new" ? null : selected}
          units={units.data}
          existing={all}
          canWrite={canWrite}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </InventoryFrame>
  );
}
