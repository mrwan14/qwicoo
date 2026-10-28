"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ops/kit/button";
import { ConfirmDialog } from "@/components/ops/kit/confirm-dialog";
import { Field, Input, Select, Switch, Textarea } from "@/components/ops/kit/field";
import { formatAmount } from "@/components/ops/kit/money";
import { MoreOptions, PanelSection, SidePanel } from "@/components/ops/kit/side-panel";
import { useStaffSession } from "@/components/ops/staff-session";
import {
  canChooseItemScope,
  canDeleteItem,
  canEditBranchPrice,
  canEditItemStructure,
  canEditModifiers,
  isBrandCatalogItem,
  type MenuItemFlags,
} from "@/features/staff/menu-permissions";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
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

  const [en, setEn] = useState("");
  const [ar, setAr] = useState("");
  const [price, setPrice] = useState("10.00");
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [station, setStation] = useState<Station>("HOT_KITCHEN");
  const [image, setImage] = useState<File | null>(null);
  const [scope, setScope] = useState<"ALL_BRANCHES" | "THIS_BRANCH">(chooseScope ? "ALL_BRANCHES" : "THIS_BRANCH");
  const [descEn, setDescEn] = useState("");
  const [descAr, setDescAr] = useState("");
  const [maxPerOrder, setMaxPerOrder] = useState("");
  const [rows, setRows] = useState<Record<string, BranchRow>>({});
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
  const row = (id: string) => rows[id] ?? saved[id] ?? { price: "", available: true };
  const setRow = (id: string, change: Partial<BranchRow>) => setRows((current) => ({ ...current, [id]: { ...row(id), ...change } }));

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["menu-tree"] });
  }

  async function saveBranches(itemId: string) {
    for (const branch of branches) {
      const next = rows[branch.id];
      const before = saved[branch.id];
      if (!next || (before && next.price === before.price && next.available === before.available)) continue;
      const body: components["schemas"]["BranchMenuOverrideUpdate"] = {
        price_override: next.price.trim() || null,
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

  const pending = create.isPending || update.isPending;
  const basePrice = formatAmount(price || "0", undefined, locale);
  const canDelete = editing && canDeleteItem(role, flags);

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
          {!structure ? <p className="rounded-staff bg-subtle p-3 text-[13px] text-ink-secondary">{t.brandCatalogReadOnly}</p> : null}
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
            <Field label={t.category}>
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

          <PanelSection title={t.panel.choices} hint={t.panel.choicesHint}>
            {editing && item ? (
              canEditModifiers(role, flags) ? (
                <Choices item={item} onDone={refresh} />
              ) : (
                <ChoiceList item={item} />
              )
            ) : (
              <p className="text-[13px] text-ink-secondary">{t.panel.saveFirst}</p>
            )}
          </PanelSection>

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
                      placeholder={String(Number(price) || "")}
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

function ChoiceList({ item }: { item: MenuItem }) {
  const { locale } = useLocale();
  return (
    <ul className="grid gap-3">
      {(item.modifier_groups ?? []).map((group) => (
        <li key={group.id} className="grid gap-1 text-sm">
          <span className="font-medium text-ink">{group.name}</span>
          {(group.options ?? []).map((option) => (
            <span key={option.id} className="flex justify-between text-ink-secondary">
              {option.name}
              <span className="tabular-nums">+{formatAmount(option.price_delta, undefined, locale)}</span>
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}

/** Modifier groups and options, using the staff menu modifier calls. */
function Choices({ item, onDone }: { item: MenuItem; onDone: () => void }) {
  const t = useStaffSection(menuCopy);
  const groups = item.modifier_groups ?? [];
  const [groupEn, setGroupEn] = useState("");
  const [groupAr, setGroupAr] = useState("");

  const createGroup = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["StaffModifierGroupCreate"] = {
        name: names(groupEn, groupAr || groupEn),
        min_choices: 0,
        max_choices: 1,
        is_required: false,
      };
      const result = await browserApi.POST("/api/v1/staff/menu/items/{item_id}/modifier-groups", { params: { path: { item_id: item.id } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotAddGroup);
    },
    onSuccess: () => {
      toast.success(t.modifierGroupAdded);
      setGroupEn("");
      setGroupAr("");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <ChoiceGroup key={group.id} group={group} onDone={onDone} />
      ))}
      <div className="grid gap-2 rounded-staff border border-dashed border-border p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input aria-label={t.panel.groupName} placeholder={t.panel.groupName} value={groupEn} onChange={(event) => setGroupEn(event.target.value)} />
          <Input aria-label={t.panel.groupNameAr} placeholder={t.panel.groupNameAr} dir="rtl" value={groupAr} onChange={(event) => setGroupAr(event.target.value)} />
          <Button variant="secondary" size="field" className="w-fit" disabled={!groupEn.trim() || createGroup.isPending} onClick={() => createGroup.mutate()}>
            {t.panel.addGroup}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChoiceGroup({ group, onDone }: { group: components["schemas"]["ModifierGroupResponse"]; onDone: () => void }) {
  const t = useStaffSection(menuCopy);
  const [name, setName] = useState("");
  const [delta, setDelta] = useState("0.00");
  const createOption = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["StaffModifierOptionCreate"] = { name: names(name, name), price_delta: delta || "0.00", is_available: true };
      const result = await browserApi.POST("/api/v1/staff/menu/modifier-groups/{group_id}/options", { params: { path: { group_id: group.id } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotAddOption);
    },
    onSuccess: () => {
      toast.success(t.optionAdded);
      setName("");
      setDelta("0.00");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium text-ink">{group.name}</p>
      {(group.options ?? []).map((option) => (
        <OptionRow key={option.id} option={option} onDone={onDone} />
      ))}
      <div className="flex gap-2">
        <Input className="min-w-0 flex-1" placeholder={t.panel.choiceName} aria-label={t.panel.choiceName} value={name} onChange={(event) => setName(event.target.value)} />
        <Input className="w-24" inputMode="decimal" aria-label={t.panel.choicePrice} value={delta} onChange={(event) => setDelta(event.target.value)} />
        <Button variant="secondary" size="field" disabled={!name.trim() || createOption.isPending} onClick={() => createOption.mutate()}>
          {t.panel.addChoice}
        </Button>
      </div>
    </div>
  );
}

function OptionRow({ option, onDone }: { option: components["schemas"]["ModifierOptionResponse"]; onDone: () => void }) {
  const t = useStaffSection(menuCopy);
  const [delta, setDelta] = useState(option.price_delta);
  const edited = !sameNumber(delta, option.price_delta);
  const save = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["StaffModifierOptionUpdate"] = { price_delta: delta };
      const result = await browserApi.PATCH("/api/v1/staff/menu/modifier-options/{option_id}", { params: { path: { option_id: option.id } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotSaveOption);
    },
    onSuccess: () => {
      toast.success(t.optionSaved);
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="min-w-0 flex-1 truncate text-ink">{option.name}</span>
      <Input
        className="h-[38px] w-24"
        inputMode="decimal"
        aria-label={fill(t.priceChangeFor, { name: option.name })}
        value={delta}
        onChange={(event) => setDelta(event.target.value)}
      />
      {edited ? (
        <Button variant="secondary" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? t.saving : t.saveOption}
        </Button>
      ) : null}
    </div>
  );
}
