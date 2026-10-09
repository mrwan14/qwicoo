"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { LocaleText } from "@/components/ops/locale-text";
import { PageHeader } from "@/components/ops/page-header";
import { StatusChip } from "@/components/ops/status-chip";
import { EmptyState, ErrorState, LoadingState } from "@/components/ops/states";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { menuCopy } from "@/lib/i18n/staff/menu";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import type { components } from "@/lib/api/schema";
import { formatMoney } from "@/lib/format/money";
import { mediaUrl, presignedUploadUrl } from "@/lib/media";
import { useScope } from "@/stores/scope";

const control = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm";
const hint = "text-sm leading-6 text-muted-foreground";
const quietButton = "inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const STATIONS = ["HOT_KITCHEN", "COLD_KITCHEN", "BEVERAGE", "DESSERT"] as const;

type Item = components["schemas"]["MenuItemResponse"];
type MenuText = (typeof menuCopy)["en"];

function names(en: string, ar: string) {
  return { en, ar };
}

async function uploadMenuImage(file: File, folder: "items" | "general", errors: Pick<MenuText, "imageBadType" | "imageTooBig" | "imageUpload">): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error(errors.imageBadType);
  if (file.size > 5 * 1024 * 1024) throw new Error(errors.imageTooBig);
  const body: components["schemas"]["PresignedUrlRequest"] = {
    filename: file.name || "image.png",
    content_type: file.type,
    folder,
  };
  const signed = await browserApi.POST("/api/v1/media/presigned-url", { body });
  if (!signed.response.ok || !signed.data) throw asApiError(signed.error, signed.response, errors.imageUpload);
  const uploaded = await fetch(presignedUploadUrl(signed.data.upload_url), {
    method: "PUT",
    body: file,
    headers: { "content-type": file.type },
  });
  if (!uploaded.ok) throw new Error(errors.imageUpload);
  return signed.data.public_url;
}

function stationCode(name: string): string | null {
  const code = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 50);
  return /^[A-Z0-9_]{2,50}$/.test(code) ? code : null;
}

export function MenuAdmin() {
  const t = useStaffSection(menuCopy);
  const { locale } = useLocale();
  const branchId = useScope((state) => state.branchId);
  const queryClient = useQueryClient();
  const [en, setEn] = useState("");
  const [ar, setAr] = useState("");
  const [station, setStation] = useState<(typeof STATIONS)[number]>("HOT_KITCHEN");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("10.00");
  const [itemEn, setItemEn] = useState("");
  const [itemAr, setItemAr] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [tab, setTab] = useState<"items" | "stations">("items");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [categoryImage, setCategoryImage] = useState<File | null>(null);
  const [itemImage, setItemImage] = useState<File | null>(null);

  const menu = useQuery({
    queryKey: ["menu-tree", branchId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/menu/tree", { params: { query: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.menuFailed);
      return result.data;
    },
  });

  const stations = useQuery({
    queryKey: ["stations", branchId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/staff/kitchen-stations");
      if (!result.response.ok || !result.data) return [];
      return result.data;
    },
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["menu-tree"] });
  }

  const createCategory = useMutation({
    mutationFn: async () => {
      const imageUrl = categoryImage ? await uploadMenuImage(categoryImage, "general", t) : null;
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
      setCategoryOpen(false);
      setEn("");
      setAr("");
      setCategoryImage(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createItem = useMutation({
    mutationFn: async () => {
      const imageUrl = itemImage ? await uploadMenuImage(itemImage, "items", t) : null;
      const body: components["schemas"]["StaffItemCreate"] = {
        category_id: categoryId,
        name: names(itemEn, itemAr),
        base_price: price,
        station,
        is_available: true,
        item_type: "PREPARED",
        ...(imageUrl ? { image_url: imageUrl } : {}),
      };
      const result = await browserApi.POST("/api/v1/staff/menu/items", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotCreateItem);
    },
    onSuccess: () => {
      toast.success(t.itemSaved);
      setItemEn("");
      setItemAr("");
      setItemImage(null);
      setItemOpen(false);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const result = await browserApi.DELETE("/api/v1/staff/menu/categories/{category_id}", {
        params: { path: { category_id: id } },
      });
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

  const catalog = useMutation({
    mutationFn: async () => {
      const imageUrl = itemImage ? await uploadMenuImage(itemImage, "items", t) : null;
      const body: components["schemas"]["ScopedItemCreateRequest"] = {
        name: names(itemEn || "Item", itemAr || "صنف"),
        base_price: price,
        category_id: categoryId,
        scope: "ALL_BRANCHES",
        ...(imageUrl ? { image_url: imageUrl } : {}),
      };
      const result = await browserApi.POST("/api/v1/menu/catalog-items", { body });
      if (result.response.status === 500) {
        throw new Error(t.catalogUnavailable);
      }
      if (!result.response.ok) throw asApiError(result.error, result.response, t.catalogCreateFailed);
    },
    onSuccess: () => {
      toast.success(t.catalogItemCreated);
      setItemImage(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!branchId) return null;
  if (menu.isLoading) return <LoadingState label={t.loading} />;
  if (menu.isError || !menu.data) return <ErrorState body={menu.error?.message ?? t.missing} onRetry={() => void menu.refetch()} />;

  const categories = menu.data.categories ?? [];
  const active = categories.find((category) => category.id === categoryId) ?? categories[0];
  const itemSearch = itemQuery.trim().toLowerCase();
  const searchedItems = itemSearch
    ? categories.flatMap((category) =>
        (category.items ?? [])
          .filter((item) => pickLocale(item.name, locale).toLowerCase().includes(itemSearch))
          .map((item) => ({ item, categoryName: pickLocale(category.name, locale) })),
      )
    : [];

  return (
    <div className="grid gap-4">
      <PageHeader
        title={t.title}
        action={
          tab === "items" ? (
            <div className="flex gap-2">
              <button type="button" className="min-h-11 rounded-xl border bg-card px-4 text-sm" onClick={() => setCategoryOpen(true)}>{t.addCategory}</button>
              <button
                type="button"
                className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
                onClick={() => {
                  if (!categoryId && active) setCategoryId(active.id);
                  setItemOpen(true);
                }}
              >
                {t.addItem}
              </button>
            </div>
          ) : null
        }
      />
      <div className="flex gap-2">
        <button type="button" className={`min-h-11 rounded-xl px-4 text-sm ${tab === "items" ? "bg-primary text-primary-foreground" : "bg-card"}`} onClick={() => setTab("items")}>{t.items}</button>
        <button type="button" className={`min-h-11 rounded-xl px-4 text-sm ${tab === "stations" ? "bg-primary text-primary-foreground" : "bg-card"}`} onClick={() => setTab("stations")}>{t.stationsTab}</button>
      </div>
      {tab === "stations" ? (
        <section className="grid gap-3 rounded-2xl bg-card p-4 shadow-elev-1">
          <p className="text-sm leading-6 text-muted-foreground">{t.stationIntro}</p>
          <StationForm onDone={() => void stations.refetch()} />
          <ul className="grid gap-2">
            {(stations.data ?? []).map((stationItem) => (
              <li key={stationItem.id} className="rounded-xl bg-secondary px-3 py-3 text-sm">
                <LocaleText value={stationItem.name} /> · {stationItem.code}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="grid gap-4">
          <label className="grid max-w-xl gap-1 text-sm">
            {t.searchItems}
            <span className={hint}>{t.searchHint}</span>
            <span className="relative">
              <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={`${control} ps-9`}
                value={itemQuery}
                onChange={(event) => setItemQuery(event.target.value)}
                placeholder={t.searchPlaceholder}
              />
            </span>
          </label>
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="grid gap-2">
            <p className="text-sm font-medium">{t.categories}</p>
            <div className="flex gap-2 overflow-x-auto lg:flex-col">
              {categories.map((category) => {
                const selected = !itemSearch && category.id === active?.id;
                const count = category.items?.length ?? 0;
                const image = mediaUrl(category.image_url);
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={`flex min-h-14 shrink-0 items-center gap-2 rounded-xl px-3 text-start focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${selected ? "bg-primary text-primary-foreground" : "bg-card shadow-elev-1 ring-1 ring-foreground/5"}`}
                    onClick={() => {
                      setCategoryId(category.id);
                      setItemQuery("");
                    }}
                  >
                    {image ? (
                      // Stored photos are on the upload host, which next/image is not set up to optimise.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" className="size-10 shrink-0 rounded-lg bg-secondary object-contain" />
                    ) : null}
                    <span className="grid">
                    <span className="text-sm font-medium">{pickLocale(category.name, locale)}</span>
                    <span className={`text-xs ${selected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {count === 1 ? t.oneItem : fill(t.manyItems, { count })}
                    </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
          {itemSearch ? (
            <div className="grid gap-3">
              <div>
                <h2 className="text-lg font-semibold">{t.searchResults}</h2>
                <p className={hint}>{searchedItems.length === 1 ? t.oneMatch : fill(t.manyMatch, { count: searchedItems.length })}</p>
              </div>
              {searchedItems.length === 0 ? (
                <EmptyState title={t.noMatchTitle} body={t.noMatchBody} />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {searchedItems.map(({ item, categoryName }) => (
                    <MenuItemBlock key={item.id} item={item} categoryName={categoryName} onOptions={() => setSelectedId(item.id)} onDone={refresh} />
                  ))}
                </ul>
              )}
            </div>
          ) : active ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{pickLocale(active.name, locale)}</h2>
                  {mediaUrl(active.image_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(active.image_url) ?? ""} alt="" className="mt-2 h-36 w-full max-w-sm rounded-xl bg-secondary object-contain" />
                  ) : null}
                  <p className={hint}>
                    {fill(t.categorySummaryStation, {
                      count: (active.items?.length ?? 0) === 1 ? t.oneItem : fill(t.manyItems, { count: active.items?.length ?? 0 }),
                      station: t.stations[active.station],
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  className="min-h-11 rounded-xl border border-destructive/30 px-4 text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  onClick={() => setCategoryToDelete(active.id)}
                >
                  {t.deleteCategory}
                </button>
              </div>
              {(active.items ?? []).length === 0 ? (
                <EmptyState title={t.emptyCategoryTitle} body={t.emptyCategoryBody} />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {(active.items ?? []).map((item) => (
                    <MenuItemBlock key={item.id} item={item} onOptions={() => setSelectedId(item.id)} onDone={refresh} />
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <EmptyState title={t.emptyCategoriesTitle} body={t.emptyCategoriesBody} />
          )}
        </div>
        </div>
      )}
      <Sheet open={categoryOpen} onOpenChange={setCategoryOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{t.addCategory}</SheetTitle>
          </SheetHeader>
          <form className="grid gap-3 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); createCategory.mutate(); }}>
            <input className={control} placeholder={t.englishName} value={en} onChange={(event) => setEn(event.target.value)} required />
            <input className={control} dir="rtl" placeholder={t.arabicName} value={ar} onChange={(event) => setAr(event.target.value)} required />
            <select className={control} value={station} onChange={(event) => setStation(event.target.value as typeof station)}>
              {STATIONS.map((value) => (
                <option key={value} value={value}>{t.stations[value]}</option>
              ))}
            </select>
            <OptionalImageField file={categoryImage} onChange={setCategoryImage} />
            <button className="min-h-11 rounded-xl bg-primary text-sm text-primary-foreground" type="submit">{t.saveCategory}</button>
          </form>
        </SheetContent>
      </Sheet>
      <Sheet open={itemOpen} onOpenChange={setItemOpen}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t.addItem}</SheetTitle>
            <SheetDescription>{t.addItemBody}</SheetDescription>
          </SheetHeader>
          <form className="grid gap-4 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); createItem.mutate(); }}>
            <label className="grid gap-1 text-sm">
              {t.category}
              <span className={hint}>{t.categoryHint}</span>
              <select className={control} value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
                <option value="">{categories.length === 0 ? t.addCategoryFirst : t.chooseCategory}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{pickLocale(category.name, locale)}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              {t.priceEgp}
              <span className={hint}>{t.priceHint}</span>
              <input className={control} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required />
              <span className={hint}>{formatMoney(price || "0", undefined, locale)}</span>
            </label>
            <label className="grid gap-1 text-sm">
              {t.englishName}
              <span className={hint}>{t.englishNameHint}</span>
              <input className={control} value={itemEn} onChange={(event) => setItemEn(event.target.value)} required />
            </label>
            <label className="grid gap-1 text-sm">
              {t.arabicName}
              <span className={hint}>{t.arabicNameHint}</span>
              <input className={control} dir="rtl" value={itemAr} onChange={(event) => setItemAr(event.target.value)} required />
            </label>
            <label className="grid gap-1 text-sm">
              {t.station}
              <span className={hint}>{t.stationHint}</span>
              <select className={control} value={station} onChange={(event) => setStation(event.target.value as typeof station)}>
                {STATIONS.map((value) => (
                  <option key={value} value={value}>{t.stations[value]}</option>
                ))}
              </select>
            </label>
            <OptionalImageField file={itemImage} onChange={setItemImage} />
            <button className="min-h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50" type="submit" disabled={!categoryId || createItem.isPending}>
              {createItem.isPending ? t.saving : t.saveItem}
            </button>
            <p className={hint}>{t.saveItemHint}</p>
            <button className="min-h-11 rounded-xl border text-sm disabled:opacity-50" type="button" onClick={() => catalog.mutate()} disabled={!categoryId || !itemEn.trim() || !itemAr.trim() || catalog.isPending}>
              {catalog.isPending ? t.creating : t.addEveryBranch}
            </button>
            <p className={hint}>{t.addEveryBranchHint}</p>
          </form>
        </SheetContent>
      </Sheet>
      {(() => {
        const selected = categories.flatMap((category) => category.items ?? []).find((item) => item.id === selectedId) ?? null;
        return selected ? <ModifierEditor item={selected} onClose={() => setSelectedId(null)} onDone={refresh} /> : null;
      })()}
      <ConfirmDialog
        open={categoryToDelete !== null}
        onOpenChange={(open) => { if (!open) setCategoryToDelete(null); }}
        title={t.deleteCategoryTitle}
        description={t.deleteCategoryBody}
        confirmLabel={t.delete}
        destructive
        onConfirm={() => { if (categoryToDelete) deleteCategory.mutate(categoryToDelete); }}
      />
    </div>
  );
}

function AvailabilityToggle({ item, onDone }: { item: Item; onDone: () => void }) {
  const t = useStaffSection(menuCopy);
  const [open, setOpen] = useState(false);
  const update = useMutation({
    mutationFn: async (isAvailable: boolean) => {
      const body: components["schemas"]["StaffItemAvailabilityUpdate"] = { is_available: isAvailable };
      const result = await browserApi.PATCH("/api/v1/staff/menu/items/{item_id}/availability", {
        params: { path: { item_id: item.id } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotUpdateAvailability);
    },
    onSuccess: () => {
      onDone();
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <>
      <button type="button" className={quietButton} onClick={() => setOpen(true)}>
        {item.is_available ? t.markSoldOut : t.makeAvailable}
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={item.is_available ? t.mark86Title : t.makeAvailableTitle}
        description={t.availabilityBody}
        confirmLabel={t.confirm}
        destructive={item.is_available}
        onConfirm={() => update.mutate(!item.is_available)}
      />
    </>
  );
}

function ModifierEditor({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: () => void }) {
  const t = useStaffSection(menuCopy);
  const [en, setEn] = useState("Options");
  const [ar, setAr] = useState("خيارات");
  const [optionEn, setOptionEn] = useState("");
  const [optionDelta, setOptionDelta] = useState("0.00");
  const groups = item.modifier_groups ?? [];
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const queryClient = useQueryClient();

  const createGroup = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["StaffModifierGroupCreate"] = {
        name: names(en, ar),
        min_choices: 0,
        max_choices: 1,
        is_required: false,
      };
      const result = await browserApi.POST("/api/v1/staff/menu/items/{item_id}/modifier-groups", {
        params: { path: { item_id: item.id } },
        body,
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.couldNotAddGroup);
      setGroupId(result.data.id);
    },
    onSuccess: () => {
      toast.success(t.modifierGroupAdded);
      void queryClient.invalidateQueries({ queryKey: ["menu-tree"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createOption = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["StaffModifierOptionCreate"] = {
        name: names(optionEn, optionEn),
        price_delta: optionDelta || "0.00",
        is_available: true,
      };
      const result = await browserApi.POST("/api/v1/staff/menu/modifier-groups/{group_id}/options", {
        params: { path: { group_id: groupId } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotAddOption);
    },
    onSuccess: () => {
      toast.success(t.optionAdded);
      setOptionEn("");
      void queryClient.invalidateQueries({ queryKey: ["menu-tree"] });
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{t.modifiers}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3 overflow-y-auto px-4 pb-6">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={control} aria-label={t.englishName} value={en} onChange={(event) => setEn(event.target.value)} />
        <input className={control} aria-label={t.arabicName} dir="rtl" value={ar} onChange={(event) => setAr(event.target.value)} />
      </div>
      <button type="button" className="min-h-11 rounded-lg border" onClick={() => createGroup.mutate()}>
        {t.addModifierGroup}
      </button>
      {groups.length > 0 ? (
        <ul className="grid gap-3">
          {groups.map((group) => (
            <li key={group.id} className="grid gap-2 rounded-lg border p-3">
              <p className="text-sm font-medium">{group.name}</p>
              {(group.options ?? []).map((option) => (
                <OptionPriceField key={option.id} option={option} onDone={onDone} />
              ))}
            </li>
          ))}
        </ul>
      ) : null}
      <label className="grid gap-1 text-sm">
        {t.modifierGroup}
        <select className={control} value={groupId} onChange={(event) => setGroupId(event.target.value)}>
          <option value="">{t.chooseGroup}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>
      </label>
      <input className={control} placeholder={t.optionName} value={optionEn} onChange={(event) => setOptionEn(event.target.value)} />
      <input className={control} placeholder={t.priceChange} value={optionDelta} onChange={(event) => setOptionDelta(event.target.value)} inputMode="decimal" />
      <button type="button" className="min-h-11 rounded-lg border" onClick={() => createOption.mutate()} disabled={!groupId || !optionEn}>
        {t.addOption}
      </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}


function MenuItemBlock({
  item,
  categoryName,
  onOptions,
  onDone,
}: {
  item: Item;
  categoryName?: string;
  onOptions: () => void;
  onDone: () => void;
}) {
  const t = useStaffSection(menuCopy);
  const image = mediaUrl(item.image_url);
  return (
    <li className="grid content-start gap-3 rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5">
      {image ? (
        // Stored photos are on the upload host, which next/image is not set up to optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-36 w-full rounded-xl bg-secondary object-contain" />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1">
          <p className="font-semibold"><LocaleText value={item.name} /></p>
          {categoryName ? <p className="text-sm text-muted-foreground">{categoryName}</p> : null}
        </div>
        <StatusChip tone={item.is_available ? "available" : "soldout"}>{item.is_available ? t.available : t.soldOut}</StatusChip>
      </div>
      <PriceField item={item} onDone={onDone} />
      <div className="flex flex-wrap gap-2">
        <AvailabilityToggle item={item} onDone={onDone} />
        <button type="button" className={quietButton} onClick={onOptions}>{t.options}</button>
        <DeleteItemButton item={item} onDone={onDone} />
      </div>
    </li>
  );
}

function priceEdited(next: string, saved: string): boolean {
  const typed = next.trim();
  const current = String(saved).trim();
  if (typed === current) return false;
  const typedValue = Number(typed);
  const currentValue = Number(current);
  if (Number.isFinite(typedValue) && Number.isFinite(currentValue)) return typedValue !== currentValue;
  return true;
}

function PriceField({ item, onDone }: { item: Item; onDone: () => void }) {
  const t = useStaffSection(menuCopy);
  const { locale } = useLocale();
  const saved = String(item.base_price);
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(saved);
  const edited = priceEdited(price, saved);
  const save = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["StaffItemUpdate"] = { base_price: price };
      const result = await browserApi.PATCH("/api/v1/staff/menu/items/{item_id}", {
        params: { path: { item_id: item.id } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotSavePrice);
    },
    onSuccess: () => {
      toast.success(t.priceSaved);
      setEditing(false);
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium">{formatMoney(saved, undefined, locale)}</p>
        <button type="button" className={quietButton} onClick={() => { setPrice(saved); setEditing(true); }}>
          {t.changePrice}
        </button>
      </div>
    );
  }
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); if (edited) save.mutate(); }}>
      <label className="grid gap-1 text-sm">
        {t.priceEgp}
        <input className="h-11 w-28 rounded-lg border bg-background px-3 text-sm" value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" autoFocus />
      </label>
      {edited ? (
        <button className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50" type="submit" disabled={save.isPending}>
          {save.isPending ? t.saving : t.savePrice}
        </button>
      ) : null}
      <button
        type="button"
        className={quietButton}
        onClick={() => {
          setPrice(saved);
          setEditing(false);
        }}
      >
        {t.cancel}
      </button>
    </form>
  );
}

function DeleteItemButton({ item, onDone }: { item: Item; onDone: () => void }) {
  const t = useStaffSection(menuCopy);
  const [open, setOpen] = useState(false);
  const remove = useMutation({
    mutationFn: async () => {
      const result = await browserApi.DELETE("/api/v1/staff/menu/items/{item_id}", {
        params: { path: { item_id: item.id } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotDeleteItem);
    },
    onSuccess: () => {
      toast.success(t.itemDeleted);
      setOpen(false);
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <>
      <button type="button" className="min-h-11 rounded-xl border border-destructive/30 px-4 text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" onClick={() => setOpen(true)}>{t.delete}</button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t.deleteItemTitle}
        description={t.deleteItemBody}
        confirmLabel={t.delete}
        destructive
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}

function OptionPriceField({
  option,
  onDone,
}: {
  option: components["schemas"]["ModifierOptionResponse"];
  onDone: () => void;
}) {
  const t = useStaffSection(menuCopy);
  const { locale } = useLocale();
  const [delta, setDelta] = useState(option.price_delta);
  const edited = priceEdited(delta, option.price_delta);
  const save = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["StaffModifierOptionUpdate"] = { price_delta: delta };
      const result = await browserApi.PATCH("/api/v1/staff/menu/modifier-options/{option_id}", {
        params: { path: { option_id: option.id } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotSaveOption);
    },
    onSuccess: () => {
      toast.success(t.optionSaved);
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form className="flex flex-wrap items-center gap-2 text-sm" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <span className="min-w-24">{option.name}</span>
      <input className="h-11 w-28 rounded-lg border px-3 text-sm" aria-label={fill(t.priceChangeFor, { name: option.name })} value={delta} onChange={(event) => setDelta(event.target.value)} inputMode="decimal" />
      <span className="text-muted-foreground">{formatMoney(delta || "0", undefined, locale)}</span>
      {edited ? (
        <button className="min-h-11 rounded-lg border px-3 text-sm" type="submit" disabled={save.isPending}>
          {save.isPending ? t.saving : t.saveOption}
        </button>
      ) : null}
    </form>
  );
}

function OptionalImageField({ file, onChange }: { file: File | null; onChange: (file: File | null) => void }) {
  const t = useStaffSection(menuCopy);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <label className="grid gap-1 text-sm">
      {t.image}
      <span className={hint}>{t.imageHint}</span>
      <input
        className="block w-full text-sm file:me-3 file:min-h-11 file:rounded-lg file:border file:bg-card file:px-3 file:text-sm"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="h-32 w-full rounded-xl bg-secondary object-contain" />
      ) : null}
    </label>
  );
}

function StationForm({ onDone }: { onDone: () => void }) {
  const t = useStaffSection(menuCopy);
  const [en, setEn] = useState("");
  const code = stationCode(en);
  const create = useMutation({
    mutationFn: async () => {
      if (!code) throw new Error(t.stationLetters);
      const body: components["schemas"]["CreateKitchenStationRequest"] = {
        name: names(en, en),
        code,
        is_active: true,
      };
      const result = await browserApi.POST("/api/v1/staff/kitchen-stations", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotCreateStation);
    },
    onSuccess: () => {
      toast.success(t.stationSaved);
      setEn("");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="grid gap-1 text-sm">
          {t.stationName}
          <input className={control} placeholder={t.stationPlaceholder} value={en} onChange={(event) => setEn(event.target.value)} required />
        </label>
        <button className="min-h-11 self-end rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50" type="submit" disabled={!code || create.isPending}>
          {create.isPending ? t.adding : t.addStation}
        </button>
      </div>
      <p className="text-sm text-muted-foreground">{code ? fill(t.codeSaved, { code }) : t.codeHint}</p>
    </form>
  );
}
