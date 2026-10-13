"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ops/page-header";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { canWriteCatalogue } from "./access";
import { formatPlateCost } from "./cost";
import { control, InventoryFrame, primaryButton, secondaryButton, useBranchCurrency, useWarehouses, WarehouseSelect } from "./chrome";
import { untrackedMenu } from "./untracked";

type Recipe = components["schemas"]["RecipeResponse"];
type Target = "MENU_ITEM" | "MODIFIER_OPTION" | "PREP";
type Line = { ingredient_id: string; qty: string; unit_id: string; waste_pct: string; replaces_ingredient_id: string };

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
  const [editing, setEditing] = useState<Recipe | "new" | null>(null);
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
      const result = await browserApi.GET("/api/v1/inventory/ingredients", {
        params: { query: { brand_id: brandId, active_only: false } },
      });
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
    () => (menu.data?.categories ?? []).flatMap((category) => category.items ?? []).map((item) => ({ id: item.id, name: item.name })),
    [menu.data],
  );
  const options = useMemo(
    () =>
      (menu.data?.categories ?? []).flatMap((category) =>
        (category.items ?? []).flatMap((item) =>
          (item.modifier_groups ?? []).flatMap((group) =>
            (group.options ?? []).map((option) => ({ id: option.id, name: option.name, itemName: item.name })),
          ),
        ),
      ),
    [menu.data],
  );
  const missing = useMemo(() => untrackedMenu(items, options, recipes.data ?? []), [items, options, recipes.data]);
  const nameOf = (recipe: Recipe) => {
    if (recipe.target_type === "MENU_ITEM") return items.find((item) => item.id === recipe.menu_item_id)?.name ?? recipe.menu_item_id ?? "";
    if (recipe.target_type === "MODIFIER_OPTION") return options.find((option) => option.id === recipe.modifier_option_id)?.name ?? "";
    const prep = (ingredients.data ?? []).find((item) => item.id === recipe.prep_ingredient_id);
    return prep ? pickLocale(prep.name, locale) : "";
  };

  return (
    <InventoryFrame page="recipes">
      <PageHeader
        title={t.recipes.title}
        detail={t.recipes.detail}
        action={canWrite ? <button type="button" className={primaryButton} onClick={() => setEditing("new")}>{t.recipes.add}</button> : null}
      />
      {warehouses.data && warehouses.data.length > 0 ? (
        <WarehouseSelect warehouses={warehouses.data} value={selectedWarehouse} onChange={setWarehouseId} />
      ) : null}
      {recipes.isLoading ? <LoadingState label={t.loading} /> : null}
      {recipes.isError ? <QueryErrorState error={recipes.error} screen={t.tabs.recipes} onRetry={() => void recipes.refetch()} /> : null}
      {recipes.data && recipes.data.length === 0 ? <EmptyState title={t.recipes.empty} body={t.recipes.detail} /> : null}
      {recipes.data && recipes.data.length > 0 ? (
        <div className="overflow-x-auto bg-card">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 text-start font-medium">{t.recipes.target}</th>
                <th className="px-3 py-2 text-start font-medium">{t.recipes.yield}</th>
                <th className="px-3 py-2 text-start font-medium">{t.recipes.cost}</th>
              </tr>
            </thead>
            <tbody>
              {recipes.data.map((recipe) => (
                <RecipeRow
                  key={recipe.id}
                  recipe={recipe}
                  label={nameOf(recipe)}
                  warehouseId={selectedWarehouse}
                  currency={currency}
                  onOpen={() => setEditing(recipe)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <section className="grid gap-2">
        <h2 className="font-medium">{t.recipes.untracked}</h2>
        <p className="text-sm text-muted-foreground">{t.recipes.untrackedDetail}</p>
        <ul className="grid gap-1 text-sm">
          {missing.items.map((item) => <li key={item.id}>{item.name}</li>)}
          {missing.options.map((option) => <li key={option.id}>{option.itemName} · {option.name}</li>)}
        </ul>
      </section>
      {editing ? (
        <RecipeDrawer
          key={editing === "new" ? "new" : editing.id}
          brandId={brandId}
          recipe={editing}
          items={items}
          options={options}
          ingredients={ingredients.data ?? []}
          canWrite={canWrite}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </InventoryFrame>
  );
}

function RecipeRow({
  recipe,
  label,
  warehouseId,
  currency,
  onOpen,
}: {
  recipe: Recipe;
  label: string;
  warehouseId: string;
  currency: string;
  onOpen: () => void;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const cost = useQuery({
    queryKey: ["inventory", "recipe-cost", recipe.id, warehouseId],
    enabled: Boolean(warehouseId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/recipes/{recipe_id}/cost", {
        params: { path: { recipe_id: recipe.id }, query: { warehouse_id: warehouseId } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data;
    },
  });
  const plate = cost.data ? formatPlateCost({ cost: cost.data.cost, price: cost.data.price, marginPct: cost.data.margin_pct }, currency, locale) : null;
  return (
    <tr className="cursor-pointer border-b hover:bg-muted/40" onClick={onOpen}>
      <td className="px-3 py-2">{label}</td>
      <td className="px-3 py-2 tabular-nums">{recipe.yield_qty}</td>
      <td className="px-3 py-2">{plate ? `${plate.cost}${plate.margin ? ` · ${plate.margin}` : ""}` : ""}</td>
    </tr>
  );
}

function RecipeDrawer({
  brandId,
  recipe,
  items,
  options,
  ingredients,
  canWrite,
  onClose,
}: {
  brandId: string;
  recipe: Recipe | "new";
  items: { id: string; name: string }[];
  options: { id: string; name: string; itemName: string }[];
  ingredients: components["schemas"]["IngredientResponse"][];
  canWrite: boolean;
  onClose: () => void;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const current = recipe === "new" ? null : recipe;
  const units = useQuery({
    queryKey: ["inventory", "units", brandId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/units", { params: { query: { brand_id: brandId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const [target, setTarget] = useState<Target>((current?.target_type as Target) || "MENU_ITEM");
  const [targetId, setTargetId] = useState(current?.menu_item_id || current?.modifier_option_id || current?.prep_ingredient_id || "");
  const [yieldQty, setYieldQty] = useState(current?.yield_qty ?? "1");
  const [lines, setLines] = useState<Line[]>(
    current?.lines?.map((line) => ({
      ingredient_id: line.ingredient_id,
      qty: line.qty,
      unit_id: line.unit_id,
      waste_pct: line.waste_pct,
      replaces_ingredient_id: line.replaces_ingredient_id ?? "",
    })) ?? [
      { ingredient_id: "", qty: "", unit_id: "", waste_pct: "0", replaces_ingredient_id: "" },
    ],
  );
  const save = useMutation({
    mutationFn: async () => {
      const body = {
        target_type: target,
        menu_item_id: target === "MENU_ITEM" ? targetId : null,
        modifier_option_id: target === "MODIFIER_OPTION" ? targetId : null,
        prep_ingredient_id: target === "PREP" ? targetId : null,
        yield_qty: yieldQty || "1",
        lines: lines
          .filter((line) => line.ingredient_id && line.qty && line.unit_id)
          .map((line) => ({
            ingredient_id: line.ingredient_id,
            qty: line.qty,
            unit_id: line.unit_id,
            waste_pct: line.waste_pct || "0",
            replaces_ingredient_id: target === "MODIFIER_OPTION" && line.replaces_ingredient_id ? line.replaces_ingredient_id : null,
          })),
      };
      const result = current
        ? await browserApi.PUT("/api/v1/inventory/recipes/{recipe_id}", {
            params: { path: { recipe_id: current.id }, query: { brand_id: brandId } },
            body,
          })
        : await browserApi.POST("/api/v1/inventory/recipes", { params: { query: { brand_id: brandId } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.saved);
      await queryClient.invalidateQueries({ queryKey: ["inventory", "recipes", brandId] });
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  const choices = target === "MENU_ITEM"
    ? items.map((item) => ({ id: item.id, label: item.name }))
    : target === "MODIFIER_OPTION"
      ? options.map((option) => ({ id: option.id, label: `${option.itemName} · ${option.name}` }))
      : ingredients.filter((item) => item.is_prep).map((item) => ({ id: item.id, label: pickLocale(item.name, locale) }));

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto rounded-none sm:max-w-xl">
        <SheetHeader><SheetTitle>{current ? t.recipes.save : t.recipes.add}</SheetTitle></SheetHeader>
        <form className="grid gap-3 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); if (canWrite) save.mutate(); }}>
          <label className="grid gap-1 text-sm">
            <span>{t.recipes.target}</span>
            <select className={control} value={target} disabled={Boolean(current)} onChange={(event) => { setTarget(event.target.value as Target); setTargetId(""); }}>
              <option value="MENU_ITEM">{t.recipes.menuItem}</option>
              <option value="MODIFIER_OPTION">{t.recipes.modifier}</option>
              <option value="PREP">{t.recipes.prep}</option>
            </select>
          </label>
          <select className={control} value={targetId} disabled={Boolean(current)} onChange={(event) => setTargetId(event.target.value)} required>
            <option value="">{t.recipes.target}</option>
            {choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
          </select>
          <label className="grid gap-1 text-sm"><span>{t.recipes.yield}</span><input className={control} inputMode="decimal" value={yieldQty} onChange={(event) => setYieldQty(event.target.value)} /></label>
          <h3 className="font-medium">{t.recipes.lines}</h3>
          {lines.map((line, index) => (
            <div key={index} className="grid gap-2 border-b pb-2">
              <select className={control} value={line.ingredient_id} onChange={(event) => setLines(lines.map((item, i) => i === index ? { ...item, ingredient_id: event.target.value } : item))}>
                <option value="">{t.ingredient}</option>
                {ingredients.map((item) => <option key={item.id} value={item.id}>{pickLocale(item.name, locale)}</option>)}
              </select>
              {target === "MODIFIER_OPTION" ? (
                <label className="grid w-full gap-1 text-sm">
                  <span>{t.recipes.replaces}</span>
                  <select className={control} value={line.replaces_ingredient_id} onChange={(event) => setLines(lines.map((item, i) => i === index ? { ...item, replaces_ingredient_id: event.target.value } : item))}>
                    <option value="">{t.recipes.replacesNone}</option>
                    {ingredients.map((item) => <option key={item.id} value={item.id}>{pickLocale(item.name, locale)}</option>)}
                  </select>
                </label>
              ) : null}
              <div className="grid grid-cols-3 gap-2">
                <input className={control} inputMode="decimal" placeholder={t.quantity} value={line.qty} onChange={(event) => setLines(lines.map((item, i) => i === index ? { ...item, qty: event.target.value } : item))} />
                <select className={control} value={line.unit_id} onChange={(event) => setLines(lines.map((item, i) => i === index ? { ...item, unit_id: event.target.value } : item))}>
                  <option value="">{t.unit}</option>
                  {(units.data ?? []).map((unit) => <option key={unit.id} value={unit.id}>{unit.code}</option>)}
                </select>
                <input className={control} inputMode="decimal" placeholder={t.recipes.waste} value={line.waste_pct} onChange={(event) => setLines(lines.map((item, i) => i === index ? { ...item, waste_pct: event.target.value } : item))} />
              </div>
              <button type="button" className={secondaryButton} onClick={() => setLines(lines.filter((_, i) => i !== index))}>{t.recipes.removeLine}</button>
            </div>
          ))}
          <button type="button" className={secondaryButton} onClick={() => setLines([...lines, { ingredient_id: "", qty: "", unit_id: "", waste_pct: "0", replaces_ingredient_id: "" }])}>{t.recipes.addLine}</button>
          {canWrite ? <button type="submit" className={primaryButton} disabled={save.isPending}>{t.recipes.save}</button> : null}
        </form>
      </SheetContent>
    </Sheet>
  );
}
