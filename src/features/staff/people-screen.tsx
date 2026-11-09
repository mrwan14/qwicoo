"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { ScreenTitle } from "@/components/ops/page-header";
import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { StatusChip } from "@/components/ops/status-chip";
import { EmptyState, ErrorState, LoadingState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { isUserRole, roleLabel } from "@/lib/auth/roles";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { attendanceCopy } from "@/lib/i18n/staff/attendance";
import { commonCopy } from "@/lib/i18n/staff/common";
import { peopleCopy } from "@/lib/i18n/staff/people";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { UsualShiftPanel } from "./attendance/usual-shift-panel";

const control = "h-11 w-full rounded-staff border px-3 text-sm";
const hint = "text-sm leading-6 text-ink-secondary";
const sectionCard = "grid max-w-3xl gap-4 rounded-staff bg-canvas p-4 border border-border";
const primaryButton = "inline-flex min-h-11 w-fit shrink-0 items-center gap-2 rounded-staff bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";
const secondaryButton = "inline-flex min-h-11 w-fit shrink-0 items-center gap-2 rounded-staff border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";
const ROLES = ["CASHIER", "WAITER", "KITCHEN_STAFF", "RUNNER", "BRANCH_ADMIN"] as const;

function staffRole(role: string): string {
  return isUserRole(role) ? roleLabel(role) : role;
}

function clock(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "";
}

export function StaffScreen() {
  const t = useStaffSection(peopleCopy).staff;
  const branchId = useScope((state) => state.branchId);
  const brandId = useScope((state) => state.brandId);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("CASHIER");
  const [shiftStart, setShiftStart] = useState("10:00");
  const [shiftEnd, setShiftEnd] = useState("18:00");
  const usualCopy = useStaffSection(attendanceCopy).usual;
  const [removeId, setRemoveId] = useState<string | null>(null);
  const searchParam = useSearchParams().get("q");
  const [staffQuery, setStaffQuery] = useState(searchParam ?? "");
  // `?q=` comes from the top-bar search.
  useEffect(() => {
    if (searchParam !== null) setStaffQuery(searchParam);
  }, [searchParam]);
  const staff = useQuery({
    queryKey: ["staff", branchId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/staff", { params: { path: { branch_id: branchId ?? "" } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.failed);
      return result.data.records ?? [];
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["StaffCreateRequest"] = {
        email,
        password,
        full_name: fullName,
        role,
        branch_id: branchId ?? "",
        shift_start_time: `${shiftStart || "10:00"}:00`,
        shift_end_time: `${shiftEnd || "18:00"}:00`,
        late_grace_period_minutes: 30,
      };
      const path = brandId ? "/api/v1/brands/{brand_id}/staff" : "/api/v1/branches/{branch_id}/staff";
      const result = brandId
        ? await browserApi.POST("/api/v1/brands/{brand_id}/staff", { params: { path: { brand_id: brandId } }, body })
        : await browserApi.POST(path, { params: { path: { branch_id: branchId ?? "" } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.addFailed);
    },
    onSuccess: () => {
      toast.success(t.added);
      setFullName("");
      setEmail("");
      setPassword("");
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: async (staffId: string) => {
      const result = await browserApi.DELETE("/api/v1/staff/{staff_id}", { params: { path: { staff_id: staffId } } });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.deactivateFailed);
    },
    onSuccess: () => {
      setRemoveId(null);
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const rename = useMutation({
    mutationFn: async (input: { id: string; full_name: string }) => {
      const body: components["schemas"]["StaffUpdateRequest"] = { full_name: input.full_name };
      const result = await browserApi.PATCH("/api/v1/staff/{staff_id}", { params: { path: { staff_id: input.id } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.updateFailed);
    },
    onSuccess: () => {
      toast.success(t.nameSaved);
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!branchId) return null;
  if (staff.isLoading) return <LoadingState label={t.loading} />;
  if (staff.isError || !staff.data) return <ErrorState body={staff.error?.message ?? t.missing} onRetry={() => void staff.refetch()} />;

  const people = staff.data;
  const staffSearch = staffQuery.trim().toLowerCase();
  const visiblePeople = staffSearch
    ? people.filter((person) =>
        [person.full_name, person.email, person.role, staffRole(person.role)].join(" ").toLowerCase().includes(staffSearch),
      )
    : people;
  const personToRemove = people.find((person) => person.id === removeId);

  return (
    <div className="grid gap-6">
      <header>
        <ScreenTitle>{t.title}</ScreenTitle>
        <p className={`mt-1 max-w-2xl ${hint}`}>{t.intro}</p>
      </header>

      <form className={sectionCard} onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
        <div>
          <h2 className="text-lg font-semibold">{t.addPerson}</h2>
          <p className={hint}>{t.addHint}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            {t.fullName}
            <span className={hint}>{t.fullNameHint}</span>
            <input className={control} value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </label>
          <label className="grid gap-1 text-sm">
            {t.email}
            <span className={hint}>{t.emailHint}</span>
            <input className={control} type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="grid gap-1 text-sm">
            {t.password}
            <span className={hint}>{t.passwordHint}</span>
            <input className={control} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <label className="grid gap-1 text-sm">
            {t.role}
            <span className={hint}>{t.hints[role]}</span>
            <select className={control} value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
              {ROLES.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            {usualCopy.start}
            <input className={control} type="time" value={shiftStart} onChange={(event) => setShiftStart(event.target.value)} required />
          </label>
          <label className="grid gap-1 text-sm">
            {usualCopy.end}
            <input className={control} type="time" value={shiftEnd} onChange={(event) => setShiftEnd(event.target.value)} required />
            {shiftEnd && shiftStart && shiftEnd < shiftStart ? <span className={hint}>{usualCopy.endHint}</span> : null}
          </label>
        </div>
        <button className={primaryButton} type="submit" disabled={create.isPending}>
          <Plus aria-hidden className="size-4" />
          {create.isPending ? t.adding : t.addStaff}
        </button>
      </form>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t.peopleHere}</h2>
            <p className={hint}>{people.length === 1 ? t.onePerson : fill(t.peopleCount, { count: people.length })}</p>
          </div>
          <label className="grid w-full max-w-xs gap-1 text-sm">
            {t.search}
            <input className={control} value={staffQuery} onChange={(event) => setStaffQuery(event.target.value)} placeholder={t.searchPlaceholder} />
          </label>
        </div>
        {people.length === 0 ? <EmptyState title={t.emptyTitle} body={t.emptyBody} /> : null}
        {people.length > 0 && visiblePeople.length === 0 ? <EmptyState title={t.noMatchTitle} body={t.noMatchBody} /> : null}
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visiblePeople.map((person) => (
            <StaffCard
              key={person.id}
              person={person}
              saving={rename.isPending && rename.variables?.id === person.id}
              onRename={(full_name) => rename.mutate({ id: person.id, full_name })}
              onDeactivate={() => setRemoveId(person.id)}
            />
          ))}
        </ul>
      </section>

      <ConfirmDialog
        open={Boolean(removeId)}
        onOpenChange={(open) => !open && setRemoveId(null)}
        title={t.deactivateTitle}
        description={personToRemove ? fill(t.deactivateNamed, { name: personToRemove.full_name }) : t.deactivateGeneric}
        confirmLabel={t.deactivate}
        destructive
        onConfirm={() => removeId && remove.mutate(removeId)}
      />
    </div>
  );
}

function StaffCard({
  person,
  saving,
  onRename,
  onDeactivate,
}: {
  person: components["schemas"]["StaffResponse"];
  saving: boolean;
  onRename: (fullName: string) => void;
  onDeactivate: () => void;
}) {
  const t = useStaffSection(peopleCopy).staff;
  const common = useStaffSection(commonCopy);
  const usualCopy = useStaffSection(attendanceCopy).usual;
  const [shiftOpen, setShiftOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(person.full_name);
  const edited = name.trim().length > 0 && name.trim() !== person.full_name.trim();
  useEffect(() => {
    if (editing && person.full_name.trim() === name.trim()) setEditing(false);
  }, [editing, name, person.full_name]);
  const shift = clock(person.shift_start_time) && clock(person.shift_end_time)
    ? `${clock(person.shift_start_time)}–${clock(person.shift_end_time)}`
    : "";

  return (
    <li className="grid content-start gap-3 rounded-staff bg-canvas p-4 border border-border">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1">
          <p className="font-semibold">{person.full_name}</p>
          <p className="text-sm text-ink-secondary">{person.email}</p>
        </div>
        <StatusChip tone={person.is_active ? "available" : "soldout"}>{person.is_active ? t.active : t.inactive}</StatusChip>
      </div>
      <p className="text-sm">{staffRole(person.role)}{shift ? ` · ${shift}` : ""}</p>
      {editing ? (
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (edited) onRename(name.trim());
          }}
        >
          <label className="grid gap-1 text-sm">
            {t.fullName}
            <input className={control} value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <div className="flex flex-wrap gap-2">
            {edited ? (
              <button className={primaryButton} type="submit" disabled={saving}>{saving ? t.saving : t.saveName}</button>
            ) : null}
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                setName(person.full_name);
                setEditing(false);
              }}
            >
              {common.cancel}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryButton} onClick={() => { setName(person.full_name); setEditing(true); }}>
            {t.changeName}
          </button>
          <button type="button" className={secondaryButton} onClick={() => setShiftOpen(true)}>
            {usualCopy.button}
          </button>
          {person.is_active ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-staff border border-danger/30 px-4 text-sm font-medium text-danger hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              onClick={onDeactivate}
            >
              {t.deactivate}
            </button>
          ) : null}
        </div>
      )}
      {shiftOpen ? <UsualShiftPanel person={person} onClose={() => setShiftOpen(false)} /> : null}
    </li>
  );
}

function normaliseFeatureKey(raw: string): string | null {
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return /^[A-Z0-9_]{2,50}$/.test(key) ? key : null;
}

export function FeaturesScreen() {
  const t = useStaffSection(peopleCopy).features;
  const { locale } = useLocale();
  const brandId = useScope((state) => state.brandId);
  const branchId = useScope((state) => state.branchId);
  const focusPlatform = useScope((state) => state.focusPlatform);
  const queryClient = useQueryClient();
  const [key, setKey] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [removeKey, setRemoveKey] = useState<string | null>(null);
  const brands = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands", { params: { query: { limit: 100 } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.brandsFailed);
      return result.data.items;
    },
  });
  const platform = useQuery({
    queryKey: ["features-platform"],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/features/platform");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.failed);
      return result.data.items;
    },
  });
  const brand = useQuery({
    queryKey: ["features-brand", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/features/brand/{brand_id}", { params: { path: { brand_id: brandId ?? "" } } });
      if (!result.response.ok || !result.data) return [];
      return result.data.items;
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      const id = normaliseFeatureKey(key);
      if (!id) throw new Error(t.keyInvalid);
      const body: components["schemas"]["PlatformFeatureCreate"] = {
        id,
        name_en: nameEn.trim(),
        name_ar: nameEn.trim(),
        category: "OPS",
        is_core: false,
        is_premium: false,
        default_enabled: false,
      };
      const result = await browserApi.POST("/api/v1/features/platform", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.addFailed);
    },
    onSuccess: () => {
      toast.success(t.added);
      setKey("");
      setNameEn("");
      void queryClient.invalidateQueries({ queryKey: ["features-platform"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const toggle = useMutation({
    mutationFn: async (input: { featureKey: string; enabled: boolean }) => {
      const result = await browserApi.PUT("/api/v1/features/brand/{brand_id}/{feature_key}", {
        params: { path: { brand_id: brandId ?? "", feature_key: input.featureKey } },
        body: { is_enabled_by_super_admin: input.enabled },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, input.enabled ? t.enableFailed : t.disableFailed);
    },
    onSuccess: (_data, input) => {
      toast.success(input.enabled ? t.enabled : t.disabled);
      void queryClient.invalidateQueries({ queryKey: ["features-brand"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: async (featureKey: string) => {
      const result = await browserApi.DELETE("/api/v1/features/platform/{feature_key}", {
        params: { path: { feature_key: featureKey } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.deleteFailed);
    },
    onSuccess: () => {
      toast.success(t.deleted);
      setRemoveKey(null);
      void queryClient.invalidateQueries({ queryKey: ["features-platform"] });
      void queryClient.invalidateQueries({ queryKey: ["features-brand"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const brandName = (brands.data ?? []).find((item) => item.id === brandId)?.name;
  const features = platform.data ?? [];
  const entitlements = brand.data ?? [];
  const enabledKeys = new Set(entitlements.filter((item) => item.is_enabled_by_super_admin).map((item) => item.feature_key));
  const pendingToggle = toggle.isPending ? toggle.variables : null;

  return (
    <div className="grid gap-6">
      <header>
        <ScreenTitle>{t.title}</ScreenTitle>
        <p className={`mt-1 max-w-2xl ${hint}`}>{t.intro}</p>
      </header>

      <form className="grid max-w-3xl gap-4 rounded-staff bg-canvas p-4 border border-border" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
        <div>
          <h2 className="text-lg font-semibold">{t.addTitle}</h2>
          <p className={hint}>{t.addHint}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            {t.key}
            <span className={hint}>{t.keyHint}</span>
            <input className={control} value={key} onChange={(event) => setKey(event.target.value)} required />
          </label>
          <label className="grid gap-1 text-sm">
            {t.name}
            <span className={hint}>{t.nameHint}</span>
            <input className={control} value={nameEn} onChange={(event) => setNameEn(event.target.value)} required />
          </label>
        </div>
        <button className={primaryButton} type="submit" disabled={create.isPending} aria-describedby="add-feature-hint">
          <Plus aria-hidden className="size-4" />
          {create.isPending ? t.adding : t.addButton}
        </button>
        <p id="add-feature-hint" className={hint}>{t.addDescribed}</p>
      </form>

      <section className="grid max-w-3xl gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t.brandTitle}</h2>
          <p className={hint}>{t.brandHint}</p>
        </div>
        <label className="grid gap-1 text-sm">
          {t.brand}
          <select
            className={control}
            value={brandId ?? ""}
            onChange={(event) => {
              const next = event.target.value || null;
              focusPlatform({ brandId: next, branchId: next === brandId ? branchId : null });
            }}
          >
            <option value="">{brands.isFetching ? t.loadingBrands : t.chooseBrand}</option>
            {(brands.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        {brands.isError ? <p className="text-sm text-danger">{brands.error.message}</p> : null}
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t.listTitle}</h2>
          <p className={hint}>{brandName ? fill(t.forBrand, { name: brandName }) : t.chooseBefore}</p>
        </div>
        {platform.isLoading ? <LoadingState label={t.loading} /> : null}
        {platform.isError ? <ErrorState body={platform.error.message} onRetry={() => void platform.refetch()} /> : null}
        {platform.isSuccess && features.length === 0 ? (
          <EmptyState title={t.emptyTitle} body={t.emptyBody} />
        ) : null}
        {features.length > 0 ? (
          <ul className="grid gap-3">
            {features.map((feature) => {
              const enabled = enabledKeys.has(feature.id);
              const pending = pendingToggle?.featureKey === feature.id;
              return (
                <li key={feature.id} className="flex flex-col gap-3 rounded-staff bg-canvas p-4 border border-border sm:flex-row sm:items-center sm:justify-between">
                  <div className="grid gap-1">
                    <p className="font-semibold">{pickLocale({ en: feature.name_en, ar: feature.name_ar }, locale) || feature.name_en}</p>
                    <p className="text-sm text-ink-secondary">{feature.id}</p>
                    {feature.description ? <p className={hint}>{feature.description}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip tone={enabled ? "available" : "neutral"}>{enabled ? t.enabledChip : t.off}</StatusChip>
                    <button
                      type="button"
                      className={enabled ? secondaryButton : primaryButton}
                      disabled={!brandId || toggle.isPending}
                      onClick={() => toggle.mutate({ featureKey: feature.id, enabled: !enabled })}
                    >
                      {pending ? (enabled ? t.disabling : t.enabling) : enabled ? fill(t.disableFor, { name: brandName ?? t.brandFallback }) : fill(t.enableFor, { name: brandName ?? t.brandFallback })}
                    </button>
                    {feature.is_core ? (
                      <span className="text-sm text-ink-secondary">{t.core}</span>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center rounded-staff border border-danger/30 px-4 text-sm font-medium text-danger hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                        disabled={remove.isPending}
                        onClick={() => setRemoveKey(feature.id)}
                      >
                        {t.delete}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
        <ConfirmDialog
          open={Boolean(removeKey)}
          onOpenChange={(open) => !open && setRemoveKey(null)}
          title={t.deleteTitle}
          description={t.deleteBody}
          confirmLabel={t.delete}
          destructive
          onConfirm={() => removeKey && remove.mutate(removeKey)}
        />
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t.entitlements}</h2>
          <p className={hint}>{brandName ? fill(t.entitlementsFor, { name: brandName }) : t.entitlementsChoose}</p>
        </div>
        {!brandId ? (
          <EmptyState title={t.noBrandTitle} body={t.noBrandBody} />
        ) : null}
        {brandId && brand.isSuccess && entitlements.length === 0 ? (
          <EmptyState title={t.noneTitle} body={t.noneBody} />
        ) : null}
        {entitlements.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {entitlements.map((item) => {
              const match = features.find((feature) => feature.id === item.feature_key);
              const name = match ? pickLocale({ en: match.name_en, ar: match.name_ar }, locale) || match.name_en : undefined;
              return (
                <li key={item.id} className="flex flex-col gap-3 rounded-staff bg-canvas p-4 border border-border">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <p className="font-semibold">{name ?? item.feature_key}</p>
                      {name ? <p className="text-sm text-ink-secondary">{item.feature_key}</p> : null}
                    </div>
                    <StatusChip tone={item.is_enabled_by_super_admin ? "available" : "soldout"}>{item.is_enabled_by_super_admin ? t.on : t.off}</StatusChip>
                  </div>
                  <button
                    type="button"
                    className={item.is_enabled_by_super_admin ? secondaryButton : primaryButton}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ featureKey: item.feature_key, enabled: !item.is_enabled_by_super_admin })}
                  >
                    {pendingToggle?.featureKey === item.feature_key
                      ? item.is_enabled_by_super_admin
                        ? t.disabling
                        : t.enabling
                      : item.is_enabled_by_super_admin
                        ? fill(t.disableFor, { name: brandName ?? t.brandFallback })
                        : fill(t.enableFor, { name: brandName ?? t.brandFallback })}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
