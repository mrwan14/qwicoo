"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { LocaleText } from "@/components/ops/locale-text";
import { PageHeader } from "@/components/ops/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ops/states";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { pickLocale } from "@/lib/i18n/locale-text";
import type { components } from "@/lib/api/schema";
import { useWorkspace } from "@/stores/workspace";

const control = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm";
const STATIONS = ["HOT_KITCHEN", "COLD_KITCHEN", "BEVERAGE", "DESSERT"] as const;

type Item = components["schemas"]["MenuItemResponse"];

function names(en: string, ar: string) {
  return { en, ar };
}

export function MenuAdmin() {
  const branchId = useWorkspace((state) => state.branchId);
  const queryClient = useQueryClient();
  const [en, setEn] = useState("");
  const [ar, setAr] = useState("");
  const [station, setStation] = useState<(typeof STATIONS)[number]>("HOT_KITCHEN");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("10.00");
  const [itemEn, setItemEn] = useState("");
  const [itemAr, setItemAr] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const [tab, setTab] = useState<"items" | "stations">("items");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);

  const menu = useQuery({
    queryKey: ["menu-tree", branchId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/menu/tree");
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
      setItemOpen(false);
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

  if (!branchId) return <p className="text-sm">Choose a branch first.</p>;
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
              <button type="button" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground" onClick={() => setItemOpen(true)}>Add item</button>
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
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="flex gap-2 overflow-x-auto lg:flex-col">
            {categories.map((category) => (
              <button key={category.id} type="button" className={`min-h-12 shrink-0 rounded-xl px-3 text-start text-sm ${category.id === active?.id ? "bg-primary text-primary-foreground" : "bg-card shadow-elev-1"}`} onClick={() => setCategoryId(category.id)}>
                {pickLocale(category.name, "en")}
              </button>
            ))}
          </aside>
          {active ? (
            <ul className="grid gap-2">
              {(active.items ?? []).map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card p-3 shadow-elev-1">
                  <button type="button" className="min-h-11 text-start font-medium" onClick={() => setSelected(item)}>
                    <LocaleText value={item.name} /> · {item.base_price}
                  </button>
                  <AvailabilityToggle item={item} onDone={refresh} />
                </li>
              ))}
              {(active.items ?? []).length === 0 ? <EmptyState title="No items in this category" body="Add an item to show it on the guest menu." /> : null}
            </ul>
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
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Add item</SheetTitle>
          </SheetHeader>
          <form className="grid gap-3 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); createItem.mutate(); }}>
            <select className={control} value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
              <option value="">Category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{pickLocale(category.name, "en")}</option>
              ))}
            </select>
            <input className={control} placeholder="Price" value={price} onChange={(event) => setPrice(event.target.value)} required />
            <input className={control} placeholder="English name" value={itemEn} onChange={(event) => setItemEn(event.target.value)} required />
            <input className={control} placeholder="Arabic name" value={itemAr} onChange={(event) => setItemAr(event.target.value)} required />
            <button className="min-h-11 rounded-xl bg-primary text-sm text-primary-foreground" type="submit">Save item</button>
            <button className="min-h-11 rounded-xl border text-sm" type="button" onClick={() => catalog.mutate()}>Try catalog create</button>
          </form>
        </SheetContent>
      </Sheet>
      {selected ? <ModifierEditor item={selected} onClose={() => setSelected(null)} /> : null}
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
      <button type="button" className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => setOpen(true)}>
        {item.is_available ? "86 item" : "Make available"}
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

function ModifierEditor({ item, onClose }: { item: Item; onClose: () => void }) {
  const [en, setEn] = useState("Options");
  const [ar, setAr] = useState("خيارات");
  const [optionEn, setOptionEn] = useState("");
  const [groupId, setGroupId] = useState("");
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
        price_delta: "0.00",
        is_available: true,
      };
      const result = await browserApi.POST("/api/v1/staff/menu/modifier-groups/{group_id}/options", {
        params: { path: { group_id: groupId } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not add option");
    },
    onSuccess: () => toast.success("Option added"),
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
      <input className={control} placeholder="Group id" value={groupId} onChange={(event) => setGroupId(event.target.value)} />
      <input className={control} placeholder="Option name" value={optionEn} onChange={(event) => setOptionEn(event.target.value)} />
      <button type="button" className="min-h-11 rounded-lg border" onClick={() => createOption.mutate()}>
        Add option
      </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StationForm({ onDone }: { onDone: () => void }) {
  const [en, setEn] = useState("");
  const [code, setCode] = useState("HOT_KITCHEN");
  const create = useMutation({
    mutationFn: async () => {
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
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form
      className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <input className={control} placeholder="Station name" value={en} onChange={(event) => setEn(event.target.value)} required />
      <input className={control} placeholder="Code" value={code} onChange={(event) => setCode(event.target.value)} required />
      <button className="min-h-11 rounded-lg bg-primary px-4 text-sm text-primary-foreground" type="submit">
        Add station
      </button>
    </form>
  );
}
