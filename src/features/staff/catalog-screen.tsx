"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { AlertTriangle, Check, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { Card } from "@/components/ops/kit/card";
import { Field, Input, Select } from "@/components/ops/kit/field";
import { useMenuTree } from "@/features/staff/menu/shared";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { comboRegularPrice, comboSaving } from "@/lib/combo-saving";
import { formatMoney } from "@/lib/format/money";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { menuCopy } from "@/lib/i18n/staff/menu";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

const COMBO_STATIONS = ["GRILL", "HOT_SIDE", "BEVERAGE", "ASSEMBLY"] as const;

export function comboStationLabel(code: string, labels: (typeof menuCopy)["en"]["comboStations"]): string {
  if (code === "GRILL" || code === "HOT_SIDE" || code === "BEVERAGE" || code === "ASSEMBLY") return labels[code];
  return code;
}

export const isCombo = (item: { item_type: string }) => item.item_type.toUpperCase() === "COMBO";

// Names an existing category may already use for combos, in English or Arabic.
const OFFER_NAMES = ["offers", "offer", "combos", "combo", "deals", "عروض", "العروض", "كومبو", "الكومبو"];

/** The branch category combos live in: an existing Offers/Combos category, if there is one. */
function findOffersCategory(categories: { id: string; name: unknown }[]): string | null {
  for (const category of categories) {
    const raw = category.name;
    const names = typeof raw === "string" ? [raw] : raw && typeof raw === "object" ? Object.values(raw as Record<string, unknown>) : [];
    if (names.some((name) => typeof name === "string" && OFFER_NAMES.includes(name.trim().toLowerCase()))) return category.id;
  }
  return null;
}

/** Menu → Combos: create a combo item, add the items inside it, and check what it saves. */
export function ComboScreen() {
  const t = useStaffSection(menuCopy);
  const { locale } = useLocale();
  const brandId = useScope((state) => state.brandId);
  const branchId = useScope((state) => state.branchId);
  const queryClient = useQueryClient();
  const [parentId, setParentId] = useState("");
  const [comboEn, setComboEn] = useState("");
  const [comboAr, setComboAr] = useState("");
  const [comboPrice, setComboPrice] = useState("0.00");
  const [componentId, setComponentId] = useState("");
  const [station, setStation] = useState<(typeof COMBO_STATIONS)[number]>("GRILL");
  // Categories picked by hand. Null means "the categories the combo's items already come from".
  const [pickedSources, setPickedSources] = useState<string[] | null>(null);
  const [priceDraft, setPriceDraft] = useState<string | null>(null);
  const tree = useMenuTree(t.menuFailed);
  // `?combo=<id>` (from the item sheet's "Edit items in Combos") opens that combo straight away.
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get("combo");
    if (fromLink) setParentId(fromLink);
  }, []);
  const parts = useQuery({
    queryKey: ["combo", parentId],
    enabled: Boolean(parentId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/menus/items/{item_id}/combo-components", { params: { path: { item_id: parentId } } });
      if (result.response.status === 404) return [];
      if (!result.response.ok || !result.data) return [];
      return result.data;
    },
  });
  const createCombo = useMutation({
    mutationFn: async () => {
      // Combos always go in the Offers category; it is created the first time a combo is made.
      let categoryId = findOffersCategory(tree.data?.categories ?? []);
      if (!categoryId) {
        const category: components["schemas"]["StaffCategoryCreate"] = {
          name: { en: t.combosHub.offersEn, ar: t.combosHub.offersAr },
          station: "HOT_KITCHEN",
          display_order: 0,
          is_active: true,
        };
        const created = await browserApi.POST("/api/v1/staff/menu/categories", {
          body: category,
        });
        if (!created.response.ok || !created.data) throw asApiError(created.error, created.response, t.couldNotCreateCombo);
        categoryId = created.data.id;
      }
      const body: components["schemas"]["StaffItemCreate"] = {
        category_id: categoryId,
        name: { en: comboEn, ar: comboAr },
        base_price: comboPrice,
        is_available: true,
        item_type: "COMBO",
      };
      const result = await browserApi.POST("/api/v1/staff/menu/items", {
        body,
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.couldNotCreateCombo);
      return result.data;
    },
    onSuccess: (item) => {
      chooseCombo(item.id);
      setComboEn("");
      setComboAr("");
      toast.success(t.comboCreated);
      void queryClient.invalidateQueries({ queryKey: ["menu-tree"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const addComponent = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["ComboComponentCreate"] = {
        component_item_id: componentId,
        quantity: 1,
        target_station: station,
        is_active: true,
      };
      const result = await browserApi.POST("/api/v1/menus/items/{item_id}/combo-components", { params: { path: { item_id: parentId } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotAddComponent);
    },
    onSuccess: () => {
      setComponentId("");
      void parts.refetch();
      void queryClient.invalidateQueries({ queryKey: ["menu-tree"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: async (componentRowId: string) => {
      const result = await browserApi.DELETE("/api/v1/menus/combo-components/{component_id}", { params: { path: { component_id: componentRowId } } });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotRemoveComponent);
    },
    onSuccess: () => {
      void parts.refetch();
      void queryClient.invalidateQueries({ queryKey: ["menu-tree"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const savePrice = useMutation({
    mutationFn: async (price: string) => {
      const result = await browserApi.PATCH("/api/v1/staff/menu/items/{item_id}", {
        params: { path: { item_id: parentId } },
        body: { base_price: price },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.combosHub.couldNotSavePrice);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["menu-tree"] });
      setPriceDraft(null);
      toast.success(t.combosHub.priceSaved);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function chooseCombo(id: string) {
    setParentId(id);
    setPickedSources(null);
    setPriceDraft(null);
    setComponentId("");
  }

  const money = (amount: string) => formatMoney(amount, undefined, locale);
  const categories = tree.data?.categories ?? [];
  const items = categories.flatMap((category) => category.items ?? []);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const combos = items.filter(isCombo);
  const combo = itemById.get(parentId);
  const nameOf = (id: string) => pickLocale(itemById.get(id)?.name, locale) || id.slice(0, 8);
  const rows = parts.data ?? [];

  // Item picker: only real items (no combos) from the chosen categories that are not in the combo yet.
  const sources = pickedSources ?? [...new Set(rows.map((row) => itemById.get(row.component_item_id)?.category_id).filter((id): id is string => Boolean(id)))];
  const inCombo = new Set(rows.map((row) => row.component_item_id));
  const pickable = categories
    .filter((category) => sources.includes(category.id))
    .map((category) => ({
      category,
      items: (category.items ?? []).filter((item) => !isCombo(item) && !inCombo.has(item.id)),
    }))
    .filter((group) => group.items.length > 0);
  const toggleSource = (id: string) => {
    setPickedSources(sources.includes(id) ? sources.filter((value) => value !== id) : [...sources, id]);
    setComponentId("");
  };

  // Saving: what the items cost separately at this branch against the combo price.
  const regular = comboRegularPrice(
    rows.map((row) => ({
      price: itemById.get(row.component_item_id)?.base_price,
      quantity: row.quantity,
    })),
  );
  const shownPrice = priceDraft ?? (combo ? String(combo.base_price) : "");
  const priceValid = Number.isFinite(Number(shownPrice)) && Number(shownPrice) > 0;
  const saving = priceValid ? comboSaving(shownPrice, regular) : null;
  const soldOut = rows.map((row) => itemById.get(row.component_item_id)).find((item) => item && !item.is_available);
  const problems: string[] = [];
  if (rows.length > 0 && rows.length < 2) problems.push(t.combosHub.needTwo);
  if (rows.length > 0 && regular === null) problems.push(t.combosHub.unknownPart);
  if (rows.length > 0 && regular !== null && priceValid && !saving) problems.push(t.combosHub.noSaving);
  if (soldOut) problems.push(fill(t.combosHub.soldOutPart, { name: pickLocale(soldOut.name, locale) }));

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {!brandId ? <p className="text-sm text-ink-secondary lg:col-span-2">{t.chooseBrand}</p> : null}
      <Card title={t.newCombo}>
        {!branchId ? <p className="text-sm text-ink-secondary">{t.chooseBranch}</p> : null}
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            createCombo.mutate();
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t.englishName}>
              <Input value={comboEn} onChange={(event) => setComboEn(event.target.value)} required />
            </Field>
            <Field label={t.arabicName}>
              <Input dir="rtl" value={comboAr} onChange={(event) => setComboAr(event.target.value)} required />
            </Field>
          </div>
          <Field label={t.priceEgp}>
            <Input className="w-40" inputMode="decimal" value={comboPrice} onChange={(event) => setComboPrice(event.target.value)} required />
          </Field>
          <p className="text-xs text-ink-secondary">{t.combosHub.offersHint}</p>
          <Button type="submit" className="w-fit" disabled={!branchId || createCombo.isPending}>
            {createCombo.isPending ? t.creating : t.createCombo}
          </Button>
        </form>
      </Card>

      <Card title={t.combosHub.components}>
        <Field label={t.combosHub.pickCombo}>
          <Select value={parentId} onChange={(event) => chooseCombo(event.target.value)}>
            <option value="">{t.combosHub.choose}</option>
            {combos.map((item) => (
              <option key={item.id} value={item.id}>
                {pickLocale(item.name, locale)}
              </option>
            ))}
            {parentId && !combos.some((item) => item.id === parentId) ? <option value={parentId}>{nameOf(parentId)}</option> : null}
          </Select>
        </Field>
        {combos.length === 0 && !parentId ? <p className="text-sm text-ink-secondary">{t.combosHub.noCombos}</p> : null}
        {parentId ? (
          <>
            {rows.length === 0 ? (
              <p className="text-sm text-ink-secondary">{t.combosHub.noComponents}</p>
            ) : (
              <ul className="-my-1">
                {rows.map((part) => {
                  const item = itemById.get(part.component_item_id);
                  return (
                    <li key={part.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0">
                      <span className="grid min-w-0">
                        <span className="flex items-center gap-2 font-medium text-ink">
                          {part.quantity > 1 ? <span className="tabular-nums">{part.quantity}×</span> : null}
                          <span className="truncate">{nameOf(part.component_item_id)}</span>
                          {item && !item.is_available ? <Badge tone="danger">{t.soldOut}</Badge> : null}
                        </span>
                        <span className="text-xs text-ink-secondary">
                          {comboStationLabel(part.target_station, t.comboStations)}
                          {item ? ` · ${pickLocale(categories.find((category) => category.id === item.category_id)?.name, locale)}` : null}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {item ? <span className="tabular-nums text-ink">{money((Number(item.base_price) * part.quantity).toFixed(2))}</span> : null}
                        <Button
                          variant="dangerGhost"
                          size="sm"
                          onClick={() => remove.mutate(part.id)}
                          aria-label={`${t.remove} ${nameOf(part.component_item_id)}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {rows.length > 0 ? (
              <div className="grid gap-3 rounded-staff bg-well p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-secondary">{t.combosHub.separately}</span>
                  <span className={cn("tabular-nums", saving ? "text-ink-secondary line-through" : "text-ink")}>{regular ? money(regular) : "—"}</span>
                </div>
                <form
                  className="flex flex-wrap items-end justify-between gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (priceValid) savePrice.mutate(Number(shownPrice).toFixed(2));
                  }}
                >
                  <Field label={t.combosHub.comboPrice} error={priceDraft !== null && !priceValid ? t.combosHub.invalidPrice : undefined}>
                    <Input className="w-36 bg-canvas" inputMode="decimal" value={shownPrice} onChange={(event) => setPriceDraft(event.target.value)} />
                  </Field>
                  {priceDraft !== null && combo && Number(priceDraft) !== Number(combo.base_price) ? (
                    <Button type="submit" size="field" disabled={!priceValid || savePrice.isPending}>
                      {savePrice.isPending ? t.saving : t.combosHub.savePrice}
                    </Button>
                  ) : null}
                </form>
                {saving ? (
                  <div className="flex items-center justify-between gap-3 rounded-staff bg-success-bg px-3 py-2.5 text-ink">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <Check aria-hidden className="size-4 text-success" />
                      {fill(t.combosHub.guestsSave, {
                        amount: money(saving.saving),
                      })}
                    </span>
                    {saving.percent > 0 ? (
                      <span className="rounded-full bg-success px-2.5 py-1 text-xs font-bold text-on-ink tabular-nums">
                        {fill(t.combosHub.percentOff, {
                          percent: saving.percent,
                        })}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {problems.length > 0 ? (
              <ul className="grid gap-1.5">
                {problems.map((problem) => (
                  <li key={problem} className="flex items-start gap-2 rounded-staff bg-warning-bg px-3 py-2 text-sm text-ink">
                    <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                    {problem}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="grid gap-3 border-t border-border pt-3">
              <div role="group" aria-labelledby="combo-sources" className="grid gap-1.5">
                <span id="combo-sources" className="text-sm font-medium text-ink">
                  {t.combosHub.takeFrom}
                </span>
                <div className="flex flex-wrap gap-2">
                  {categories
                    .filter((category) => (category.items ?? []).some((item) => !isCombo(item)))
                    .map((category) => {
                      const on = sources.includes(category.id);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleSource(category.id)}
                          className={cn(
                            "inline-flex min-h-10 items-center gap-1.5 rounded-staff border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                            on ? "border-brand bg-brand text-on-brand" : "border-border bg-canvas text-ink hover:border-ink/40",
                          )}
                        >
                          {on ? <Check aria-hidden className="size-3.5" /> : null}
                          {pickLocale(category.name, locale)}
                        </button>
                      );
                    })}
                </div>
                <p className="text-xs text-ink-secondary">{t.combosHub.takeFromHint}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px]">
                <Field
                  label={t.combosHub.pickComponent}
                  hint={sources.length === 0 ? t.combosHub.pickCategoriesFirst : pickable.length === 0 ? t.combosHub.noItemsLeft : undefined}
                >
                  <Select value={componentId} onChange={(event) => setComponentId(event.target.value)} disabled={pickable.length === 0}>
                    <option value="">{t.combosHub.choose}</option>
                    {pickable.map(({ category, items: choices }) => (
                      <optgroup key={category.id} label={pickLocale(category.name, locale)}>
                        {choices.map((item) => (
                          <option key={item.id} value={item.id}>
                            {`${pickLocale(item.name, locale)} · ${money(String(item.base_price))}${item.is_available ? "" : ` · ${t.soldOut}`}`}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </Field>
                <Field label={t.station}>
                  <Select value={station} onChange={(event) => setStation(event.target.value as typeof station)}>
                    {COMBO_STATIONS.map((value) => (
                      <option key={value} value={value}>
                        {t.comboStations[value]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button variant="secondary" className="w-fit" disabled={!componentId || addComponent.isPending} onClick={() => addComponent.mutate()}>
                {t.addComponent}
              </Button>
            </div>
          </>
        ) : null}
      </Card>

    </div>
  );
}
