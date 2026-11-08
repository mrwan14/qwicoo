"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { AlertTriangle, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ops/kit/button";
import { Card, KpiCard } from "@/components/ops/kit/card";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { EmptyState } from "@/components/ops/kit/empty-state";
import { Input, Select } from "@/components/ops/kit/field";
import { formatAmount } from "@/components/ops/kit/money";
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
import { InventoryFrame, useBranchCurrency, useWarehouses, WarehouseSelect } from "./chrome";
import { foodCostPct, foodCostTone } from "./easy";
import { formatQty } from "./qty";
import { FoodCostBar, RecipePanel, type RecipeTarget, type TargetKind } from "./recipe-panel";
import { untrackedMenu } from "./untracked";

type Recipe = components["schemas"]["RecipeResponse"];
type Cost = components["schemas"]["RecipeCostResponse"];
type Sort = "cost" | "name";
type Row = { recipe: Recipe; name: string; detail: string; cost: Cost | undefined; loading: boolean; pct: number | null };

const KINDS: TargetKind[] = ["MENU_ITEM", "MODIFIER_OPTION", "PREP"];

export function RecipesScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const brandId = useScope((state) => state.brandId) ?? "";
  const branchId = useScope((state) => state.branchId) ?? "";
  const canWrite = canWriteCatalogue(me?.role);
  const currency = useBranchCurrency();
  const warehouses = useWarehouses();
  const [warehouseId, setWarehouseId] = useState("");
  const [kind, setKind] = useState<TargetKind>("MENU_ITEM");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("cost");
  const [editing, setEditing] = useState<Recipe | RecipeTarget | null>(null);
  const selectedWarehouse = warehouseId || warehouses.data?.[0]?.id || "";

  const recipes = useQuery({
    queryKey: ["inventory", "recipes", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/recipes", { params: { query: { brand_id: brandId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const ingredients = useQuery({
    queryKey: ["inventory", "ingredients", brandId, "all"],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/ingredients", { params: { query: { brand_id: brandId, active_only: false } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const menu = useQuery({
    queryKey: ["menu", "tree", branchId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/menu/tree", { params: { query: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data;
    },
  });

  const items = useMemo(
    () =>
      (menu.data?.categories ?? []).flatMap((category) =>
        (category.items ?? []).map((item) => ({
          id: item.id,
          name: pickLocale(item.name, locale),
          category: pickLocale(category.name, locale),
          price: String(item.base_price),
        })),
      ),
    [menu.data, locale],
  );
  const options = useMemo(
    () =>
      (menu.data?.categories ?? []).flatMap((category) =>
        (category.items ?? []).flatMap((item) =>
          (item.modifier_groups ?? []).flatMap((group) =>
            (group.options ?? []).map((option) => ({
              id: option.id,
              name: pickLocale(option.name, locale),
              itemName: pickLocale(item.name, locale),
              price: String(option.price_delta),
            })),
          ),
        ),
      ),
    [menu.data, locale],
  );
  const list = useMemo(() => recipes.data ?? [], [recipes.data]);
  const costs = useQueries({
    queries: list.map((recipe) => ({
      queryKey: ["inventory", "recipe-cost", recipe.id, selectedWarehouse],
      enabled: Boolean(selectedWarehouse),
      queryFn: async () => {
        const result = await browserApi.GET("/api/v1/inventory/recipes/{recipe_id}/cost", {
          params: { path: { recipe_id: recipe.id }, query: { warehouse_id: selectedWarehouse } },
        });
        if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
        return result.data;
      },
    })),
  });
  const missing = useMemo(() => untrackedMenu(items, options, list), [items, options, list]);

  const rows: Row[] = list.map((recipe, index) => {
    const cost = costs[index]?.data;
    let name = "";
    let detail = "";
    if (recipe.target_type === "MENU_ITEM") {
      const item = items.find((entry) => entry.id === recipe.menu_item_id);
      name = item?.name ?? "";
      detail = item?.category ?? "";
    } else if (recipe.target_type === "MODIFIER_OPTION") {
      const option = options.find((entry) => entry.id === recipe.modifier_option_id);
      name = option?.name ?? "";
      detail = option?.itemName ?? "";
    } else {
      const prep = (ingredients.data ?? []).find((entry) => entry.id === recipe.prep_ingredient_id);
      name = prep ? pickLocale(prep.name, locale) : "";
      detail = prep?.category ?? "";
    }
    return { recipe, name, detail, cost, loading: costs[index]?.isLoading ?? false, pct: cost ? foodCostPct(cost.cost, cost.price) : null };
  });

  const needle = query.trim().toLowerCase();
  const visible = rows
    .filter((row) => row.recipe.target_type === kind)
    .filter((row) => !needle || row.name.toLowerCase().includes(needle) || row.detail.toLowerCase().includes(needle))
    .sort((a, b) => (sort === "cost" ? (b.pct ?? -1) - (a.pct ?? -1) : a.name.localeCompare(b.name, locale)));

  const dishes = rows.filter((row) => row.recipe.target_type === "MENU_ITEM" && row.pct != null);
  const average = dishes.length ? Math.round(dishes.reduce((sum, row) => sum + (row.pct ?? 0), 0) / dishes.length) : null;
  const tooCostly = dishes.filter((row) => foodCostTone(row.pct) === "high").length;
  const money = (value: string | number) => formatAmount(value, currency, locale);

  const columns: Column<Row>[] = [
    {
      key: "dish",
      header: t.rx.dish,
      cell: (row) => {
        const portions = Number(row.recipe.yield_qty);
        const notes = [row.detail, portions && portions !== 1 ? fill(t.rx.makes, { qty: formatQty(portions, locale) }) : ""].filter(Boolean).join(" · ");
        return (
          <span className="grid gap-0.5">
            <span className="font-medium text-ink">{row.name || "—"}</span>
            {notes ? <span className="text-xs text-ink-secondary">{notes}</span> : null}
            {row.cost && row.cost.unpriced_ingredient_ids.length > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs text-warning">
                <AlertTriangle aria-hidden className="size-3" />
                {t.rx.missingCosts}
              </span>
            ) : null}
          </span>
        );
      },
    },
    { key: "price", header: t.rx.price, align: "end", cell: (row) => <Figure loading={row.loading} value={row.cost?.price != null ? money(row.cost.price) : t.rx.noPrice} muted={row.cost?.price == null} /> },
    { key: "costs", header: t.rx.costs, align: "end", cell: (row) => <Figure loading={row.loading} value={row.cost ? money(row.cost.cost) : "—"} /> },
    { key: "food", header: t.rx.foodCost, width: 180, cell: (row) => (row.loading ? <span className="text-ink-secondary">…</span> : <FoodCostBar pct={row.pct} />) },
    {
      key: "keep",
      header: t.rx.keep,
      align: "end",
      cell: (row) => {
        const price = Number(row.cost?.price);
        const cost = Number(row.cost?.cost);
        if (!row.cost || row.cost.price == null || !Number.isFinite(price)) return <span className="text-ink-secondary">—</span>;
        return <span className="font-medium tabular-nums">{money(price - cost)}</span>;
      },
    },
  ];

  const missingCount = missing.items.length;

  return (
    <InventoryFrame page="recipes">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 className="text-lg font-semibold text-ink">{t.rx.title}</h2>
          <p className="text-sm text-ink-secondary">{t.rx.intro}</p>
        </div>
        {canWrite ? (
          <Button onClick={() => setEditing({ kind, id: "" })}>
            <Plus aria-hidden />
            {t.rx.newRecipe}
          </Button>
        ) : null}
      </div>

      {recipes.isError ? <QueryErrorState error={recipes.error} screen={t.tabs.recipes} onRetry={() => void recipes.refetch()} /> : null}

      {list.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            label={t.rx.avgFoodCost}
            value={average == null ? "—" : `${formatQty(average, locale)}%`}
            note={t.rx.avgFoodCostNote}
            loading={costs.some((query) => query.isLoading)}
          />
          <KpiCard label={t.rx.highCost} value={formatQty(tooCostly, locale)} note={t.rx.highCostNote} loading={costs.some((query) => query.isLoading)} />
          <KpiCard label={t.rx.noRecipe} value={formatQty(missingCount, locale)} note={t.rx.noRecipeNote} loading={menu.isLoading} />
        </div>
      ) : null}

      {recipes.isSuccess && list.length === 0 ? (
        <EmptyState
          title={t.rx.emptyTitle}
          body={t.rx.emptyBody}
          action={
            canWrite ? (
              <Button onClick={() => setEditing({ kind: "MENU_ITEM", id: "" })}>
                <Plus aria-hidden />
                {t.rx.newRecipe}
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {list.length > 0 ? (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl<TargetKind>
              label={t.rx.dish}
              value={kind}
              onValueChange={setKind}
              items={KINDS.map((value) => ({
                value,
                label: `${t.rx.kinds[value]} · ${formatQty(rows.filter((row) => row.recipe.target_type === value).length, locale)}`,
              }))}
            />
            <Input icon={Search} type="search" className="min-w-0 flex-1 basis-48" aria-label={t.rx.search} placeholder={t.rx.search} value={query} onChange={(event) => setQuery(event.target.value)} />
            <Select className="w-56" aria-label={t.rx.sortLabel} value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="cost">{t.rx.sortCost}</option>
              <option value="name">{t.rx.sortName}</option>
            </Select>
            {(warehouses.data?.length ?? 0) > 1 && warehouses.data ? (
              <div className="w-full sm:w-64" title={t.rx.storeHint}>
                <WarehouseSelect warehouses={warehouses.data} value={selectedWarehouse} onChange={setWarehouseId} />
              </div>
            ) : null}
          </div>
          {kind !== "PREP" ? (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary" aria-label={t.rx.foodCost}>
              <li className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full bg-success" />{t.rx.legendGood}</li>
              <li className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full bg-warning" />{t.rx.legendWatch}</li>
              <li className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full bg-danger" />{t.rx.legendHigh}</li>
            </ul>
          ) : null}
          <DataTable
            caption={t.rx.title}
            columns={kind === "PREP" ? columns.filter((column) => column.key === "dish" || column.key === "costs") : columns}
            rows={visible}
            rowKey={(row) => row.recipe.id}
            onRowClick={(row) => setEditing(row.recipe)}
            loading={recipes.isLoading}
            empty={t.rx.none}
          />
        </div>
      ) : null}

      {menu.isSuccess && list.length > 0 ? (
        missingCount === 0 ? (
          <p className="flex items-center gap-2 text-sm text-ink-secondary">
            <span aria-hidden className="size-2 rounded-full bg-success" />
            {t.rx.allTracked}
          </p>
        ) : (
          <Card title={missingCount === 1 ? t.rx.untrackedOne : fill(t.rx.untrackedTitle, { count: missingCount })} description={t.rx.untrackedBody}>
            <ul className="flex flex-wrap gap-2">
              {missing.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={!canWrite}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-canvas px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-default disabled:hover:bg-canvas"
                    onClick={() => setEditing({ kind: "MENU_ITEM", id: item.id })}
                  >
                    {canWrite ? <Plus aria-hidden className="size-3.5 text-ink-secondary" /> : null}
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )
      ) : null}

      {editing ? (
        <RecipePanel
          key={"id" in editing && "brand_id" in editing ? editing.id : `new-${editing.kind}-${"id" in editing ? editing.id : ""}`}
          brandId={brandId}
          recipe={"brand_id" in editing ? editing : null}
          target={"brand_id" in editing ? null : editing}
          items={items}
          options={options}
          ingredients={ingredients.data ?? []}
          warehouseId={selectedWarehouse}
          currency={currency}
          taken={new Set(list.filter((recipe) => recipe.is_active).map((recipe) => recipe.menu_item_id ?? recipe.modifier_option_id ?? recipe.prep_ingredient_id ?? ""))}
          serverCost={"brand_id" in editing ? rows.find((row) => row.recipe.id === editing.id)?.cost ?? null : null}
          canWrite={canWrite}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </InventoryFrame>
  );
}

function Figure({ value, loading, muted }: { value: string; loading: boolean; muted?: boolean }) {
  if (loading) return <span className="text-ink-secondary">…</span>;
  return <span className={cn("tabular-nums", muted && "text-ink-secondary")}>{value}</span>;
}
