"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
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
import { control, InventoryFrame, primaryButton, secondaryButton, useBranchCurrency } from "./chrome";
import { formatQty } from "./qty";

type Detail = components["schemas"]["SupplierDetailResponse"];
type Pack = components["schemas"]["SupplierPackResponse"];

export function SuppliersScreen() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const brandId = useScope((state) => state.brandId) ?? "";
  const canWrite = canWriteCatalogue(me?.role);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const suppliers = useQuery({
    queryKey: ["inventory", "suppliers", brandId, includeInactive],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/suppliers", {
        params: { query: { brand_id: brandId, include_inactive: includeInactive } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });

  return (
    <InventoryFrame page="suppliers">
      <PageHeader
        title={t.suppliers.title}
        detail={t.suppliers.detail}
        action={canWrite ? <button type="button" className={primaryButton} onClick={() => setSelected("new")}>{t.suppliers.add}</button> : null}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} />
        {t.suppliers.showInactive}
      </label>
      {suppliers.isLoading ? <LoadingState label={t.loading} /> : null}
      {suppliers.isError ? <QueryErrorState error={suppliers.error} screen={t.tabs.suppliers} onRetry={() => void suppliers.refetch()} /> : null}
      {suppliers.data && suppliers.data.length === 0 ? <EmptyState title={t.suppliers.empty} body={t.suppliers.detail} /> : null}
      {suppliers.data && suppliers.data.length > 0 ? (
        <div className="overflow-x-auto bg-card">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b">
                {[t.suppliers.name, t.suppliers.contact, t.suppliers.phone, t.suppliers.leadTime, t.suppliers.active].map((label) => (
                  <th key={label} className="px-3 py-2 text-start font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suppliers.data.map((supplier) => (
                <tr key={supplier.id} className="cursor-pointer border-b hover:bg-muted/40" onClick={() => setSelected(supplier.id)}>
                  <td className="px-3 py-2">{supplier.name}</td>
                  <td className="px-3 py-2">{supplier.contact_name ?? ""}</td>
                  <td className="px-3 py-2">{supplier.phone ?? ""}</td>
                  <td className="px-3 py-2 tabular-nums">{formatQty(supplier.lead_time_days, locale)}</td>
                  <td className="px-3 py-2">{supplier.is_active ? t.suppliers.active : t.suppliers.inactive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {selected ? (
        <SupplierDrawer
          key={selected}
          brandId={brandId}
          supplierId={selected}
          canWrite={canWrite}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </InventoryFrame>
  );
}

function SupplierDrawer({
  brandId,
  supplierId,
  canWrite,
  onClose,
}: {
  brandId: string;
  supplierId: string | "new";
  canWrite: boolean;
  onClose: () => void;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const currency = useBranchCurrency();
  const detail = useQuery({
    queryKey: ["inventory", "supplier", supplierId],
    enabled: supplierId !== "new",
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/suppliers/{supplier_id}", {
        params: { path: { supplier_id: supplierId } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data;
    },
  });
  const current = detail.data;

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto rounded-none sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{supplierId === "new" ? t.suppliers.add : current?.name ?? t.suppliers.edit}</SheetTitle>
        </SheetHeader>
        {supplierId !== "new" && detail.isLoading ? <LoadingState label={t.loading} /> : null}
        {supplierId !== "new" && detail.isError ? <QueryErrorState error={detail.error} screen={t.tabs.suppliers} onRetry={() => void detail.refetch()} /> : null}
        {supplierId === "new" || current ? (
          <SupplierForm
            key={current?.id ?? "new"}
            brandId={brandId}
            supplierId={supplierId}
            current={current}
            canWrite={canWrite}
            currency={currency}
            onClose={onClose}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function SupplierForm({
  brandId,
  supplierId,
  current,
  canWrite,
  currency,
  onClose,
}: {
  brandId: string;
  supplierId: string | "new";
  current: Detail | undefined;
  canWrite: boolean;
  currency: string;
  onClose: () => void;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [name, setName] = useState(current?.name ?? "");
  const [contact, setContact] = useState(current?.contact_name ?? "");
  const [phone, setPhone] = useState(current?.phone ?? "");
  const [email, setEmail] = useState(current?.email ?? "");
  const [lead, setLead] = useState(String(current?.lead_time_days ?? 0));

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["inventory", "suppliers", brandId] });
    if (supplierId !== "new") await queryClient.invalidateQueries({ queryKey: ["inventory", "supplier", supplierId] });
  }

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        contact_name: contact.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        lead_time_days: Number(lead) || 0,
      };
      const result = supplierId === "new"
        ? await browserApi.POST("/api/v1/inventory/suppliers", { params: { query: { brand_id: brandId } }, body })
        : await browserApi.PATCH("/api/v1/inventory/suppliers/{supplier_id}", { params: { path: { supplier_id: supplierId } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.saved);
      await refresh();
      if (supplierId === "new") onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  const deactivate = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/inventory/suppliers/{supplier_id}/deactivate", {
        params: { path: { supplier_id: supplierId === "new" ? "" : supplierId } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.saved);
      await refresh();
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  const activate = useMutation({
    mutationFn: async () => {
      const result = await browserApi.PATCH("/api/v1/inventory/suppliers/{supplier_id}", {
        params: { path: { supplier_id: supplierId === "new" ? "" : supplierId } },
        body: { is_active: true },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.saved);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });

  return (
    <>
      <form className="grid gap-3 px-4 pb-6" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <label className="grid gap-1 text-sm"><span>{t.suppliers.name}</span><input className={control} value={name} onChange={(event) => setName(event.target.value)} required disabled={!canWrite} /></label>
        <label className="grid gap-1 text-sm"><span>{t.suppliers.contact}</span><input className={control} value={contact} onChange={(event) => setContact(event.target.value)} disabled={!canWrite} /></label>
        <label className="grid gap-1 text-sm"><span>{t.suppliers.phone}</span><input className={control} value={phone} onChange={(event) => setPhone(event.target.value)} disabled={!canWrite} /></label>
        <label className="grid gap-1 text-sm"><span>{t.suppliers.email}</span><input className={control} type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={!canWrite} /></label>
        <label className="grid gap-1 text-sm"><span>{t.suppliers.leadTime}</span><input className={control} inputMode="numeric" value={lead} onChange={(event) => setLead(event.target.value)} disabled={!canWrite} /></label>
        {canWrite ? <button type="submit" className={primaryButton} disabled={save.isPending || !name.trim()}>{t.save}</button> : null}
        {canWrite && current?.is_active ? <button type="button" className={secondaryButton} disabled={deactivate.isPending} onClick={() => deactivate.mutate()}>{t.suppliers.deactivate}</button> : null}
        {canWrite && current && !current.is_active ? <button type="button" className={secondaryButton} disabled={activate.isPending} onClick={() => activate.mutate()}>{t.suppliers.activate}</button> : null}
      </form>
      {current ? <Packs brandId={brandId} supplier={current} packs={current.packs ?? []} canWrite={canWrite} currency={currency} /> : null}
    </>
  );
}

function Packs({
  brandId,
  supplier,
  packs,
  canWrite,
  currency,
}: {
  brandId: string;
  supplier: Detail;
  packs: Pack[];
  canWrite: boolean;
  currency: string;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const ingredients = useQuery({
    queryKey: ["inventory", "ingredients", brandId, "active"],
    enabled: canWrite,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/ingredients", { params: { query: { brand_id: brandId, active_only: true } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const units = useQuery({
    queryKey: ["inventory", "units", brandId],
    enabled: canWrite,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/units", { params: { query: { brand_id: brandId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const byIngredient = new Map((ingredients.data ?? []).map((item) => [item.id, item]));
  const byUnit = new Map((units.data ?? []).map((unit) => [unit.id, unit]));
  const remove = useMutation({
    mutationFn: async (packId: string) => {
      const result = await browserApi.DELETE("/api/v1/inventory/suppliers/{supplier_id}/ingredients/{pack_id}", {
        params: { path: { supplier_id: supplier.id, pack_id: packId } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.saved);
      await queryClient.invalidateQueries({ queryKey: ["inventory", "supplier", supplier.id] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });

  return (
    <div className="grid gap-3 border-t px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">{t.suppliers.packs}</h2>
        {canWrite ? <button type="button" className={secondaryButton} onClick={() => setEditing("new")}>{t.suppliers.addPack}</button> : null}
      </div>
      {packs.length === 0 ? <p className="text-sm text-muted-foreground">{t.suppliers.noPacks}</p> : null}
      {packs.map((pack) => {
        const ingredient = byIngredient.get(pack.ingredient_id);
        const unit = byUnit.get(pack.pack_unit_id);
        return (
          <div key={pack.id} className="grid gap-1 border-b py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span>{ingredient ? pickLocale(ingredient.name, locale) : pack.ingredient_sku ?? pack.ingredient_id.slice(0, 8)}</span>
              <Money amount={pack.last_price} currency={currency} />
            </div>
            <span className="text-muted-foreground">{formatQty(pack.pack_size, locale)} {unit ? pickLocale(unit.name, locale) : ""}</span>
            {canWrite ? (
              <div className="flex gap-2">
                <button type="button" className={secondaryButton} onClick={() => setEditing(pack.id)}>{t.suppliers.edit}</button>
                <button type="button" className={secondaryButton} onClick={() => remove.mutate(pack.id)}>{t.suppliers.removePack}</button>
              </div>
            ) : null}
          </div>
        );
      })}
      {editing ? (
        <PackForm
          key={editing}
          brandId={brandId}
          supplierId={supplier.id}
          pack={editing === "new" ? null : packs.find((pack) => pack.id === editing) ?? null}
          ingredients={ingredients.data ?? []}
          units={units.data ?? []}
          onDone={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function PackForm({
  brandId,
  supplierId,
  pack,
  ingredients,
  units,
  onDone,
}: {
  brandId: string;
  supplierId: string;
  pack: Pack | null;
  ingredients: components["schemas"]["IngredientResponse"][];
  units: components["schemas"]["UnitResponse"][];
  onDone: () => void;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [ingredientId, setIngredientId] = useState(pack?.ingredient_id ?? "");
  const [unitId, setUnitId] = useState(pack?.pack_unit_id ?? "");
  const [size, setSize] = useState(pack?.pack_size ?? "");
  const [price, setPrice] = useState(pack?.last_price ?? "");
  const save = useMutation({
    mutationFn: async () => {
      const result = pack
        ? await browserApi.PATCH("/api/v1/inventory/suppliers/{supplier_id}/ingredients/{pack_id}", {
          params: { path: { supplier_id: supplierId, pack_id: pack.id } },
          body: { pack_unit_id: unitId, pack_size: size, last_price: price },
        })
        : await browserApi.POST("/api/v1/inventory/suppliers/{supplier_id}/ingredients", {
          params: { path: { supplier_id: supplierId }, query: { brand_id: brandId } },
          body: { ingredient_id: ingredientId, pack_unit_id: unitId, pack_size: size, last_price: price || "0" },
        });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.saved);
      await queryClient.invalidateQueries({ queryKey: ["inventory", "supplier", supplierId] });
      onDone();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  return (
    <form className="grid gap-2 border p-3" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      {pack ? null : (
        <label className="grid gap-1 text-sm">
          <span>{t.ingredient}</span>
          <select className={control} value={ingredientId} onChange={(event) => setIngredientId(event.target.value)} required>
            <option value="">{t.ingredient}</option>
            {ingredients.map((item) => <option key={item.id} value={item.id}>{pickLocale(item.name, locale)}</option>)}
          </select>
        </label>
      )}
      <label className="grid gap-1 text-sm">
        <span>{t.unit}</span>
        <select className={control} value={unitId} onChange={(event) => setUnitId(event.target.value)} required>
          <option value="">{t.unit}</option>
          {units.map((unit) => <option key={unit.id} value={unit.id}>{pickLocale(unit.name, locale)}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm"><span>{t.suppliers.packSize}</span><input className={control} inputMode="decimal" value={size} onChange={(event) => setSize(event.target.value)} required /></label>
      <label className="grid gap-1 text-sm"><span>{t.suppliers.lastPrice}</span><input className={control} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
      <button type="submit" className={primaryButton} disabled={save.isPending}>{t.save}</button>
    </form>
  );
}
