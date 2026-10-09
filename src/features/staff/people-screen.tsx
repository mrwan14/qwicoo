"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { commonCopy } from "@/lib/i18n/staff/common";
import { peopleCopy } from "@/lib/i18n/staff/people";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { areaNames, boundsForGovernorate, loadEgyptGovernorates, searchEgyptAreas, type EgyptAreaSuggestion } from "@/lib/maps/egypt";
import { useScope } from "@/stores/scope";

const control = "h-11 w-full rounded-lg border px-3 text-sm";
const hint = "text-sm leading-6 text-muted-foreground";
const sectionCard = "grid max-w-3xl gap-4 rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5";
const primaryButton = "inline-flex min-h-11 w-fit shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";
const secondaryButton = "inline-flex min-h-11 w-fit shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";
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
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [staffQuery, setStaffQuery] = useState("");
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
        shift_start_time: "10:00:00",
        shift_end_time: "18:00:00",
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
        <h1 className="text-[length:var(--text-28)] font-semibold">{t.title}</h1>
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
    <li className="grid content-start gap-3 rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1">
          <p className="font-semibold">{person.full_name}</p>
          <p className="text-sm text-muted-foreground">{person.email}</p>
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
          {person.is_active ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-xl border border-destructive/30 px-4 text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              onClick={onDeactivate}
            >
              {t.deactivate}
            </button>
          ) : null}
        </div>
      )}
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
        <h1 className="text-[length:var(--text-28)] font-semibold">{t.title}</h1>
        <p className={`mt-1 max-w-2xl ${hint}`}>{t.intro}</p>
      </header>

      <form className="grid max-w-3xl gap-4 rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
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
        {brands.isError ? <p className="text-sm text-destructive">{brands.error.message}</p> : null}
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
                <li key={feature.id} className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="grid gap-1">
                    <p className="font-semibold">{pickLocale({ en: feature.name_en, ar: feature.name_ar }, locale) || feature.name_en}</p>
                    <p className="text-sm text-muted-foreground">{feature.id}</p>
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
                      <span className="text-sm text-muted-foreground">{t.core}</span>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center rounded-xl border border-destructive/30 px-4 text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
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
                <li key={item.id} className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <p className="font-semibold">{name ?? item.feature_key}</p>
                      {name ? <p className="text-sm text-muted-foreground">{item.feature_key}</p> : null}
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

export function DeliveryScreen() {
  const t = useStaffSection(peopleCopy).delivery;
  const { locale } = useLocale();
  const branchId = useScope((state) => state.branchId);
  const brandId = useScope((state) => state.brandId);
  const focusPlatform = useScope((state) => state.focusPlatform);
  const queryClient = useQueryClient();
  const [draftGovId, setDraftGovId] = useState("");
  const [govId, setGovId] = useState("");
  const [areaQuery, setAreaQuery] = useState("");
  const [areaOptions, setAreaOptions] = useState<EgyptAreaSuggestion[]>([]);
  const [areaPick, setAreaPick] = useState<{ nameEn: string; nameAr: string } | null>(null);
  const [areaError, setAreaError] = useState("");
  const [areaSearching, setAreaSearching] = useState(false);
  const [areaMiss, setAreaMiss] = useState(false);
  const [fee, setFee] = useState("25.00");
  const brands = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands", { params: { query: { limit: 100 } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.brandsFailed);
      return result.data.items;
    },
  });
  const brandBranches = useQuery({
    queryKey: ["brand-branches", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands/{brand_id}/branches", { params: { path: { brand_id: brandId ?? "" } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.branchesFailed);
      return result.data;
    },
  });
  const govs = useQuery({
    queryKey: ["delivery-govs", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/delivery/governorates");
      if (result.response.status === 404) return [];
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.governoratesFailed);
      return result.data;
    },
  });
  const zones = useQuery({
    queryKey: ["delivery-zones", govId],
    enabled: Boolean(govId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/delivery/governorates/{governorate_id}/zones", { params: { path: { governorate_id: govId } } });
      if (!result.response.ok || !result.data) return [];
      return result.data;
    },
  });
  const createGov = useMutation({
    mutationFn: async (place: { nameEn: string; nameAr: string }) => {
      const body: components["schemas"]["DeliveryGovernorateCreate"] = { name_en: place.nameEn, name_ar: place.nameAr, brand_id: brandId, is_active: true };
      const result = await browserApi.POST("/api/v1/delivery/governorates", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.createGovFailed);
    },
    onSuccess: () => {
      setDraftGovId("");
      void queryClient.invalidateQueries({ queryKey: ["delivery-govs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const createZone = useMutation({
    mutationFn: async (place: { nameEn: string; nameAr: string }) => {
      const body: components["schemas"]["DeliveryZoneCreate"] = { name_en: place.nameEn, name_ar: place.nameAr, governorate_id: govId, is_active: true };
      const result = await browserApi.POST("/api/v1/delivery/governorates/{governorate_id}/zones", { params: { path: { governorate_id: govId } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.createZoneFailed);
    },
    onSuccess: () => {
      setAreaQuery("");
      setAreaPick(null);
      setAreaOptions([]);
      setAreaMiss(false);
      void zones.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const setBranchFee = useMutation({
    mutationFn: async () => {
      const chosenBranch = (brandBranches.data ?? []).some((item) => item.id === branchId) ? branchId : null;
      if (!chosenBranch) throw new Error(t.chooseBranch);
      if (!govId) throw new Error(t.chooseGov);
      const body: components["schemas"]["BranchDeliveryFeeCreate"] = {
        branch_id: chosenBranch,
        governorate_id: govId,
        delivery_fee: fee,
        estimated_time_minutes: 45,
        min_order_amount: "0.00",
      };
      const result = await browserApi.POST("/api/v1/delivery/fees", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.feeFailed);
    },
    onSuccess: () => toast.success(t.feeSaved),
    onError: (error: Error) => toast.error(error.message),
  });
  const egypt = useQuery({
    queryKey: ["egypt-governorates"],
    staleTime: Infinity,
    retry: false,
    queryFn: () => loadEgyptGovernorates(),
  });
  const savedGovName = (govs.data ?? []).find((item) => item.id === govId)?.name_en ?? "";
  const areaBounds = useQuery({
    queryKey: ["egypt-gov-bounds", savedGovName],
    enabled: Boolean(savedGovName),
    staleTime: Infinity,
    retry: false,
    queryFn: () => boundsForGovernorate(savedGovName),
  });
  useEffect(() => {
    const query = areaQuery.trim();
    if (!govId || query.length < 2 || areaPick) {
      setAreaOptions([]);
      setAreaSearching(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setAreaSearching(true);
      setAreaError("");
      void searchEgyptAreas(query, areaBounds.data ?? null)
        .then((options) => {
          if (!cancelled) {
            setAreaOptions(options);
            setAreaMiss(options.length === 0);
          }
        })
        .catch((error: Error) => {
          if (!cancelled) {
            setAreaOptions([]);
            setAreaError(error.message);
          }
        })
        .finally(() => {
          if (!cancelled) setAreaSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [areaBounds.data, areaPick, areaQuery, govId]);
  const brandName = (brands.data ?? []).find((item) => item.id === brandId)?.name;
  const branchOptions = brandBranches.data ?? [];
  const selectedBranch = branchOptions.find((item) => item.id === branchId);
  const branchLabel = selectedBranch ? pickLocale(selectedBranch.name, locale) || selectedBranch.slug : null;
  const governorates = govs.data ?? [];
  const selectedGov = governorates.find((item) => item.id === govId);
  const zoneItems = zones.data ?? [];
  const egyptGovernorates = egypt.data ?? [];
  const draftGov = egyptGovernorates.find((item) => item.placeId === draftGovId) ?? null;
  const governorateAlreadyAdded = Boolean(
    draftGov && governorates.some((item) => item.name_en.localeCompare(draftGov.nameEn, "en", { sensitivity: "accent" }) === 0),
  );

  function chooseSavedGovernorate(next: string) {
    setGovId(next);
    setAreaQuery("");
    setAreaOptions([]);
    setAreaPick(null);
    setAreaError("");
    setAreaMiss(false);
  }

  const brandLabel = brandName ?? t.thisBrand;

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-[length:var(--text-28)] font-semibold">{t.title}</h1>
        <p className={`mt-1 max-w-2xl ${hint}`}>
          {fill(t.intro, { brand: brandLabel })}
        </p>
      </header>

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
              if (next !== brandId) chooseSavedGovernorate("");
              focusPlatform({ brandId: next, branchId: next === brandId ? branchId : null });
            }}
          >
            <option value="">{brands.isFetching ? t.loadingBrands : t.chooseBrand}</option>
            {(brands.data ?? []).map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </select>
        </label>
        {brands.isError ? <p className="text-sm text-destructive">{brands.error.message}</p> : null}
      </section>

      <section className={sectionCard}>
        <div>
          <h2 className="text-lg font-semibold">{t.govTitle}</h2>
          <p className={hint}>{t.govHint}</p>
        </div>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (draftGov) createGov.mutate(draftGov);
          }}
        >
          <label className="grid gap-1 text-sm">
            {t.governorate}
            <span className={hint}>{t.govPickHint}</span>
            <select
              className={control}
              value={draftGovId}
              disabled={!brandId || egypt.isLoading}
              onChange={(event) => setDraftGovId(event.target.value)}
            >
              <option value="">
                {egypt.isLoading ? t.loadingMaps : egypt.isError ? t.govUnavailable : t.chooseGovernorate}
              </option>
              {egyptGovernorates.map((item) => (
                <option key={item.placeId} value={item.placeId}>{item.nameEn} · {item.nameAr}</option>
              ))}
            </select>
          </label>
          {egypt.isError ? <p className="text-sm text-destructive">{egypt.error.message}</p> : null}
          {draftGov ? <p className={hint} dir="auto">{draftGov.nameEn} · {draftGov.nameAr}</p> : null}
          <button className={primaryButton} type="submit" disabled={!brandId || !draftGov || governorateAlreadyAdded || createGov.isPending} aria-describedby="add-governorate-hint">
            <Plus aria-hidden className="size-4" />
            {createGov.isPending ? t.adding : t.addGov}
          </button>
          <p id="add-governorate-hint" className={hint}>
            {governorateAlreadyAdded
              ? fill(t.alreadyAdded, { name: draftGov?.nameEn ?? t.thisGovernorate, brand: brandName ?? t.thisBrand })
              : draftGov
                ? fill(t.addsNamed, { name: draftGov.nameEn, brand: brandName ?? t.chosenBrand })
                : fill(t.addsChosen, { brand: brandName ?? t.chosenBrand })}
          </p>
        </form>
        {govs.isLoading ? <LoadingState label={t.loadingGovs} /> : null}
        {govs.isError ? <ErrorState body={govs.error.message} onRetry={() => void govs.refetch()} /> : null}
        {brandId && govs.isSuccess && governorates.length === 0 ? (
          <EmptyState title={t.emptyGovTitle} body={t.emptyGovBody} />
        ) : null}
        {governorates.length > 0 ? (
          <ul className="grid gap-2">
            {governorates.map((gov) => (
              <li key={gov.id} className="rounded-xl bg-background px-3 py-2 ring-1 ring-foreground/5">
                <p className="font-medium">{gov.name_en}</p>
                <p className="text-sm text-muted-foreground" dir="rtl">{gov.name_ar}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={sectionCard}>
        <div>
          <h2 className="text-lg font-semibold">{t.zonesTitle}</h2>
          <p className={hint}>{t.zonesHint}</p>
        </div>
        <label className="grid gap-1 text-sm">
          {t.governorate}
          <span className={hint}>{t.zonesGovHint}</span>
          <select className={control} value={govId} onChange={(event) => chooseSavedGovernorate(event.target.value)} disabled={!brandId}>
            <option value="">{governorates.length === 0 ? t.addGovFirst : t.chooseGovernorate}</option>
            {governorates.map((gov) => <option key={gov.id} value={gov.id}>{gov.name_en}</option>)}
          </select>
        </label>
        <div className="grid gap-1 text-sm">
          <label className="grid gap-1" htmlFor="delivery-area">
            {t.area}
            <span className={hint}>{selectedGov ? fill(t.areaIn, { name: selectedGov.name_en }) : t.chooseGovFirst}</span>
            <input
              id="delivery-area"
              className={control}
              role="combobox"
              aria-expanded={areaOptions.length > 0}
              aria-controls="delivery-area-list"
              aria-autocomplete="list"
              placeholder={selectedGov ? t.areaPlaceholder : t.areaPlaceholderNeedGov}
              value={areaQuery}
              disabled={!govId || areaBounds.isLoading}
              onChange={(event) => {
                setAreaQuery(event.target.value);
                setAreaPick(null);
                setAreaError("");
                setAreaMiss(false);
              }}
            />
          </label>
          {areaSearching ? <p className={hint}>{t.searching}</p> : null}
          {areaMiss && !areaSearching && areaQuery.trim().length >= 2 ? <p className={hint}>{t.noAreas}</p> : null}
          {areaError ? <p className="text-sm text-destructive">{areaError}</p> : null}
          {areaOptions.length > 0 ? (
            <ul id="delivery-area-list" role="listbox" className="grid max-h-64 overflow-auto rounded-xl bg-background py-1 ring-1 ring-foreground/10">
              {areaOptions.map((option) => (
                <li key={option.placeId} role="option">
                  <button
                    type="button"
                    className="grid w-full gap-0.5 px-3 py-2 text-start hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setAreaQuery(option.label);
                      setAreaOptions([]);
                      setAreaError("");
                      void areaNames(option.placeId)
                        .then((names) => setAreaPick(names))
                        .catch((error: Error) => setAreaError(error.message));
                    }}
                  >
                    <span className="font-medium">{option.label}</span>
                    {option.detail ? <span className="text-sm text-muted-foreground">{option.detail}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {areaPick ? <p className={hint} dir="auto">{areaPick.nameEn} · {areaPick.nameAr}</p> : null}
        </div>
        <button
          type="button"
          className={secondaryButton}
          disabled={!govId || !areaPick || createZone.isPending}
          aria-describedby="add-zone-hint"
          onClick={() => areaPick && createZone.mutate(areaPick)}
        >
          {createZone.isPending ? t.adding : t.addZone}
        </button>
        <p id="add-zone-hint" className={hint}>
          {selectedGov && areaPick
            ? fill(t.addsZone, { area: areaPick.nameEn, gov: selectedGov.name_en })
            : t.zoneNeedPick}
        </p>
        {govId && zones.isSuccess && zoneItems.length === 0 ? (
          <EmptyState title={t.emptyZoneTitle} body={t.emptyZoneBody} />
        ) : null}
        {zoneItems.length > 0 ? (
          <ul className="grid gap-2">
            {zoneItems.map((zone) => (
              <li key={zone.id} className="rounded-xl bg-background px-3 py-2 ring-1 ring-foreground/5">
                <p className="font-medium">{zone.name_en}</p>
                <p className="text-sm text-muted-foreground" dir="rtl">{zone.name_ar}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={sectionCard}>
        <div>
          <h2 className="text-lg font-semibold">{t.feeTitle}</h2>
          <p className={hint}>{t.feeHint}</p>
        </div>
        <label className="grid gap-1 text-sm">
          {t.branch}
          <span className={hint}>{t.branchHint}</span>
          <select
            className={control}
            value={branchLabel ? branchId ?? "" : ""}
            disabled={!brandId || brandBranches.isLoading}
            onChange={(event) => focusPlatform({ brandId, branchId: event.target.value || null })}
          >
            <option value="">{brandBranches.isFetching ? t.loadingBranches : t.chooseBranch}</option>
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>{pickLocale(branch.name, locale) || branch.slug}</option>
            ))}
          </select>
        </label>
        {brandBranches.isError ? <p className="text-sm text-destructive">{brandBranches.error.message}</p> : null}
        <label className="grid max-w-xs gap-1 text-sm">
          {t.feeLabel}
          <input className={control} inputMode="decimal" value={fee} onChange={(event) => setFee(event.target.value)} />
        </label>
        <button
          type="button"
          className={primaryButton}
          disabled={!branchLabel || !govId || setBranchFee.isPending}
          aria-describedby="set-fee-hint"
          onClick={() => setBranchFee.mutate()}
        >
          {setBranchFee.isPending ? t.saving : t.setFee}
        </button>
        <p id="set-fee-hint" className={hint}>
          {branchLabel && selectedGov
            ? fill(t.savesFee, { fee: fee || "0.00", branch: branchLabel, gov: selectedGov.name_en })
            : t.feeNeedChoices}
        </p>
      </section>
    </div>
  );
}
