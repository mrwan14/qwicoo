"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { ConfirmDialog } from "@/components/ops/kit/confirm-dialog";
import { Field, Input, Select, Switch, Textarea } from "@/components/ops/kit/field";
import { formatAmount } from "@/components/ops/kit/money";
import { MoreOptions, PanelSection, SidePanel } from "@/components/ops/kit/side-panel";
import { useStaffSession } from "@/components/ops/staff-session";
import {
  canAddItem,
  canChooseItemScope,
  canDeleteItem,
  canEditBranchPrice,
  canEditItemStructure,
  canEditModifiers,
  isBrandCatalogItem,
  type MenuItemFlags,
} from "@/features/staff/menu-permissions";
import { comboStationLabel, isCombo } from "@/features/staff/catalog-screen";
import { ChoicesEditor, ChoicesSummary } from "@/features/staff/menu/choices-editor";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { comboRegularPrice, comboSaving } from "@/lib/combo-saving";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { menuCopy } from "@/lib/i18n/staff/menu";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import {
  STATIONS,
  asBranch,
  findItem,
  names,
  rememberBrandCatalogId,
  uploadMenuImage,
  useBranchTrees,
  useBrandMenus,
  useMenuTree,
  type MenuItem,
  type Station,
} from "./shared";

type Category = { id: string; name: unknown };
type BranchRow = { price: string; available: boolean };

function localized(value: unknown, locale: "en" | "ar"): string {
  return pickLocale(value, locale);
}

function sameNumber(left: string, right: string): boolean {
  const a = Number(left);
  const b = Number(right);
  return Number.isFinite(a) && Number.isFinite(b) ? a === b : left.trim() === right.trim();
}

/** Add or edit one item. Choices need a saved item, so a new item switches to edit once created. */
export function ItemPanel({
  open,
  item,
  flags,
  categories,
  defaultCategoryId,
  onClose,
  onCreated,
}: {
  open: boolean;
  item: MenuItem | null;
  flags: MenuItemFlags | null;
  categories: readonly Category[];
  defaultCategoryId: string;
  onClose: () => void;
  onCreated: (itemId: string | null) => void;
}) {
  const t = useStaffSection(menuCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const role = me?.role;
  const branchId = useScope((state) => state.branchId);
  const scopeBranches = useScope((state) => state.branches);
  const queryClient = useQueryClient();
  const editing = item !== null;
  const structure = !editing || canEditItemStructure(role, flags);
  const chooseScope = canChooseItemScope(role);
  const branchPrices = canEditBranchPrice(role, flags);
  const branches = useMemo(
    () => (scopeBranches.length > 0 ? scopeBranches : branchId ? [{ id: branchId, name: t.scopeThisBranch }] : []),
    [scopeBranches, branchId, t.scopeThisBranch],
  );
  const trees = useBranchTrees(open && editing && branchPrices, t.menuFailed);
  const brandMenus = useBrandMenus(t.menus.loadFailed, open);

  const [en, setEn] = useState("");
  const [ar, setAr] = useState("");
  const [price, setPrice] = useState("10.00");
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  // Which on-menus the chosen category belongs to, so staff know why an item is hidden at some hours.
  const menusForCategory = (brandMenus.data ?? []).filter((menu) => menu.is_active && (menu.category_ids ?? []).includes(categoryId));
  const categoryMenusHint =
    (brandMenus.data ?? []).length === 0 || !categoryId
      ? undefined
      : menusForCategory.length > 0
        ? fill(t.menus.onMenus, { names: menusForCategory.map((menu) => (locale === "ar" ? menu.name_ar || menu.name_en : menu.name_en)).join(", ") })
        : t.menus.inNoMenu;
  const [station, setStation] = useState<Station>("HOT_KITCHEN");
  const [image, setImage] = useState<File | null>(null);
  const [scope, setScope] = useState<"ALL_BRANCHES" | "THIS_BRANCH">(chooseScope ? "ALL_BRANCHES" : "THIS_BRANCH");
  const [descEn, setDescEn] = useState("");
  const [descAr, setDescAr] = useState("");
  const [maxPerOrder, setMaxPerOrder] = useState("");
  // Only what staff changed per branch; anything left alone follows the brand price.
  const [rows, setRows] = useState<Record<string, Partial<BranchRow>>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Fill the form whenever another item (or Add) opens.
  const itemKey = item?.id ?? "new";
  useEffect(() => {
    if (!open) return;
    setEn(item ? localized(item.name, "en") : "");
    setAr(item ? localized(item.name, "ar") : "");
    setPrice(item ? String(item.base_price) : "10.00");
    setCategoryId(item?.category_id ?? defaultCategoryId);
    setStation((item?.station as Station | undefined) ?? "HOT_KITCHEN");
    setImage(null);
    setScope(chooseScope ? "ALL_BRANCHES" : "THIS_BRANCH");
    setDescEn(item?.description ? localized(item.description, "en") : "");
    setDescAr(item?.description ? localized(item.description, "ar") : "");
    setMaxPerOrder(item?.max_per_order != null ? String(item.max_per_order) : "");
    setRows({});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per item, not per render
  }, [open, itemKey]);

  const saved = useMemo(() => {
    const result: Record<string, BranchRow> = {};
    branches.forEach((branch, index) => {
      const seen = item ? findItem(trees[index]?.data, item.id) : null;
      const branchPrice = seen ? String(seen.base_price) : (item ? String(item.base_price) : "");
      result[branch.id] = {
        price: item && seen && !sameNumber(branchPrice, String(item.base_price)) ? branchPrice : "",
        available: seen ? seen.is_available : (item?.is_available ?? true),
      };
    });
    return result;
  }, [branches, item, trees]);
  // A branch with no price of its own shows the brand price, and keeps following it while the form is edited.
  const row = (id: string): BranchRow => ({
    price: rows[id]?.price ?? (saved[id]?.price || price),
    available: rows[id]?.available ?? saved[id]?.available ?? true,
  });
  const setRow = (id: string, change: Partial<BranchRow>) => setRows((current) => ({ ...current, [id]: { ...current[id], ...change } }));

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["menu-tree"] });
  }

  async function saveBranches(itemId: string) {
    for (const branch of branches) {
      if (!rows[branch.id]) continue;
      const next = row(branch.id);
      const before = saved[branch.id];
      // The brand price (or an empty box) saves as "no branch price", so the branch keeps following the brand.
      const override = !next.price.trim() || sameNumber(next.price, price) ? null : next.price.trim();
      const beforeOverride = before?.price || null;
      const samePrice = override === null ? beforeOverride === null : beforeOverride !== null && sameNumber(override, beforeOverride);
      if (before && samePrice && next.available === before.available) continue;
      const body: components["schemas"]["BranchMenuOverrideUpdate"] = {
        price_override: override,
        is_available: next.available,
        is_visible: true,
      };
      const result = await browserApi.PATCH("/api/v1/menu/branches/{branch_id}/items/{item_id}/override", {
        params: { path: { branch_id: branch.id, item_id: itemId } },
        body,
        middleware: [asBranch(branch.id)],
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, fill(t.panel.branchFailed, { branch: branch.name }));
    }
  }

  const create = useMutation({
    mutationFn: async (): Promise<string | null> => {
      const imageUrl = image ? await uploadMenuImage(image, "items", t) : null;
      const description = descEn || descAr ? names(descEn, descAr || descEn) : undefined;
      if (chooseScope) {
        const body: components["schemas"]["ScopedItemCreateRequest"] = {
          name: names(en || "Item", ar || "صنف"),
          base_price: price,
          category_id: categoryId,
          scope: scope === "ALL_BRANCHES" ? "ALL_BRANCHES" : "SPECIFIC_BRANCHES",
          ...(scope === "THIS_BRANCH" ? { target_branch_ids: branchId ? [branchId] : [] } : {}),
          ...(description ? { description } : {}),
          ...(imageUrl ? { image_url: imageUrl } : {}),
        };
        const result = await browserApi.POST("/api/v1/menu/catalog-items", { body });
        if (result.response.ok) {
          const createdId = (result.data as { id?: string } | undefined)?.id ?? null;
          if (createdId) rememberBrandCatalogId(createdId);
          return createdId;
        }
        if (scope === "ALL_BRANCHES") {
          if (result.response.status === 500) throw new Error(t.catalogUnavailable);
          throw asApiError(result.error, result.response, t.catalogCreateFailed);
        }
        // This branch only: fall back to a staff branch item when the catalog path is unavailable.
      }
      const body: components["schemas"]["StaffItemCreate"] = {
        category_id: categoryId,
        name: names(en, ar),
        base_price: price,
        station,
        is_available: true,
        item_type: "PREPARED",
        ...(description ? { description } : {}),
        ...(maxPerOrder.trim() ? { max_per_order: Number(maxPerOrder) } : {}),
        ...(imageUrl ? { image_url: imageUrl } : {}),
      };
      const result = await browserApi.POST("/api/v1/staff/menu/items", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotCreateItem);
      return (result.data as { id?: string } | undefined)?.id ?? null;
    },
    onSuccess: async (createdId) => {
      if (createdId) {
        try {
          await saveBranches(createdId);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : t.panel.saveFailed);
        }
      }
      toast.success(createdId ? t.panel.keepChoices : t.itemSaved);
      refresh();
      onCreated(createdId);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!item) return;
      if (structure) {
        const body: components["schemas"]["StaffItemUpdate"] = {};
        if (en !== localized(item.name, "en") || ar !== localized(item.name, "ar")) body.name = names(en, ar);
        if (!sameNumber(price, String(item.base_price)) && !(isBrandCatalogItem(flags) && chooseScope)) body.base_price = price;
        if (categoryId && categoryId !== item.category_id) body.category_id = categoryId;
        if (station !== item.station) body.station = station;
        const oldEn = item.description ? localized(item.description, "en") : "";
        const oldAr = item.description ? localized(item.description, "ar") : "";
        if (descEn !== oldEn || descAr !== oldAr) body.description = names(descEn, descAr || descEn);
        const oldMax = item.max_per_order != null ? String(item.max_per_order) : "";
        if (maxPerOrder !== oldMax) body.max_per_order = maxPerOrder.trim() ? Number(maxPerOrder) : null;
        if (image) body.image_url = await uploadMenuImage(image, "items", t);
        if (Object.keys(body).length > 0) {
          const result = await browserApi.PATCH("/api/v1/staff/menu/items/{item_id}", { params: { path: { item_id: item.id } }, body });
          if (!result.response.ok) throw asApiError(result.error, result.response, t.panel.saveFailed);
        }
        // Brand catalog prices live on the catalog item.
        if (isBrandCatalogItem(flags) && chooseScope && !sameNumber(price, String(item.base_price))) {
          const result = await browserApi.PATCH("/api/v1/menu/catalog-items/{item_id}", {
            params: { path: { item_id: item.id } },
            body: { base_price: price },
          });
          if (!result.response.ok) throw asApiError(result.error, result.response, t.catalogUpdateFailed);
        }
      }
      if (branchPrices) await saveBranches(item.id);
    },
    onSuccess: () => {
      toast.success(t.panel.saved);
      setRows({});
      refresh();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!item) return;
      const result = await browserApi.DELETE("/api/v1/staff/menu/items/{item_id}", { params: { path: { item_id: item.id } } });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotDeleteItem);
    },
    onSuccess: () => {
      toast.success(t.itemDeleted);
      setConfirmDelete(false);
      refresh();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // A branch admin cannot change a shared item, so they can take a copy that only this branch uses,
  // and the shared one is hidden here so guests don't see both.
  const canCopyForBranch = editing && !structure && canAddItem(role) && Boolean(branchId);
  const copyForBranch = useMutation({
    mutationFn: async (): Promise<string | null> => {
      if (!item || !branchId) return null;
      const body: components["schemas"]["StaffItemCreate"] = {
        category_id: item.category_id,
        name: names(localized(item.name, "en"), localized(item.name, "ar")),
        base_price: String(item.base_price),
        station: (item.station as Station | undefined) ?? "HOT_KITCHEN",
        is_available: true,
        item_type: "PREPARED",
        ...(item.description ? { description: names(localized(item.description, "en"), localized(item.description, "ar")) } : {}),
        ...(item.image_url ? { image_url: item.image_url } : {}),
        ...(item.max_per_order != null ? { max_per_order: item.max_per_order } : {}),
      };
      const result = await browserApi.POST("/api/v1/staff/menu/items", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotCreateItem);
      const copyId = (result.data as { id?: string } | undefined)?.id ?? null;
      const hide = await browserApi.PATCH("/api/v1/menu/branches/{branch_id}/items/{item_id}/override", {
        params: { path: { branch_id: branchId, item_id: item.id } },
        body: { price_override: null, is_available: item.is_available, is_visible: false },
        middleware: [asBranch(branchId)],
      });
      if (!hide.response.ok) toast.error(t.copyHideFailed);
      return copyId;
    },
    onSuccess: (copyId) => {
      toast.success(t.copyMade);
      refresh();
      onCreated(copyId);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pending = create.isPending || update.isPending || copyForBranch.isPending;
  const basePrice = formatAmount(price || "0", undefined, locale);
  const canDelete = editing && canDeleteItem(role, flags);
  const combo = editing && item !== null && isCombo(item);

  return (
    <>
      <SidePanel
        open={open}
        onOpenChange={(next) => !next && onClose()}
        size="lg"
        title={editing ? t.panel.editTitle : t.panel.addTitle}
        description={editing ? pickLocale(item?.name, locale) : t.addItemBody}
        footer={
          <>
            {canDelete ? (
              <Button variant="dangerGhost" size="field" className="me-auto px-2" onClick={() => setConfirmDelete(true)}>
                {t.panel.deleteItem}
              </Button>
            ) : null}
            <Button variant="secondary" size="field" onClick={onClose}>
              {t.cancel}
            </Button>
            <Button
              size="field"
              type="submit"
              form="item-panel-form"
              disabled={pending || !categoryId || (!editing && (!en.trim() || !ar.trim()))}
            >
              {pending ? t.saving : t.saveItem}
            </Button>
          </>
        }
      >
        <form
          id="item-panel-form"
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (editing) update.mutate();
            else create.mutate();
          }}
        >
          {!structure ? (
            <div className="grid gap-2.5 rounded-staff bg-subtle p-3 text-[13px] text-ink-secondary">
              <p>{t.brandCatalogReadOnly}</p>
              {canCopyForBranch ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{t.copyHint}</span>
                  <Button variant="secondary" size="sm" disabled={pending} onClick={() => copyForBranch.mutate()}>
                    {copyForBranch.isPending ? t.saving : t.copyForBranch}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          <fieldset disabled={!structure} className="grid grid-cols-1 gap-4 disabled:opacity-70 sm:grid-cols-2">
            <Field label={t.englishName} className="sm:col-span-1">
              <Input value={en} onChange={(event) => setEn(event.target.value)} required={!editing} />
            </Field>
            <Field label={t.arabicName}>
              <Input dir="rtl" value={ar} onChange={(event) => setAr(event.target.value)} required={!editing} />
            </Field>
            <Field label={t.priceEgp} hint={basePrice}>
              <Input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required />
            </Field>
            <Field label={t.category} hint={categoryMenusHint}>
              <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
                <option value="">{categories.length === 0 ? t.addCategoryFirst : t.chooseCategory}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {pickLocale(category.name, locale)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.station} hint={t.stationHint}>
              <Select value={station} onChange={(event) => setStation(event.target.value as Station)}>
                {STATIONS.map((value) => (
                  <option key={value} value={value}>
                    {t.stations[value]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.image} hint={t.imageHint}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                className="block w-full text-[13px] text-ink-secondary file:me-3 file:h-[42px] file:rounded-staff file:border file:border-border file:bg-canvas file:px-3 file:text-sm file:text-ink"
              />
            </Field>
            {!editing && chooseScope ? (
              <fieldset className="grid gap-2 sm:col-span-2">
                <legend className="mb-1 text-xs font-medium text-ink-secondary">{t.itemScope}</legend>
                {(["ALL_BRANCHES", "THIS_BRANCH"] as const).map((value) => (
                  <label key={value} className="flex min-h-10 items-center gap-2 text-sm text-ink">
                    <input type="radio" name="item-scope" className="size-4 accent-ink" checked={scope === value} onChange={() => setScope(value)} />
                    {value === "ALL_BRANCHES" ? t.scopeAllBranches : t.scopeThisBranch}
                  </label>
                ))}
              </fieldset>
            ) : null}
          </fieldset>

          {combo && item ? (
            <PanelSection title={t.combosHub.components} hint={t.combosHub.sheetHint}>
              <ComboDetails comboId={item.id} price={price} />
            </PanelSection>
          ) : null}

          {/* Combos are built from items, so choices only show on a combo that already has some. */}
          {combo && (item?.modifier_groups ?? []).length === 0 ? null : (
          <PanelSection title={t.panel.choices} hint={t.panel.choicesHint}>
            {editing && item ? (
              canEditModifiers(role, flags) ? (
                <ChoicesEditor itemId={item.id} groups={item.modifier_groups ?? []} onDone={refresh} />
              ) : (
                <ChoicesSummary groups={item.modifier_groups ?? []} />
              )
            ) : (
              <p className="text-[13px] text-ink-secondary">{t.panel.saveFirst}</p>
            )}
          </PanelSection>
          )}

          {branchPrices && branches.length > 0 ? (
            <PanelSection title={t.panel.perBranch} hint={fill(t.panel.perBranchHint, { price: basePrice })}>
              <div className="grid gap-2">
                <div className="flex gap-3 text-xs text-ink-secondary">
                  <span className="flex-1">{t.panel.branch}</span>
                  <span className="w-[110px]">{t.panel.branchPrice}</span>
                  <span className="w-16 text-end">{t.panel.branchAvailable}</span>
                </div>
                {branches.map((branch) => (
                  <div key={branch.id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{branch.name}</span>
                    <Input
                      className="h-[38px] w-[110px]"
                      inputMode="decimal"
                      aria-label={`${branch.name} ${t.panel.branchPrice}`}
                      value={row(branch.id).price}
                      onChange={(event) => setRow(branch.id, { price: event.target.value })}
                    />
                    <span className="flex w-16 justify-end">
                      <Switch
                        checked={row(branch.id).available}
                        onCheckedChange={(available) => setRow(branch.id, { available })}
                        aria-label={`${branch.name} ${t.panel.branchAvailable}`}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </PanelSection>
          ) : null}

          <MoreOptions label={t.panel.moreOptions} summary={t.panel.moreSummary}>
            <fieldset disabled={!structure} className="grid gap-4">
              <Field label={t.descriptionEn}>
                <Textarea value={descEn} onChange={(event) => setDescEn(event.target.value)} />
              </Field>
              <Field label={t.descriptionAr}>
                <Textarea dir="rtl" value={descAr} onChange={(event) => setDescAr(event.target.value)} />
              </Field>
              <Field label={t.maxPerOrder} hint={t.maxPerOrderHint}>
                <Input inputMode="numeric" className="w-32" value={maxPerOrder} onChange={(event) => setMaxPerOrder(event.target.value)} />
              </Field>
            </fieldset>
          </MoreOptions>
        </form>
      </SidePanel>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t.deleteItemTitle}
        body={t.deleteItemBody}
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}

/** Read-only view of a combo: its items, what they cost separately, and what guests save at `price`. */
function ComboDetails({ comboId, price }: { comboId: string; price: string }) {
  const t = useStaffSection(menuCopy);
  const { locale } = useLocale();
  const tree = useMenuTree(t.menuFailed);
  // Same query key as the Combos tab, so edits there show here without a reload.
  const parts = useQuery({
    queryKey: ["combo", comboId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/menus/items/{item_id}/combo-components", { params: { path: { item_id: comboId } } });
      if (!result.response.ok || !result.data) return [];
      return result.data;
    },
  });

  const categories = tree.data?.categories ?? [];
  const itemById = new Map(categories.flatMap((category) => category.items ?? []).map((entry) => [entry.id, entry]));
  const rows = parts.data ?? [];
  const money = (amount: string) => formatAmount(amount, undefined, locale);
  const regular = comboRegularPrice(rows.map((row) => ({ price: itemById.get(row.component_item_id)?.base_price, quantity: row.quantity })));
  const priceValid = Number.isFinite(Number(price)) && Number(price) > 0;
  const saving = priceValid ? comboSaving(price, regular) : null;
  const soldOut = rows.map((row) => itemById.get(row.component_item_id)).find((entry) => entry && !entry.is_available);

  const problems: string[] = [];
  if (rows.length === 1) problems.push(t.combosHub.needTwo);
  if (rows.length > 0 && regular === null) problems.push(t.combosHub.unknownPart);
  if (rows.length > 0 && regular !== null && priceValid && !saving) problems.push(t.combosHub.noSaving);
  if (soldOut) problems.push(fill(t.combosHub.soldOutPart, { name: pickLocale(soldOut.name, locale) }));

  const editLink = (
    <Link
      href={`/app/menu/combos?combo=${comboId}`}
      className="inline-flex w-fit items-center gap-1.5 rounded-staff text-[13px] font-medium text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {t.combosHub.editInCombos}
      <ArrowRight aria-hidden className="size-3.5 rtl:-scale-x-100" />
    </Link>
  );

  if (parts.isPending || tree.isPending) return <p className="text-[13px] text-ink-secondary">{t.combosHub.loadingParts}</p>;
  if (rows.length === 0) {
    return (
      <div className="grid gap-2">
        <p className="text-[13px] text-ink-secondary">{t.combosHub.noComponents}</p>
        {editLink}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <ul className="rounded-staff border border-border px-3">
        {rows.map((part) => {
          const entry = itemById.get(part.component_item_id);
          const name = pickLocale(entry?.name ?? part.component_name, locale) || part.component_item_id.slice(0, 8);
          const category = entry ? pickLocale(categories.find((value) => value.id === entry.category_id)?.name, locale) : "";
          return (
            <li key={part.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0">
              <span className="grid min-w-0">
                <span className="flex items-center gap-2 font-medium text-ink">
                  {part.quantity > 1 ? <span className="tabular-nums">{part.quantity}×</span> : null}
                  <span className="truncate">{name}</span>
                  {entry && !entry.is_available ? <Badge tone="danger">{t.soldOut}</Badge> : null}
                </span>
                <span className="text-xs text-ink-secondary">
                  {comboStationLabel(part.target_station, t.comboStations)}
                  {category ? ` · ${category}` : null}
                </span>
              </span>
              {entry ? <span className="shrink-0 tabular-nums text-ink">{money((Number(entry.base_price) * part.quantity).toFixed(2))}</span> : null}
            </li>
          );
        })}
      </ul>

      <div className="grid gap-2 rounded-staff bg-well p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-ink-secondary">{t.combosHub.separately}</span>
          <span className={saving ? "tabular-nums text-ink-secondary line-through" : "tabular-nums text-ink"}>{regular ? money(regular) : "—"}</span>
        </div>
        <div className="flex items-center justify-between font-semibold text-ink">
          <span>{t.combosHub.comboPrice}</span>
          <span className="tabular-nums">{priceValid ? money(price) : "—"}</span>
        </div>
        {saving ? (
          <div className="flex items-center justify-between gap-3 rounded-staff bg-success-bg px-3 py-2.5 text-ink">
            <span className="flex items-center gap-2 font-semibold">
              <Check aria-hidden className="size-4 text-success" />
              {fill(t.combosHub.guestsSave, { amount: money(saving.saving) })}
            </span>
            {saving.percent > 0 ? (
              <span className="rounded-full bg-success px-2.5 py-1 text-xs font-bold text-on-ink tabular-nums">
                {fill(t.combosHub.percentOff, { percent: saving.percent })}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {problems.length > 0 ? (
        <ul className="grid gap-1.5">
          {problems.map((problem) => (
            <li key={problem} className="flex items-start gap-2 rounded-staff bg-warning-bg px-3 py-2 text-[13px] text-ink">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              {problem}
            </li>
          ))}
        </ul>
      ) : null}

      {editLink}
    </div>
  );
}
