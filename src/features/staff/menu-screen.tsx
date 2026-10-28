"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { BookOpen, Plus, Search, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { ConfirmDialog } from "@/components/ops/kit/confirm-dialog";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { EmptyState } from "@/components/ops/kit/empty-state";
import { Field, Input, Select, Switch } from "@/components/ops/kit/field";
import { formatAmount } from "@/components/ops/kit/money";
import { SidePanel } from "@/components/ops/kit/side-panel";
import { useStaffSession } from "@/components/ops/staff-session";
import { ErrorState } from "@/components/ops/states";
import {
  canAddCategory,
  canAddItem,
  canDeleteCategory,
  canEditItemStructure,
  canToggleAvailability,
} from "@/features/staff/menu-permissions";
import { MenuHub } from "@/features/staff/menu/hub";
import { ItemPanel } from "@/features/staff/menu/item-panel";
import {
  STATIONS,
  flagsForItem,
  names,
  readKnownBrandCatalogIds,
  uploadMenuImage,
  useMenuTree,
  type MenuItem,
  type Station,
} from "@/features/staff/menu/shared";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { menuCopy } from "@/lib/i18n/staff/menu";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { mediaUrl } from "@/lib/media";
import { useScope } from "@/stores/scope";

type Row = { item: MenuItem; categoryName: string };

/** Menu → Items: categories as the left list, the category's items in a table, add and edit in the side panel. */
export function MenuAdmin() {
  const t = useStaffSection(menuCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const role = me?.role;
  const branchId = useScope((state) => state.branchId);
  const queryClient = useQueryClient();
  const menu = useMenuTree(t.menuFailed);
  const searchParam = useSearchParams().get("q");
  const [query, setQuery] = useState(searchParam ?? "");
  // `?q=` comes from the top-bar search.
  useEffect(() => {
    if (searchParam !== null) setQuery(searchParam);
  }, [searchParam]);
  const [categoryId, setCategoryId] = useState("");
  const [panel, setPanel] = useState<{ itemId: string | null } | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const knownBrandIds = readKnownBrandCatalogIds();

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["menu-tree"] });
  }

  const availability = useMutation({
    mutationFn: async ({ item, available }: { item: MenuItem; available: boolean }) => {
      const body: components["schemas"]["StaffItemAvailabilityUpdate"] = { is_available: available };
      const result = await browserApi.PATCH("/api/v1/staff/menu/items/{item_id}/availability", { params: { path: { item_id: item.id } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotUpdateAvailability);
      return available;
    },
    onSuccess: (available) => {
      toast.success(available ? t.available : t.soldOut);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const result = await browserApi.DELETE("/api/v1/staff/menu/categories/{category_id}", { params: { path: { category_id: id } } });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotDeleteCategory);
    },
    onSuccess: () => {
      toast.success(t.categoryDeleted);
      setCategoryToDelete(null);
      setCategoryId("");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!branchId) return null;
  const categories = menu.data?.categories ?? [];
  const active = categories.find((category) => category.id === categoryId) ?? categories[0];
  const needle = query.trim().toLocaleLowerCase();
  const rows: Row[] = needle
    ? categories.flatMap((category) =>
        (category.items ?? [])
          .filter((item) => pickLocale(item.name, locale).toLocaleLowerCase().includes(needle))
          .map((item) => ({ item: item as MenuItem, categoryName: pickLocale(category.name, locale) })),
      )
    : (active?.items ?? []).map((item) => ({ item: item as MenuItem, categoryName: pickLocale(active?.name, locale) }));
  const allItems = categories.flatMap((category) => (category.items ?? []) as MenuItem[]);
  const editing = panel?.itemId ? (allItems.find((item) => item.id === panel.itemId) ?? null) : null;

  const columns: Column<Row>[] = [
    {
      key: "item",
      header: t.hub.item,
      strong: true,
      cell: ({ item }) => {
        const image = mediaUrl(item.image_url);
        const structure = canEditItemStructure(role, flagsForItem(item, knownBrandIds));
        return (
          <span className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-staff border border-border bg-subtle">
              {image ? (
                // Stored photos are on the upload host, which next/image is not set up to optimise.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="size-full object-cover" />
              ) : (
                <BookOpen aria-hidden className="size-4 text-ink-secondary" />
              )}
            </span>
            <span className="grid min-w-0">
              <span className="truncate">{pickLocale(item.name, locale)}</span>
              {!structure ? <span className="truncate text-xs font-normal text-ink-secondary">{t.brandCatalogReadOnly}</span> : null}
            </span>
          </span>
        );
      },
    },
    ...(needle ? [{ key: "category", header: t.category, cell: (row: Row) => row.categoryName } satisfies Column<Row>] : []),
    { key: "price", header: t.price, width: 120, align: "end", cell: ({ item }) => formatAmount(String(item.base_price), undefined, locale) },
    {
      key: "choices",
      header: t.hub.choices,
      width: 120,
      cell: ({ item }) => {
        const count = (item.modifier_groups ?? []).reduce((sum, group) => sum + (group.options?.length ?? 0), 0);
        return count ? fill(t.hub.choiceCount, { count }) : t.hub.none;
      },
    },
    { key: "station", header: t.station, width: 140, cell: ({ item }) => (item.station ? t.stations[item.station as Station] ?? item.station : t.hub.none) },
    {
      key: "available",
      header: t.available,
      width: 120,
      cell: ({ item }) =>
        canToggleAvailability(role) ? (
          <span className="inline-flex items-center gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
            <Switch
              checked={item.is_available}
              disabled={availability.isPending && availability.variables?.item.id === item.id}
              onCheckedChange={(next) => availability.mutate({ item, available: next })}
              aria-label={`${pickLocale(item.name, locale)}: ${t.available}`}
            />
            {!item.is_available ? <Badge tone="danger">{t.soldOut}</Badge> : null}
          </span>
        ) : (
          <Badge tone={item.is_available ? "success" : "danger"}>{item.is_available ? t.available : t.soldOut}</Badge>
        ),
    },
  ];

  return (
    <MenuHub
      tab="items"
      actions={
        <>
          {canAddCategory(role) ? (
            <Button variant="secondary" onClick={() => setCategoryOpen(true)}>
              {t.addCategory}
            </Button>
          ) : null}
          {canAddItem(role) ? (
            <Button onClick={() => setPanel({ itemId: null })}>
              <Plus aria-hidden />
              {t.addItem}
            </Button>
          ) : null}
        </>
      }
    >
      {menu.isError ? (
        <ErrorState body={menu.error?.message ?? t.missing} onRetry={() => void menu.refetch()} />
      ) : !menu.isLoading && categories.length === 0 ? (
        <EmptyState icon={BookOpen} title={t.emptyCategoriesTitle} body={t.emptyCategoriesBody} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[232px_minmax(0,1fr)]">
          <nav aria-label={t.categories} className="grid gap-1">
            <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-ink-secondary uppercase">{t.categories}</p>
            <div className="flex gap-1 overflow-x-auto lg:flex-col">
              {categories.map((category) => {
                const selected = !needle && category.id === active?.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-current={selected ? "true" : undefined}
                    onClick={() => {
                      setCategoryId(category.id);
                      setQuery("");
                    }}
                    className={cn(
                      "flex min-h-10 shrink-0 items-center justify-between gap-3 rounded-staff border px-3 py-2 text-start text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
                      selected ? "border-border bg-subtle font-semibold text-ink" : "border-transparent text-ink-secondary hover:bg-subtle hover:text-ink",
                    )}
                  >
                    <span className="truncate">{pickLocale(category.name, locale)}</span>
                    <span className="text-xs text-ink-secondary tabular-nums">{category.items?.length ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="grid grid-cols-1 gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                icon={Search}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchItems}
                className="min-w-52 flex-1"
              />
              {!needle && active && canDeleteCategory(role) ? (
                <Button variant="dangerGhost" size="field" onClick={() => setCategoryToDelete(active.id)}>
                  <Trash2 aria-hidden />
                  {t.deleteCategory}
                </Button>
              ) : null}
            </div>
            {needle ? (
              <p className="text-[13px] text-ink-secondary">{rows.length === 1 ? t.oneMatch : fill(t.manyMatch, { count: rows.length })}</p>
            ) : active ? (
              <p className="text-[13px] text-ink-secondary">
                {fill(t.categorySummaryStation, {
                  count: (active.items?.length ?? 0) === 1 ? t.oneItem : fill(t.manyItems, { count: active.items?.length ?? 0 }),
                  station: t.stations[active.station as Station] ?? active.station,
                })}
              </p>
            ) : null}
            <DataTable
              caption={needle ? t.searchResults : pickLocale(active?.name, locale)}
              columns={columns}
              rows={rows}
              loading={menu.isLoading}
              rowKey={({ item }) => item.id}
              selectedKey={panel?.itemId ?? null}
              onRowClick={({ item }) => setPanel({ itemId: item.id })}
              empty={needle ? t.noMatchTitle : t.emptyCategoryTitle}
            />
          </div>
        </div>
      )}

      <ItemPanel
        open={panel !== null}
        item={editing}
        flags={editing ? flagsForItem(editing, knownBrandIds) : null}
        categories={categories}
        defaultCategoryId={active?.id ?? ""}
        onClose={() => setPanel(null)}
        onCreated={(itemId) => setPanel(itemId ? { itemId } : null)}
      />
      <CategoryPanel open={categoryOpen} onClose={() => setCategoryOpen(false)} onSaved={refresh} />
      <ConfirmDialog
        open={categoryToDelete !== null}
        onOpenChange={(open) => !open && setCategoryToDelete(null)}
        title={t.deleteCategoryTitle}
        body={t.deleteCategoryBody}
        pending={deleteCategory.isPending}
        onConfirm={() => categoryToDelete && deleteCategory.mutate(categoryToDelete)}
      />
    </MenuHub>
  );
}

function CategoryPanel({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const t = useStaffSection(menuCopy);
  const [en, setEn] = useState("");
  const [ar, setAr] = useState("");
  const [station, setStation] = useState<Station>("HOT_KITCHEN");
  const [image, setImage] = useState<File | null>(null);
  const create = useMutation({
    mutationFn: async () => {
      const imageUrl = image ? await uploadMenuImage(image, "general", t) : null;
      const body: components["schemas"]["StaffCategoryCreate"] = {
        name: names(en, ar),
        station,
        display_order: 1,
        is_active: true,
        ...(imageUrl ? { image_url: imageUrl } : {}),
      };
      const result = await browserApi.POST("/api/v1/staff/menu/categories", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotCreateCategory);
    },
    onSuccess: () => {
      toast.success(t.categorySaved);
      setEn("");
      setAr("");
      setImage(null);
      onSaved();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <SidePanel
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t.addCategory}
      footer={
        <>
          <Button variant="secondary" size="field" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button size="field" type="submit" form="category-panel-form" disabled={create.isPending || !en.trim() || !ar.trim()}>
            {create.isPending ? t.saving : t.saveCategory}
          </Button>
        </>
      }
    >
      <form
        id="category-panel-form"
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <Field label={t.englishName}>
          <Input value={en} onChange={(event) => setEn(event.target.value)} required />
        </Field>
        <Field label={t.arabicName}>
          <Input dir="rtl" value={ar} onChange={(event) => setAr(event.target.value)} required />
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
      </form>
    </SidePanel>
  );
}
