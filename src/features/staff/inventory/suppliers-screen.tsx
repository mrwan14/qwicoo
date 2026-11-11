"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Package, Pencil, Phone, Plus, Trash2, User } from "lucide-react";
import { useEffect, useId, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { ConfirmDialog } from "@/components/ops/kit/confirm-dialog";
import { Field, Input, Select, Textarea } from "@/components/ops/kit/field";
import { PanelSection, SidePanel } from "@/components/ops/kit/side-panel";
import { Money } from "@/components/ops/money";
import { PageHeader } from "@/components/ops/page-header";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { asApiError } from "@/lib/api/error";
import { formatMoney } from "@/lib/format/money";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { canRetireCatalogue, canWriteCatalogue } from "./access";
import { InventoryFrame, primaryButton, useBranchCurrency } from "./chrome";
import { formatQty } from "./qty";

type Detail = components["schemas"]["SupplierDetailResponse"];
type Pack = components["schemas"]["SupplierPackResponse"];

export function SuppliersScreen() {
  const t = useStaffSection(inventoryCopy);
  const currency = useBranchCurrency();
  const { locale } = useLocale();
  const me = useStaffSession();
  const brandId = useScope((state) => state.brandId) ?? "";
  const canWrite = canWriteCatalogue(me?.role);
  const [includeInactive, setIncludeInactive] = useState(false);
  // The panel stays mounted after closing so it can slide out; `session` gives each opening fresh fields.
  const [panel, setPanel] = useState<{ id: string | "new"; open: boolean; session: number }>({ id: "new", open: false, session: 0 });
  const openPanel = (id: string | "new") => setPanel((prev) => ({ id, open: true, session: prev.session + 1 }));
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
        action={canWrite ? <button type="button" className={primaryButton} onClick={() => openPanel("new")}>{t.suppliers.add}</button> : null}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} />
        {t.suppliers.showInactive}
      </label>
      {suppliers.isLoading ? <LoadingState label={t.loading} /> : null}
      {suppliers.isError ? <QueryErrorState error={suppliers.error} screen={t.tabs.suppliers} onRetry={() => void suppliers.refetch()} /> : null}
      {suppliers.data && suppliers.data.length === 0 ? <EmptyState title={t.suppliers.empty} body={t.suppliers.detail} /> : null}
      {suppliers.data && suppliers.data.length > 0 ? (
        <div className="overflow-x-auto bg-canvas">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b">
                {[t.suppliers.name, t.suppliers.contact, t.suppliers.phone, t.suppliers.leadTime, t.suppliers.owed, t.suppliers.active].map((label) => (
                  <th key={label} className="px-3 py-2 text-start font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suppliers.data.map((supplier) => (
                <tr key={supplier.id} className="cursor-pointer border-b hover:bg-muted/40" onClick={() => openPanel(supplier.id)}>
                  <td className="px-3 py-2">{supplier.name}</td>
                  <td className="px-3 py-2">{supplier.contact_name ?? ""}</td>
                  <td className="px-3 py-2">{supplier.phone ?? ""}</td>
                  <td className="px-3 py-2 tabular-nums">{formatQty(supplier.lead_time_days, locale)}</td>
                  <td className="px-3 py-2">
                    {Number(supplier.balance_owed ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-2">
                        <Money amount={supplier.balance_owed ?? "0"} currency={currency} />
                        {supplier.overdue_bills ? <Badge tone="danger">{t.bills.statuses.OVERDUE}</Badge> : null}
                      </span>
                    ) : (
                      <span className="text-ink-secondary">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2"><Badge tone={supplier.is_active ? "success" : "neutral"}>{supplier.is_active ? t.suppliers.active : t.suppliers.inactive}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <SupplierPanel
        key={panel.session}
        open={panel.open}
        brandId={brandId}
        supplierId={panel.id}
        canWrite={canWrite}
        onClose={() => setPanel((prev) => ({ ...prev, open: false }))}
        onCreated={(id) => setPanel((prev) => ({ ...prev, id }))}
      />
    </InventoryFrame>
  );
}

const WHOLE_DAYS = /^\d{1,3}$/;

/**
 * Add or edit a supplier. A new supplier needs only a name; once saved the panel stays open
 * on the new supplier so packs can be added straight away.
 */
function SupplierPanel({
  open,
  brandId,
  supplierId,
  canWrite,
  onClose,
  onCreated,
}: {
  open: boolean;
  brandId: string;
  supplierId: string | "new";
  canWrite: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const currency = useBranchCurrency();
  const formId = useId();
  const canRetire = canRetireCatalogue(useStaffSession()?.role);
  const isNew = supplierId === "new";
  const detail = useQuery({
    queryKey: ["inventory", "supplier", supplierId],
    enabled: open && !isNew,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/suppliers/{supplier_id}", {
        params: { path: { supplier_id: supplierId } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data;
    },
  });
  const current = isNew ? undefined : detail.data;
  const [footer, setFooter] = useState<{ dirty: boolean; valid: boolean; pending: boolean }>({ dirty: false, valid: false, pending: false });

  return (
    <SidePanel
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      size="lg"
      title={isNew ? t.suppliers.add : current?.name ?? t.suppliers.edit}
      description={isNew ? t.suppliers.newHint : undefined}
      meta={current ? (
        <>
          <Badge tone={current.is_active ? "success" : "neutral"}>{current.is_active ? t.suppliers.active : t.suppliers.inactive}</Badge>
          {current.lead_time_days ? <Badge>{`${formatQty(current.lead_time_days, locale)} ${t.suppliers.days}`}</Badge> : null}
        </>
      ) : null}
      footer={canWrite && (isNew || current) ? (
        <>
          <Button variant="secondary" size="field" onClick={onClose}>{t.cancel}</Button>
          <Button
            type="submit"
            form={formId}
            size="field"
            className="min-w-24"
            disabled={footer.pending || !footer.valid || (!isNew && !footer.dirty)}
            title={!isNew && !footer.dirty ? t.suppliers.noChanges : undefined}
          >
            {footer.pending ? t.suppliers.saving : isNew ? t.suppliers.add : t.save}
          </Button>
        </>
      ) : null}
    >
      {!isNew && detail.isLoading ? <PanelSkeleton /> : null}
      {!isNew && detail.isError ? <QueryErrorState error={detail.error} screen={t.tabs.suppliers} onRetry={() => void detail.refetch()} /> : null}
      {isNew || current ? (
        <SupplierForm
          key={current?.id ?? "new"}
          formId={formId}
          brandId={brandId}
          supplierId={supplierId}
          current={current}
          canWrite={canWrite}
          onStateChange={setFooter}
          onCreated={onCreated}
        />
      ) : null}
      {current ? <Packs brandId={brandId} supplier={current} packs={current.packs ?? []} canWrite={canWrite} currency={currency} /> : null}
      {current && canRetire ? <ActiveToggle brandId={brandId} supplier={current} onDeactivated={onClose} /> : null}
    </SidePanel>
  );
}

function PanelSkeleton() {
  return (
    <div aria-hidden className="grid animate-pulse gap-5">
      {[0, 1, 2].map((row) => (
        <div key={row} className="grid gap-2">
          <div className="h-3 w-20 rounded-staff bg-subtle" />
          <div className="h-[42px] rounded-staff bg-subtle" />
        </div>
      ))}
    </div>
  );
}

function SupplierForm({
  formId,
  brandId,
  supplierId,
  current,
  canWrite,
  onStateChange,
  onCreated,
}: {
  formId: string;
  brandId: string;
  supplierId: string | "new";
  current: Detail | undefined;
  canWrite: boolean;
  onStateChange: (state: { dirty: boolean; valid: boolean; pending: boolean }) => void;
  onCreated: (id: string) => void;
}) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const initial = {
    name: current?.name ?? "",
    contact: current?.contact_name ?? "",
    phone: current?.phone ?? "",
    email: current?.email ?? "",
    lead: String(current?.lead_time_days ?? 0),
    terms: current?.payment_terms_days != null ? String(current.payment_terms_days) : "",
    tax: current?.tax_number ?? "",
    address: current?.address ?? "",
    notes: current?.notes ?? "",
  };
  const [values, setValues] = useState(initial);
  const set = (key: keyof typeof initial) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((prev) => ({ ...prev, [key]: event.target.value }));

  const leadValid = WHOLE_DAYS.test(values.lead.trim() || "0");
  const termsValid = !values.terms.trim() || (WHOLE_DAYS.test(values.terms.trim()) && Number(values.terms) <= 365);
  const valid = values.name.trim().length > 0 && leadValid && termsValid;
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some((key) => values[key].trim() !== initial[key].trim());

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: values.name.trim(),
        contact_name: values.contact.trim() || null,
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        lead_time_days: Number(values.lead.trim() || 0),
        payment_terms_days: values.terms.trim() ? Number(values.terms.trim()) : null,
        tax_number: values.tax.trim() || null,
        address: values.address.trim() || null,
        notes: values.notes.trim() || null,
      };
      if (supplierId === "new") {
        const result = await browserApi.POST("/api/v1/inventory/suppliers", { params: { query: { brand_id: brandId } }, body });
        if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
        return result.data.id;
      }
      const result = await browserApi.PATCH("/api/v1/inventory/suppliers/{supplier_id}", { params: { path: { supplier_id: supplierId } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return supplierId;
    },
    onSuccess: async (id) => {
      toast.success(t.saved);
      await queryClient.invalidateQueries({ queryKey: ["inventory", "suppliers", brandId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory", "supplier", id] });
      if (supplierId === "new") onCreated(id);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });

  // The Save button lives in the panel footer, so it needs to know what the form knows.
  const pending = save.isPending;
  useEffect(() => onStateChange({ dirty, valid, pending }), [dirty, valid, pending, onStateChange]);

  return (
    <form
      id={formId}
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canWrite || !valid || save.isPending) return;
        if (supplierId !== "new" && !dirty) return;
        save.mutate();
      }}
    >
      {current && !current.is_active ? (
        <p role="status" className="rounded-staff border border-border bg-subtle px-3 py-2.5 text-sm text-ink-secondary">{t.suppliers.inactiveNote}</p>
      ) : null}
      <Field label={t.suppliers.name}>
        <Input
          value={values.name}
          onChange={set("name")}
          placeholder={t.suppliers.namePlaceholder}
          required
          autoFocus={supplierId === "new"}
          autoComplete="organization"
          disabled={!canWrite}
        />
      </Field>
      <PanelSection title={t.suppliers.contactSection}>
        <div className="grid gap-4">
          <Field label={t.suppliers.contact}>
            <Input icon={User} value={values.contact} onChange={set("contact")} placeholder={t.suppliers.contactPlaceholder} autoComplete="name" disabled={!canWrite} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.suppliers.phone}>
              <Input icon={Phone} type="tel" value={values.phone} onChange={set("phone")} autoComplete="tel" disabled={!canWrite} />
            </Field>
            <Field label={t.suppliers.email}>
              <Input icon={Mail} type="email" value={values.email} onChange={set("email")} autoComplete="email" disabled={!canWrite} />
            </Field>
          </div>
        </div>
      </PanelSection>
      <PanelSection title={t.suppliers.leadTimeLabel}>
        <Field hint={t.suppliers.leadTimeHint} error={leadValid ? undefined : t.suppliers.leadTimeInvalid} label={<span className="sr-only">{t.suppliers.leadTimeLabel}</span>}>
          <div className="relative w-40">
            <Input
              inputMode="numeric"
              value={values.lead}
              onChange={set("lead")}
              onFocus={(event) => event.currentTarget.select()}
              aria-invalid={!leadValid}
              className="pe-14 tabular-nums"
              disabled={!canWrite}
            />
            <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-ink-secondary">{t.suppliers.days}</span>
          </div>
        </Field>
      </PanelSection>
      <PanelSection title={t.suppliers.billingSection}>
        <div className="grid gap-4">
          <Field label={t.suppliers.paymentTerms} hint={t.suppliers.paymentTermsHint} error={termsValid ? undefined : t.suppliers.leadTimeInvalid}>
            <div className="relative w-40">
              <Input inputMode="numeric" value={values.terms} onChange={set("terms")} aria-invalid={!termsValid} className="pe-14 tabular-nums" disabled={!canWrite} />
              <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-ink-secondary">{t.suppliers.days}</span>
            </div>
          </Field>
          <Field label={t.suppliers.taxNumber}>
            <Input value={values.tax} onChange={set("tax")} maxLength={64} dir="ltr" disabled={!canWrite} />
          </Field>
          <Field label={t.suppliers.address}>
            <Input value={values.address} onChange={set("address")} maxLength={255} dir="auto" disabled={!canWrite} />
          </Field>
          <Field label={t.suppliers.notes}>
            <Textarea value={values.notes} onChange={set("notes")} maxLength={2000} dir="auto" disabled={!canWrite} />
          </Field>
        </div>
      </PanelSection>
    </form>
  );
}

function ActiveToggle({ brandId, supplier, onDeactivated }: { brandId: string; supplier: Detail; onDeactivated: () => void }) {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: async () => {
      const result = supplier.is_active
        ? await browserApi.POST("/api/v1/inventory/suppliers/{supplier_id}/deactivate", { params: { path: { supplier_id: supplier.id } } })
        : await browserApi.PATCH("/api/v1/inventory/suppliers/{supplier_id}", { params: { path: { supplier_id: supplier.id } }, body: { is_active: true } });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.saved);
      await queryClient.invalidateQueries({ queryKey: ["inventory", "suppliers", brandId] });
      await queryClient.invalidateQueries({ queryKey: ["inventory", "supplier", supplier.id] });
      if (supplier.is_active) onDeactivated();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <p className="max-w-[260px] text-xs text-ink-secondary">{t.suppliers.deactivateHint}</p>
      <Button
        variant={supplier.is_active ? "dangerGhost" : "secondary"}
        size="sm"
        disabled={toggle.isPending}
        onClick={() => toggle.mutate()}
      >
        {supplier.is_active ? t.suppliers.deactivate : t.suppliers.activate}
      </Button>
    </section>
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
  const [removing, setRemoving] = useState<Pack | null>(null);
  const ingredients = useQuery({
    queryKey: ["inventory", "ingredients", brandId, "active"],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/ingredients", { params: { query: { brand_id: brandId, active_only: true } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const units = useQuery({
    queryKey: ["inventory", "units", brandId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/units", { params: { query: { brand_id: brandId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const byIngredient = new Map((ingredients.data ?? []).map((item) => [item.id, item]));
  const byUnit = new Map((units.data ?? []).map((unit) => [unit.id, unit]));
  const packName = (pack: Pack) => {
    const ingredient = byIngredient.get(pack.ingredient_id);
    return ingredient ? pickLocale(ingredient.name, locale) : pack.ingredient_sku ?? pack.ingredient_id.slice(0, 8);
  };
  const remove = useMutation({
    mutationFn: async (packId: string) => {
      const result = await browserApi.DELETE("/api/v1/inventory/suppliers/{supplier_id}/ingredients/{pack_id}", {
        params: { path: { supplier_id: supplier.id, pack_id: packId } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
    },
    onSuccess: async () => {
      toast.success(t.saved);
      setRemoving(null);
      await queryClient.invalidateQueries({ queryKey: ["inventory", "supplier", supplier.id] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.loadFailed),
  });
  const takenIngredients = new Set(packs.map((pack) => pack.ingredient_id));

  return (
    <PanelSection
      title={packs.length ? `${t.suppliers.packs} · ${formatQty(packs.length, locale)}` : t.suppliers.packs}
      hint={t.suppliers.packsHint}
      action={canWrite && editing !== "new" && packs.length > 0 ? (
        <Button variant="secondary" size="sm" onClick={() => setEditing("new")}><Plus aria-hidden />{t.suppliers.addPack}</Button>
      ) : null}
    >
      {packs.length === 0 && editing !== "new" ? (
        <div className="grid justify-items-center gap-2 rounded-staff border border-dashed border-border px-4 py-6 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-subtle"><Package aria-hidden className="size-5 text-ink-secondary" /></span>
          <p className="text-sm font-medium text-ink">{t.suppliers.noPacks}</p>
          <p className="max-w-[280px] text-xs text-ink-secondary">{t.suppliers.noPacksBody}</p>
          {canWrite ? <Button variant="secondary" size="sm" className="mt-1" onClick={() => setEditing("new")}><Plus aria-hidden />{t.suppliers.addPack}</Button> : null}
        </div>
      ) : null}
      {packs.length > 0 ? (
        <ul className="grid divide-y divide-border rounded-staff border border-border">
          {packs.map((pack) => {
            const unit = byUnit.get(pack.pack_unit_id);
            if (editing === pack.id) {
              return (
                <li key={pack.id} className="p-3">
                  <PackForm brandId={brandId} supplierId={supplier.id} pack={pack} title={packName(pack)} ingredients={ingredients.data ?? []} units={units.data ?? []} onDone={() => setEditing(null)} />
                </li>
              );
            }
            return (
              <li key={pack.id} className="group flex items-center gap-3 px-3 py-2.5">
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate text-sm font-medium text-ink">{packName(pack)}</span>
                  <span className="text-xs text-ink-secondary">{fill(t.suppliers.packOf, { qty: formatQty(pack.pack_size, locale), unit: unit ? pickLocale(unit.name, locale) : "" })}</span>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-ink">{fill(t.suppliers.pricePer, { amount: formatMoney(pack.last_price, currency, locale) })}</span>
                {canWrite ? (
                  <div className="flex shrink-0 gap-0.5">
                    <Button variant="ghost" size="sm" className="size-8 px-0" aria-label={`${t.suppliers.editPack}: ${packName(pack)}`} onClick={() => setEditing(pack.id)}>
                      <Pencil aria-hidden />
                    </Button>
                    <Button variant="dangerGhost" size="sm" className="size-8 px-0" aria-label={`${t.suppliers.removePack}: ${packName(pack)}`} onClick={() => setRemoving(pack)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {editing === "new" ? (
        <PackForm
          brandId={brandId}
          supplierId={supplier.id}
          pack={null}
          title={t.suppliers.newPack}
          ingredients={(ingredients.data ?? []).filter((item) => !takenIngredients.has(item.id))}
          units={units.data ?? []}
          onDone={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => { if (!next) setRemoving(null); }}
        title={t.suppliers.removePackTitle}
        body={removing ? fill(t.suppliers.removePackBody, { name: packName(removing) }) : ""}
        confirmLabel={t.suppliers.removePack}
        pending={remove.isPending}
        onConfirm={() => { if (removing) remove.mutate(removing.id); }}
      />
    </PanelSection>
  );
}

function PackForm({
  brandId,
  supplierId,
  pack,
  title,
  ingredients,
  units,
  onDone,
}: {
  brandId: string;
  supplierId: string;
  pack: Pack | null;
  title: string;
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
  const ready = (pack || ingredientId) && unitId && Number(size) > 0 && (price === "" || Number(price) >= 0);
  const save = useMutation({
    mutationFn: async () => {
      const result = pack
        ? await browserApi.PATCH("/api/v1/inventory/suppliers/{supplier_id}/ingredients/{pack_id}", {
          params: { path: { supplier_id: supplierId, pack_id: pack.id } },
          body: { pack_unit_id: unitId, pack_size: size, last_price: price || "0" },
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
    <form
      className="grid animate-in gap-3 rounded-staff border border-border bg-subtle p-3 duration-200 fade-in-0 slide-in-from-top-1"
      onSubmit={(event) => { event.preventDefault(); if (ready && !save.isPending) save.mutate(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          // Close the inline form, not the whole panel.
          event.stopPropagation();
          onDone();
        }
      }}
    >
      <p className="text-sm font-semibold text-ink">{title}</p>
      {pack ? null : (
        <Field label={t.ingredient}>
          <Select value={ingredientId} onChange={(event) => setIngredientId(event.target.value)} required autoFocus>
            <option value="" disabled>{t.ingredient}</option>
            {ingredients.map((item) => <option key={item.id} value={item.id}>{pickLocale(item.name, locale)}</option>)}
          </Select>
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.suppliers.packSize}>
          <Input inputMode="decimal" value={size} onChange={(event) => setSize(event.target.value)} required autoFocus={Boolean(pack)} className="tabular-nums" />
        </Field>
        <Field label={t.unit}>
          <Select value={unitId} onChange={(event) => setUnitId(event.target.value)} required>
            <option value="" disabled>{t.unit}</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{pickLocale(unit.name, locale)}</option>)}
          </Select>
        </Field>
      </div>
      <Field label={t.suppliers.lastPrice}>
        <Input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0" className="tabular-nums" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>{t.cancel}</Button>
        <Button type="submit" size="sm" disabled={!ready || save.isPending}>{save.isPending ? t.suppliers.saving : t.save}</Button>
      </div>
    </form>
  );
}
