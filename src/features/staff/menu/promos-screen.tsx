"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { Search, TicketPercent } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Badge, type Tone } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { EmptyState } from "@/components/ops/kit/empty-state";
import { Field, Input, Switch, Textarea } from "@/components/ops/kit/field";
import { formatAmount } from "@/components/ops/kit/money";
import { SegmentedControl } from "@/components/ops/kit/segmented";
import { PanelSection, SidePanel } from "@/components/ops/kit/side-panel";
import { useStaffSession } from "@/components/ops/staff-session";
import { canManagePromos } from "@/features/staff/menu-permissions";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { menuCopy } from "@/lib/i18n/staff/menu";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

type Promo = components["schemas"]["PromoCodeResponse"];
type DiscountType = "percent" | "fixed";
type PromoState = "active" | "off" | "scheduled" | "expired" | "usedUp";

const CODE = /^[A-Z0-9-]{1,32}$/;

const STATE_TONE: Record<PromoState, Tone> = {
  active: "success",
  off: "neutral",
  scheduled: "info",
  expired: "warning",
  usedUp: "warning",
};

export function promoState(promo: Promo, now = Date.now()): PromoState {
  if (!promo.is_active) return "off";
  if (promo.starts_at && Date.parse(promo.starts_at) > now) return "scheduled";
  if (promo.ends_at && Date.parse(promo.ends_at) < now) return "expired";
  if (promo.max_total_uses != null && promo.uses_count >= promo.max_total_uses) return "usedUp";
  return "active";
}

/** Menu → Promo codes: the codes guests type at the QR checkout and cashiers enter on the till. */
export function PromosScreen() {
  const t = useStaffSection(menuCopy);
  const p = t.promos;
  const { locale } = useLocale();
  const me = useStaffSession();
  const brandId = useScope((state) => state.brandId);
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Promo | "new" | null>(null);
  const allowed = canManagePromos(me?.role);

  const promos = useQuery({
    queryKey: ["promo-codes", brandId],
    enabled: allowed && Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/admin/promo-codes", {
        // The API returns at most 100 per page; a brand rarely has more live codes than that.
        params: { query: { brand_id: brandId, limit: 100 } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, p.loadFailed, locale);
      return result.data.items;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ promo, on }: { promo: Promo; on: boolean }) => {
      const result = await browserApi.PATCH("/api/v1/admin/promo-codes/{promo_id}", {
        params: { path: { promo_id: promo.id } },
        body: { is_active: on },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, p.saveFailed, locale);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["promo-codes"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (!allowed) return <EmptyState icon={TicketPercent} title={p.onlyAdmins} />;
  if (!brandId) return <EmptyState icon={TicketPercent} title={p.chooseBrand} />;

  const money = (amount: string | number) => formatAmount(String(amount), undefined, locale);
  const date = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  const needle = query.trim().toUpperCase();
  const rows = (promos.data ?? []).filter((promo) => !needle || promo.code.includes(needle));

  const discountText = (promo: Promo) =>
    promo.discount_type === "percent"
      ? [fill(p.percentOff, { value: Number(promo.value) }), promo.max_discount_amount != null ? fill(p.upTo, { amount: money(promo.max_discount_amount) }) : null]
          .filter(Boolean)
          .join(" · ")
      : fill(p.amountOff, { amount: money(promo.value) });
  const limitsText = (promo: Promo) =>
    [
      promo.min_order_amount != null ? fill(p.minOrder, { amount: money(promo.min_order_amount) }) : null,
      promo.max_total_uses != null ? fill(p.usesOf, { used: promo.uses_count, max: promo.max_total_uses }) : fill(p.used, { used: promo.uses_count }),
    ]
      .filter(Boolean)
      .join(" · ");
  const datesText = (promo: Promo) =>
    [promo.starts_at ? fill(p.from, { date: date(promo.starts_at) }) : null, promo.ends_at ? fill(p.until, { date: date(promo.ends_at) }) : null]
      .filter(Boolean)
      .join(" · ") || p.anyTime;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-secondary">{p.intro}</p>
        <Button onClick={() => setEditing("new")}>{p.newCode}</Button>
      </div>

      {promos.isError ? (
        <p role="alert" className="rounded-staff bg-danger-bg px-4 py-3 text-sm text-ink">
          {promos.error.message}
        </p>
      ) : promos.data && promos.data.length === 0 ? (
        <EmptyState
          icon={TicketPercent}
          title={p.emptyTitle}
          body={p.emptyBody}
          action={<Button onClick={() => setEditing("new")}>{p.newCode}</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-staff border border-border bg-canvas">
          <div className="border-b border-border p-3">
            <Input
              icon={Search}
              aria-label={p.search}
              placeholder={p.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="max-w-xs"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-start text-sm">
              <thead className="bg-subtle text-xs text-ink-secondary">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium">{p.code}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{p.discount}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{p.limits}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{p.dates}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{p.status}</th>
                  <th className="w-16 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {promos.isPending ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-ink-secondary">
                      …
                    </td>
                  </tr>
                ) : (
                  rows.map((promo) => {
                    const state = promoState(promo);
                    return (
                      <tr key={promo.id} className="border-t border-border hover:bg-subtle">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="rounded-staff font-mono text-[15px] font-semibold tracking-wide text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
                            onClick={() => setEditing(promo)}
                          >
                            {promo.code}
                          </button>
                          {promo.description ? (
                            <span className="mt-0.5 block max-w-[220px] truncate text-xs text-ink-secondary">{pickLocale(promo.description, locale)}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-ink">{discountText(promo)}</td>
                        <td className="px-4 py-3 text-ink-secondary">{limitsText(promo)}</td>
                        <td className="px-4 py-3 text-ink-secondary">{datesText(promo)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={STATE_TONE[state]}>{p.states[state]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-end">
                          <Switch
                            checked={promo.is_active}
                            disabled={toggle.isPending}
                            aria-label={`${p.active} ${promo.code}`}
                            onCheckedChange={(on) => toggle.mutate({ promo, on })}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PromoPanel
        promo={editing === "new" ? null : editing}
        open={editing !== null}
        brandId={brandId}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

type Draft = {
  code: string;
  type: DiscountType;
  value: string;
  maxDiscount: string;
  minOrder: string;
  starts: string;
  ends: string;
  totalUses: string;
  perCustomer: string;
  descEn: string;
  descAr: string;
  active: boolean;
};

const EMPTY: Draft = {
  code: "",
  type: "percent",
  value: "10",
  maxDiscount: "",
  minOrder: "",
  starts: "",
  ends: "",
  totalUses: "",
  perCustomer: "1",
  descEn: "",
  descAr: "",
  active: true,
};

/** ISO time to the value a datetime-local input shows, in the device's time zone. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function draftOf(promo: Promo | null): Draft {
  if (!promo) return EMPTY;
  return {
    code: promo.code,
    type: promo.discount_type as DiscountType,
    value: String(Number(promo.value)),
    maxDiscount: promo.max_discount_amount != null ? String(Number(promo.max_discount_amount)) : "",
    minOrder: promo.min_order_amount != null ? String(Number(promo.min_order_amount)) : "",
    starts: toLocalInput(promo.starts_at),
    ends: toLocalInput(promo.ends_at),
    totalUses: promo.max_total_uses != null ? String(promo.max_total_uses) : "",
    perCustomer: promo.max_uses_per_customer != null ? String(promo.max_uses_per_customer) : "",
    descEn: promo.description ? pickLocale(promo.description, "en") : "",
    descAr: promo.description ? pickLocale(promo.description, "ar") : "",
    active: promo.is_active,
  };
}

const amountOrNull = (value: string) => (value.trim() ? value.trim() : null);
const countOrNull = (value: string) => (value.trim() ? Number(value) : null);

function PromoPanel({ promo, open, brandId, onClose }: { promo: Promo | null; open: boolean; brandId: string; onClose: () => void }) {
  const t = useStaffSection(menuCopy);
  const p = t.promos;
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [touched, setTouched] = useState(false);
  const set = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }));

  useEffect(() => {
    if (!open) return;
    setDraft(draftOf(promo));
    setTouched(false);
  }, [open, promo]);

  const code = draft.code.trim().toUpperCase();
  const codeOk = CODE.test(code);
  const value = Number(draft.value);
  const valueOk = Number.isFinite(value) && value > 0 && (draft.type === "fixed" || value <= 100);
  const locked = Boolean(promo && promo.uses_count > 0);

  const save = useMutation({
    mutationFn: async () => {
      const description = draft.descEn.trim() || draft.descAr.trim() ? { en: draft.descEn.trim() || draft.descAr.trim(), ar: draft.descAr.trim() || draft.descEn.trim() } : null;
      const fields = {
        description,
        discount_type: draft.type,
        value: draft.value.trim(),
        max_discount_amount: draft.type === "percent" ? amountOrNull(draft.maxDiscount) : null,
        min_order_amount: amountOrNull(draft.minOrder),
        starts_at: fromLocalInput(draft.starts),
        ends_at: fromLocalInput(draft.ends),
        max_total_uses: countOrNull(draft.totalUses),
        max_uses_per_customer: countOrNull(draft.perCustomer),
        is_active: draft.active,
      };
      if (promo) {
        const body: components["schemas"]["PromoCodePatch"] = { ...fields, ...(locked ? {} : { code }) };
        const result = await browserApi.PATCH("/api/v1/admin/promo-codes/{promo_id}", { params: { path: { promo_id: promo.id } }, body });
        if (!result.response.ok) throw asApiError(result.error, result.response, p.saveFailed, locale);
        return;
      }
      const body: components["schemas"]["PromoCodeWrite"] = { ...fields, brand_id: brandId, code };
      const result = await browserApi.POST("/api/v1/admin/promo-codes", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, p.saveFailed, locale);
    },
    onSuccess: () => {
      toast.success(promo ? p.saved : p.created);
      void queryClient.invalidateQueries({ queryKey: ["promo-codes"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!codeOk || !valueOk) return;
    save.mutate();
  }

  return (
    <SidePanel
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={promo ? p.editCode : p.newCode}
      description={promo ? promo.code : p.intro}
      footer={
        <>
          <Button variant="secondary" size="field" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button size="field" type="submit" form="promo-form" disabled={save.isPending}>
            {save.isPending ? p.saving : promo ? p.save : p.create}
          </Button>
        </>
      }
    >
      <form id="promo-form" className="grid gap-5" onSubmit={submit} noValidate>
        <Field label={p.codeField} hint={locked ? p.codeLocked : p.codeHint} error={touched && !codeOk ? p.codeInvalid : undefined}>
          <Input
            value={draft.code}
            disabled={locked}
            maxLength={32}
            autoComplete="off"
            spellCheck={false}
            className="font-mono uppercase"
            onChange={(event) => set({ code: event.target.value.toUpperCase().replace(/\s+/g, "") })}
          />
        </Field>

        <PanelSection title={p.discount}>
          <div className="grid gap-4">
            <SegmentedControl
              label={p.type}
              value={draft.type}
              onValueChange={(type) => set({ type })}
              items={[
                { value: "percent", label: p.percent },
                { value: "fixed", label: p.fixed },
              ]}
            />
            <div className={cn("grid gap-4", draft.type === "percent" && "sm:grid-cols-2")}>
              <Field label={draft.type === "percent" ? p.percentValue : p.fixedValue} error={touched && !valueOk ? p.valueInvalid : undefined}>
                <Input inputMode="decimal" value={draft.value} onChange={(event) => set({ value: event.target.value })} />
              </Field>
              {draft.type === "percent" ? (
                <Field label={p.maxDiscount} hint={p.maxDiscountHint}>
                  <Input inputMode="decimal" value={draft.maxDiscount} onChange={(event) => set({ maxDiscount: event.target.value })} />
                </Field>
              ) : null}
            </div>
          </div>
        </PanelSection>

        <PanelSection title={p.limits}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={p.minOrderField} hint={p.minOrderHint}>
              <Input inputMode="decimal" value={draft.minOrder} onChange={(event) => set({ minOrder: event.target.value })} />
            </Field>
            <Field label={p.totalUses} hint={p.totalUsesHint}>
              <Input inputMode="numeric" value={draft.totalUses} onChange={(event) => set({ totalUses: event.target.value })} />
            </Field>
            <Field label={p.perCustomer} hint={p.perCustomerHint} className="sm:col-span-2">
              <Input inputMode="numeric" className="w-32" value={draft.perCustomer} onChange={(event) => set({ perCustomer: event.target.value })} />
            </Field>
          </div>
        </PanelSection>

        <PanelSection title={p.dates} hint={p.datesHint}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={p.starts}>
              <Input type="datetime-local" value={draft.starts} onChange={(event) => set({ starts: event.target.value })} />
            </Field>
            <Field label={p.ends}>
              <Input type="datetime-local" value={draft.ends} onChange={(event) => set({ ends: event.target.value })} />
            </Field>
          </div>
        </PanelSection>

        <PanelSection title={p.notes} hint={p.descriptionHint}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={p.descriptionEn}>
              <Textarea value={draft.descEn} onChange={(event) => set({ descEn: event.target.value })} />
            </Field>
            <Field label={p.descriptionAr}>
              <Textarea dir="rtl" value={draft.descAr} onChange={(event) => set({ descAr: event.target.value })} />
            </Field>
          </div>
        </PanelSection>

        <div className="flex items-center justify-between gap-4 rounded-staff bg-subtle p-3">
          <span className="grid gap-0.5">
            <span className="text-sm font-medium text-ink">{p.active}</span>
            <span className="text-xs text-ink-secondary">{p.activeHint}</span>
          </span>
          <Switch checked={draft.active} onCheckedChange={(active) => set({ active })} aria-label={p.active} />
        </div>
      </form>
    </SidePanel>
  );
}
