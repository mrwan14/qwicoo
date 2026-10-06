"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { LocaleText } from "@/components/ops/locale-text";
import { PageHeader } from "@/components/ops/page-header";
import { StatusChip } from "@/components/ops/status-chip";
import { EmptyState, ErrorState, LoadingState } from "@/components/ops/states";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { pickLocale } from "@/lib/i18n/locale-text";
import type { components } from "@/lib/api/schema";
import { formatMoney } from "@/lib/format/money";
import { useScope } from "@/stores/scope";

const control = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm";
const hint = "text-sm leading-6 text-muted-foreground";
const STATIONS = ["HOT_KITCHEN", "COLD_KITCHEN", "BEVERAGE", "DESSERT"] as const;
const STATION_LABELS: Record<(typeof STATIONS)[number], string> = {
  HOT_KITCHEN: "Hot kitchen",
  COLD_KITCHEN: "Cold kitchen",
  BEVERAGE: "Drinks",
  DESSERT: "Dessert",
};

type Item = components["schemas"]["MenuItemResponse"];

function names(en: string, ar: string) {
  return { en, ar };
}

function stationCode(name: string): string | null {
  const code = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 50);
  return /^[A-Z0-9_]{2,50}$/.test(code) ? code : null;
}

export function MenuAdmin() {
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

  const menu = useQuery({
    queryKey: ["menu-tree", branchId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/menu/tree", { params: { query: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Menu failed");
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
      const body: components["schemas"]["StaffCategoryCreate"] = {
        name: names(en, ar),
        station,
        display_order: 1,
        is_active: true,
      };
      const result = await browserApi.POST("/api/v1/staff/menu/categories", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not create category");
    },
    onSuccess: () => {
      toast.success("Category saved");
      setCategoryOpen(false);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createItem = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["StaffItemCreate"] = {
        category_id: categoryId,
        name: names(itemEn, itemAr),
        base_price: price,
        station,
        is_available: true,
        item_type: "PREPARED",
      };
      const result = await browserApi.POST("/api/v1/staff/menu/items", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not create item");
    },
    onSuccess: () => {
      toast.success("Item saved");
      setItemEn("");
      setItemAr("");
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
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not delete category");
    },
    onSuccess: () => {
      toast.success("Category deleted");
      setCategoryToDelete(null);
      setCategoryId("");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const catalog = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["ScopedItemCreateRequest"] = {
        name: names(itemEn || "Item", itemAr || "صنف"),
        base_price: price,
        category_id: categoryId,
        scope: "ALL_BRANCHES",
      };
      const result = await browserApi.POST("/api/v1/menu/catalog-items", { body });
      if (result.response.status === 500) {
        throw new Error("Catalog create is unavailable. Use the staff item form instead.");
      }
      if (!result.response.ok) throw asApiError(result.error, result.response, "Catalog create failed");
    },
    onSuccess: () => toast.success("Catalog item created"),
    onError: (error: Error) => toast.error(error.message),
  });

  if (!branchId) return null;
  if (menu.isLoading) return <LoadingState label="Loading menu" />;
  if (menu.isError || !menu.data) return <ErrorState body={menu.error?.message ?? "Menu missing"} onRetry={() => void menu.refetch()} />;

  const categories = menu.data.categories ?? [];
  const active = categories.find((category) => category.id === categoryId) ?? categories[0];

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Menu"
        action={
          tab === "items" ? (
            <div className="flex gap-2">
              <button type="button" className="min-h-11 rounded-xl border bg-card px-4 text-sm" onClick={() => setCategoryOpen(true)}>Add category</button>
              <button
                type="button"
                className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
                onClick={() => {
                  if (!categoryId && active) setCategoryId(active.id);
                  setItemOpen(true);
                }}
              >
                Add item
              </button>
            </div>
          ) : null
        }
      />
      <div className="flex gap-2">
        <button type="button" className={`min-h-11 rounded-xl px-4 text-sm ${tab === "items" ? "bg-primary text-primary-foreground" : "bg-card"}`} onClick={() => setTab("items")}>Items</button>
        <button type="button" className={`min-h-11 rounded-xl px-4 text-sm ${tab === "stations" ? "bg-primary text-primary-foreground" : "bg-card"}`} onClick={() => setTab("stations")}>Stations</button>
      </div>
      {tab === "stations" ? (
        <section className="grid gap-3 rounded-2xl bg-card p-4 shadow-elev-1">
          <p className="text-sm leading-6 text-muted-foreground">A station is a preparation area, such as the hot kitchen or the bar. Items sent there show on that station’s kitchen display.</p>
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
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="grid gap-2">
            <p className={hint}>Categories guests browse, such as Coffee.</p>
            <div className="flex gap-2 overflow-x-auto lg:flex-col">
              {categories.map((category) => {
                const selected = category.id === active?.id;
                const count = category.items?.length ?? 0;
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={`flex min-h-14 shrink-0 flex-col justify-center rounded-xl px-3 text-start focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${selected ? "bg-primary text-primary-foreground" : "bg-card shadow-elev-1 ring-1 ring-foreground/5"}`}
                    onClick={() => setCategoryId(category.id)}
                  >
                    <span className="text-sm font-medium">{pickLocale(category.name, "en")}</span>
                    <span className={`text-xs ${selected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {count === 1 ? "1 item" : `${count} items`}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
          {active ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{pickLocale(active.name, "en")}</h2>
                  <p className={hint}>
                    {(active.items?.length ?? 0) === 1 ? "1 item" : `${active.items?.length ?? 0} items`}
                    {STATION_LABELS[active.station] ? ` · sent to ${STATION_LABELS[active.station]}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="min-h-11 rounded-xl border border-destructive/30 px-4 text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  onClick={() => setCategoryToDelete(active.id)}
                >
                  Delete category
                </button>
              </div>
              <ul className="grid gap-3">
                {(active.items ?? []).map((item) => (
                  <li key={item.id} className="grid gap-3 rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="grid gap-1">
                        <p className="font-semibold"><LocaleText value={item.name} /></p>
                        <p className="text-sm text-muted-foreground">{formatMoney(String(item.base_price))}</p>
                      </div>
                      <StatusChip tone={item.is_available ? "available" : "soldout"}>{item.is_available ? "Available" : "Sold out"}</StatusChip>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <PriceField item={item} onDone={refresh} />
                      <AvailabilityToggle item={item} onDone={refresh} />
                      <button
                        type="button"
                        className="min-h-11 rounded-xl border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        onClick={() => setSelectedId(item.id)}
                      >
                        Options
                      </button>
                      <DeleteItemButton item={item} onDone={refresh} />
                    </div>
                    <p className={hint}>Change the price, then save it. Sold out hides the item. Options are extras such as size or milk.</p>
                  </li>
                ))}
                {(active.items ?? []).length === 0 ? <EmptyState title="No items in this category" body="Add an item to show it on the guest menu." /> : null}
              </ul>
            </div>
          ) : (
            <EmptyState title="No categories yet" body="Add a category, then add items to it." />
          )}
        </div>
      )}
      <Sheet open={categoryOpen} onOpenChange={setCategoryOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Add category</SheetTitle>
          </SheetHeader>
          <form className="grid gap-3 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); createCategory.mutate(); }}>
            <input className={control} placeholder="English name" value={en} onChange={(event) => setEn(event.target.value)} required />
            <input className={control} placeholder="Arabic name" value={ar} onChange={(event) => setAr(event.target.value)} required />
            <select className={control} value={station} onChange={(event) => setStation(event.target.value as typeof station)}>
              {STATIONS.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <button className="min-h-11 rounded-xl bg-primary text-sm text-primary-foreground" type="submit">Save category</button>
          </form>
        </SheetContent>
      </Sheet>
      <Sheet open={itemOpen} onOpenChange={setItemOpen}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add item</SheetTitle>
            <SheetDescription>Adds a dish or drink to the category guests see. The price is in EGP.</SheetDescription>
          </SheetHeader>
          <form className="grid gap-4 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); createItem.mutate(); }}>
            <label className="grid gap-1 text-sm">
              Category
              <span className={hint}>The item is listed under this category.</span>
              <select className={control} value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
                <option value="">{categories.length === 0 ? "Add a category first" : "Choose a category"}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{pickLocale(category.name, "en")}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Price (EGP)
              <span className={hint}>What guests pay for this item, before options.</span>
              <input className={control} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required />
              <span className={hint}>{formatMoney(price || "0")}</span>
            </label>
            <label className="grid gap-1 text-sm">
              English name
              <span className={hint}>The name guests see in English.</span>
              <input className={control} value={itemEn} onChange={(event) => setItemEn(event.target.value)} required />
            </label>
            <label className="grid gap-1 text-sm">
              Arabic name
              <span className={hint}>The name guests see in Arabic.</span>
              <input className={control} dir="rtl" value={itemAr} onChange={(event) => setItemAr(event.target.value)} required />
            </label>
            <label className="grid gap-1 text-sm">
              Station
              <span className={hint}>Where the kitchen prepares this item.</span>
              <select className={control} value={station} onChange={(event) => setStation(event.target.value as typeof station)}>
                {STATIONS.map((value) => (
                  <option key={value} value={value}>{STATION_LABELS[value]}</option>
                ))}
              </select>
            </label>
            <button className="min-h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50" type="submit" disabled={!categoryId || createItem.isPending}>
              {createItem.isPending ? "Saving…" : "Save item"}
            </button>
            <p className={hint}>Saves the item for this branch.</p>
            <button className="min-h-11 rounded-xl border text-sm disabled:opacity-50" type="button" onClick={() => catalog.mutate()} disabled={!categoryId || !itemEn.trim() || !itemAr.trim() || catalog.isPending}>
              {catalog.isPending ? "Creating…" : "Add for every branch"}
            </button>
            <p className={hint}>Uses the same name and price, and adds the item on every branch.</p>
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
        title="Delete this category?"
        description="Items in this category will no longer be listed."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { if (categoryToDelete) deleteCategory.mutate(categoryToDelete); }}
      />
    </div>
  );
}

function AvailabilityToggle({ item, onDone }: { item: Item; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const update = useMutation({
    mutationFn: async (isAvailable: boolean) => {
      const body: components["schemas"]["StaffItemAvailabilityUpdate"] = { is_available: isAvailable };
      const result = await browserApi.PATCH("/api/v1/staff/menu/items/{item_id}/availability", {
        params: { path: { item_id: item.id } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not update availability");
    },
    onSuccess: () => {
      onDone();
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <>
      <button type="button" className="min-h-11 rounded-xl border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" onClick={() => setOpen(true)}>
        {item.is_available ? "Mark sold out" : "Make available"}
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={item.is_available ? "Mark item 86?" : "Make item available?"}
        description="This changes whether guests can order it."
        confirmLabel="Confirm"
        destructive={item.is_available}
        onConfirm={() => update.mutate(!item.is_available)}
      />
    </>
  );
}

function ModifierEditor({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: () => void }) {
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
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Could not add group");
      setGroupId(result.data.id);
    },
    onSuccess: () => {
      toast.success("Modifier group added");
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
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not add option");
    },
    onSuccess: () => {
      toast.success("Option added");
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
          <SheetTitle>Modifiers</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3 overflow-y-auto px-4 pb-6">
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={control} value={en} onChange={(event) => setEn(event.target.value)} />
        <input className={control} value={ar} onChange={(event) => setAr(event.target.value)} />
      </div>
      <button type="button" className="min-h-11 rounded-lg border" onClick={() => createGroup.mutate()}>
        Add modifier group
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
        Modifier group
        <select className={control} value={groupId} onChange={(event) => setGroupId(event.target.value)}>
          <option value="">Choose a group</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>
      </label>
      <input className={control} placeholder="Option name" value={optionEn} onChange={(event) => setOptionEn(event.target.value)} />
      <input className={control} placeholder="Price change" value={optionDelta} onChange={(event) => setOptionDelta(event.target.value)} inputMode="decimal" />
      <button type="button" className="min-h-11 rounded-lg border" onClick={() => createOption.mutate()} disabled={!groupId || !optionEn}>
        Add option
      </button>
        </div>
      </SheetContent>
    </Sheet>
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
  const [price, setPrice] = useState(String(item.base_price));
  const edited = priceEdited(price, String(item.base_price));
  const save = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["StaffItemUpdate"] = { base_price: price };
      const result = await browserApi.PATCH("/api/v1/staff/menu/items/{item_id}", {
        params: { path: { item_id: item.id } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not save price");
    },
    onSuccess: () => {
      toast.success("Price saved");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <label className="grid gap-1 text-sm">
        New price (EGP)
        <input className="h-11 w-28 rounded-lg border px-3 text-sm" value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" />
      </label>
      {edited ? (
        <button className="min-h-11 rounded-xl border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50" type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save price"}
        </button>
      ) : null}
    </form>
  );
}

function DeleteItemButton({ item, onDone }: { item: Item; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const remove = useMutation({
    mutationFn: async () => {
      const result = await browserApi.DELETE("/api/v1/staff/menu/items/{item_id}", {
        params: { path: { item_id: item.id } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not delete item");
    },
    onSuccess: () => {
      toast.success("Item deleted");
      setOpen(false);
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <>
      <button type="button" className="min-h-11 rounded-xl border border-destructive/30 px-4 text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" onClick={() => setOpen(true)}>Delete</button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this item?"
        description="Guests will no longer see it on the menu."
        confirmLabel="Delete"
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
  const [delta, setDelta] = useState(option.price_delta);
  const edited = priceEdited(delta, option.price_delta);
  const save = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["StaffModifierOptionUpdate"] = { price_delta: delta };
      const result = await browserApi.PATCH("/api/v1/staff/menu/modifier-options/{option_id}", {
        params: { path: { option_id: option.id } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not save option");
    },
    onSuccess: () => {
      toast.success("Option saved");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form className="flex flex-wrap items-center gap-2 text-sm" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <span className="min-w-24">{option.name}</span>
      <input className="h-11 w-28 rounded-lg border px-3 text-sm" aria-label={`Price change for ${option.name}`} value={delta} onChange={(event) => setDelta(event.target.value)} inputMode="decimal" />
      <span className="text-muted-foreground">{formatMoney(delta || "0")}</span>
      {edited ? (
        <button className="min-h-11 rounded-lg border px-3 text-sm" type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save option"}
        </button>
      ) : null}
    </form>
  );
}

function StationForm({ onDone }: { onDone: () => void }) {
  const [en, setEn] = useState("");
  const code = stationCode(en);
  const create = useMutation({
    mutationFn: async () => {
      if (!code) throw new Error("Use at least two letters in the station name.");
      const body: components["schemas"]["CreateKitchenStationRequest"] = {
        name: names(en, en),
        code,
        is_active: true,
      };
      const result = await browserApi.POST("/api/v1/staff/kitchen-stations", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not create station");
    },
    onSuccess: () => {
      toast.success("Station saved");
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
          Station name
          <input className={control} placeholder="Hot kitchen" value={en} onChange={(event) => setEn(event.target.value)} required />
        </label>
        <button className="min-h-11 self-end rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50" type="submit" disabled={!code || create.isPending}>
          {create.isPending ? "Adding…" : "Add station"}
        </button>
      </div>
      <p className="text-sm text-muted-foreground">{code ? `The code is saved as ${code}.` : "The code is taken from the name. Use at least two letters."}</p>
    </form>
  );
}
