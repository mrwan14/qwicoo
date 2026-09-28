"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useScope } from "@/stores/scope";

const control = "h-11 w-full rounded-lg border px-3 text-sm";
const COMBO_STATIONS = ["GRILL", "HOT_SIDE", "BEVERAGE", "ASSEMBLY"] as const;

export function ComboScreen() {
  const brandId = useScope((state) => state.brandId);
  const queryClient = useQueryClient();
  const [nameEn, setNameEn] = useState("Combo");
  const [nameAr, setNameAr] = useState("كومبو");
  const [parentId, setParentId] = useState("");
  const [componentId, setComponentId] = useState("");
  const [station, setStation] = useState<(typeof COMBO_STATIONS)[number]>("GRILL");
  const menus = useQuery({
    queryKey: ["menus", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/menus");
      if (result.response.status === 404) return [];
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Menus failed");
      return result.data;
    },
  });
  const components = useQuery({
    queryKey: ["combo", parentId],
    enabled: Boolean(parentId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/menus/items/{item_id}/combo-components", { params: { path: { item_id: parentId } } });
      if (result.response.status === 404) return [];
      if (!result.response.ok || !result.data) return [];
      return result.data;
    },
  });
  const createMenu = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["MenuCreate"] = { name_en: nameEn, name_ar: nameAr, brand_id: brandId, is_active: true, menu_type: "STANDARD" };
      const result = await browserApi.POST("/api/v1/menus", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not create menu");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["menus"] }),
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
      const result = await browserApi.POST("/api/v1/menus/items/{item_id}/combo-components", {
        params: { path: { item_id: parentId } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not add component");
    },
    onSuccess: () => void components.refetch(),
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: async (componentRowId: string) => {
      const result = await browserApi.DELETE("/api/v1/menus/combo-components/{component_id}", {
        params: { path: { component_id: componentRowId } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not remove component");
    },
    onSuccess: () => void components.refetch(),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid gap-4">
      <h1 className="text-[length:var(--text-28)] font-semibold">Combos</h1>
      {!brandId ? <p className="text-sm">Choose a brand first. Combo menus are stored on the brand.</p> : null}
      {menus.isError ? <p className="text-sm text-destructive">{menus.error.message}</p> : null}
      <form className="grid gap-2 sm:grid-cols-3" onSubmit={(event) => { event.preventDefault(); createMenu.mutate(); }}>
        <input className={control} value={nameEn} onChange={(event) => setNameEn(event.target.value)} />
        <input className={control} value={nameAr} onChange={(event) => setNameAr(event.target.value)} />
        <button className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground" type="submit">Create menu</button>
      </form>
      <ul className="grid gap-2">
        {(menus.data ?? []).map((menu) => (
          <li key={menu.id} className="rounded-lg border p-3 text-sm">{menu.name_en}</li>
        ))}
      </ul>
      <input className={control} placeholder="Parent item id" value={parentId} onChange={(event) => setParentId(event.target.value)} />
      <input className={control} placeholder="Component item id" value={componentId} onChange={(event) => setComponentId(event.target.value)} />
      <select className={control} value={station} onChange={(event) => setStation(event.target.value as typeof station)}>
        {COMBO_STATIONS.map((item) => <option key={item}>{item}</option>)}
      </select>
      <button type="button" className="min-h-11 w-fit rounded-lg border px-4 text-sm" onClick={() => addComponent.mutate()}>Add component</button>
      <ul className="grid gap-2">
        {(components.data ?? []).map((component) => (
          <li key={component.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <span>{component.target_station}</span>
            <button type="button" className="min-h-11 text-destructive" onClick={() => remove.mutate(component.id)}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OverrideScreen() {
  const branchId = useScope((state) => state.branchId);
  const [itemId, setItemId] = useState("");
  const [price, setPrice] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["BranchMenuOverrideUpdate"] = {
        price_override: price || null,
        is_available: true,
        is_visible: true,
      };
      const result = await browserApi.PATCH("/api/v1/menu/branches/{branch_id}/items/{item_id}/override", {
        params: { path: { branch_id: branchId ?? "", item_id: itemId } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Override failed");
    },
    onSuccess: () => toast.success("Override saved"),
    onError: (error: Error) => toast.error(error.message),
  });
  const patchCatalog = useMutation({
    mutationFn: async () => {
      const result = await browserApi.PATCH("/api/v1/menu/catalog-items/{item_id}", {
        params: { path: { item_id: itemId } },
        body: { base_price: price },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Catalog update failed");
    },
    onSuccess: () => toast.success("Catalog price updated"),
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="grid max-w-lg gap-3">
      <h1 className="text-[length:var(--text-28)] font-semibold">Branch overrides</h1>
      <input className={control} placeholder="Item id" value={itemId} onChange={(event) => setItemId(event.target.value)} />
      <input className={control} placeholder="Price override" value={price} onChange={(event) => setPrice(event.target.value)} />
      <button type="button" className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground" onClick={() => save.mutate()}>Save branch override</button>
      <button type="button" className="min-h-11 rounded-lg border text-sm" onClick={() => patchCatalog.mutate()}>Update catalog price</button>
    </div>
  );
}
