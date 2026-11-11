"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { ScreenTitle } from "@/components/ops/page-header";
import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ops/kit/menu";
import { StatusChip } from "@/components/ops/status-chip";
import { EmptyState, ErrorState, LoadingState } from "@/components/ops/states";
import { PasswordToggle } from "@/components/auth/password-toggle";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
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

const control =
  "h-11 w-full rounded-[10px] border border-border bg-canvas px-3 text-sm outline-none transition-colors hover:border-ink-secondary/50 focus-visible:border-ink";
const hint = "text-sm leading-6 text-ink-secondary";
/** Small print under a field label. */
const fieldHint = "text-xs font-normal leading-5 text-ink-secondary";
const fieldLabel = "grid gap-1 text-sm font-medium";
const sectionCard = "grid gap-4 rounded-[16px] border border-border bg-canvas p-5";
const primaryButton =
  "inline-flex min-h-10 w-fit shrink-0 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";
const secondaryButton =
  "inline-flex min-h-10 w-fit shrink-0 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";
/** Compact actions on a person card. */
const cardAction =
  "inline-flex min-h-9 items-center rounded-full border border-border px-3 text-[13px] font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const ROLES = ["CASHIER", "WAITER", "KITCHEN_STAFF", "RUNNER", "BRANCH_ADMIN"] as const;

function staffRole(role: string): string {
  return isUserRole(role) ? roleLabel(role) : role;
}

function clock(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "";
}

export function StaffScreen() {
  const t = useStaffSection(peopleCopy).staff;
  const common = useStaffSection(commonCopy);
  const branchId = useScope((state) => state.branchId);
  const brandId = useScope((state) => state.brandId);
  const queryClient = useQueryClient();
  const { locale } = useLocale();
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [adding, setAdding] = useState(false);
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
      if (password.length < MIN_PASSWORD_LENGTH) throw new Error(fill(t.passwordShort, { n: MIN_PASSWORD_LENGTH }));
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
      if (!result.response.ok) throw asApiError(result.error, result.response, t.addFailed, locale);
    },
    onSuccess: () => {
      toast.success(t.added);
      setAdding(false);
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
      if (!result.response.ok) throw asApiError(result.error, result.response, t.deactivateFailed, locale);
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
      if (!result.response.ok) throw asApiError(result.error, result.response, t.updateFailed, locale);
    },
    onSuccess: () => {
      toast.success(t.nameSaved);
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  // Deactivating keeps the account (and its email), so it can always come back.
  const reactivate = useMutation({
    mutationFn: async (staffId: string) => {
      const body: components["schemas"]["StaffUpdateRequest"] = { is_active: true };
      const result = await browserApi.PATCH("/api/v1/staff/{staff_id}", { params: { path: { staff_id: staffId } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.reactivateFailed, locale);
    },
    onSuccess: () => {
      toast.success(t.reactivated);
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
    ? people.filter((person) => [person.full_name, person.email, person.role, staffRole(person.role)].join(" ").toLowerCase().includes(staffSearch))
    : people;
  const personToRemove = people.find((person) => person.id === removeId);

  return (
    <div className="grid gap-6">
      <header>
        <ScreenTitle>{t.title}</ScreenTitle>
        <p className={`mt-1 max-w-2xl ${hint}`}>{t.intro}</p>
      </header>

      <section className={sectionCard}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-0.5">
            <h2 className="text-base font-semibold">{t.addPerson}</h2>
            <p className="max-w-2xl text-sm leading-6 text-ink-secondary">{t.addHint}</p>
          </div>
          {!adding ? (
            <button type="button" className={primaryButton} onClick={() => setAdding(true)}>
              <Plus aria-hidden className="size-4" />
              {t.addStaff}
            </button>
          ) : null}
        </div>
        {adding ? (
          <form
            className="grid gap-4 border-t border-border pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <label className={fieldLabel}>
                {t.fullName}
                <span className={fieldHint}>{t.fullNameHint}</span>
                <input className={control} value={fullName} onChange={(event) => setFullName(event.target.value)} required />
              </label>
              <label className={fieldLabel}>
                {t.email}
                <span className={fieldHint}>{t.emailHint}</span>
                <input className={control} type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
              <label className={fieldLabel}>
                {t.password}
                <span className={fieldHint}>{fill(t.passwordHint, { n: MIN_PASSWORD_LENGTH })}</span>
                <span className="relative">
                  <input
                    className={`${control} w-full pe-11`}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <PasswordToggle
                    shown={showPassword}
                    onToggle={() => setShowPassword((value) => !value)}
                    showLabel={t.showPassword}
                    hideLabel={t.hidePassword}
                  />
                </span>
              </label>
              <label className={fieldLabel}>
                {t.role}
                <span className={fieldHint}>{t.hints[role]}</span>
                <select className={control} value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
                  {ROLES.map((item) => (
                    <option key={item} value={item}>
                      {roleLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={fieldLabel}>
                {usualCopy.start}
                <input className={control} type="time" value={shiftStart} onChange={(event) => setShiftStart(event.target.value)} required />
              </label>
              <label className={fieldLabel}>
                {usualCopy.end}
                <input className={control} type="time" value={shiftEnd} onChange={(event) => setShiftEnd(event.target.value)} required />
                {shiftEnd && shiftStart && shiftEnd < shiftStart ? <span className={fieldHint}>{usualCopy.endHint}</span> : null}
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={primaryButton} type="submit" disabled={create.isPending}>
                <Plus aria-hidden className="size-4" />
                {create.isPending ? t.adding : t.addStaff}
              </button>
              <button type="button" className={secondaryButton} onClick={() => setAdding(false)}>
                {common.cancel}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t.peopleHere}</h2>
            <p className={hint}>{people.length === 1 ? t.onePerson : fill(t.peopleCount, { count: people.length })}</p>
          </div>
          <label className="grid w-full max-w-xs gap-1 text-sm">
            <span className="sr-only">{t.search}</span>
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
              reactivating={reactivate.isPending && reactivate.variables === person.id}
              onReactivate={() => reactivate.mutate(person.id)}
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
  reactivating,
  onReactivate,
}: {
  person: components["schemas"]["StaffResponse"];
  saving: boolean;
  onRename: (fullName: string) => void;
  onDeactivate: () => void;
  reactivating: boolean;
  onReactivate: () => void;
}) {
  const t = useStaffSection(peopleCopy).staff;
  const common = useStaffSection(commonCopy);
  const usualCopy = useStaffSection(attendanceCopy).usual;
  const [shiftOpen, setShiftOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(person.full_name);
  const edited = name.trim().length > 0 && name.trim() !== person.full_name.trim();
  // Close the editor once the saved name comes back from the server. (Comparing the draft with the
  // saved name closed it the moment it opened, so "Change name" did nothing.)
  useEffect(() => {
    setEditing(false);
  }, [person.full_name]);
  const shift = clock(person.shift_start_time) && clock(person.shift_end_time) ? `${clock(person.shift_start_time)}–${clock(person.shift_end_time)}` : "";

  return (
    <li className="grid content-start gap-2.5 rounded-[14px] border border-border bg-canvas p-4 transition-shadow hover:shadow-[0_4px_14px_rgb(0_0_0/0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid min-w-0 gap-0.5">
          <p className="truncate font-semibold">{person.full_name}</p>
          <p className="truncate text-sm text-ink-secondary">{person.email}</p>
        </div>
        <StatusChip tone={person.is_active ? "available" : "soldout"}>{person.is_active ? t.active : t.inactive}</StatusChip>
      </div>
      <p className="w-fit rounded-full bg-subtle px-2.5 py-0.5 text-xs font-medium">
        {staffRole(person.role)}
        {shift ? ` · ${shift}` : ""}
      </p>
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
              <button className={primaryButton} type="submit" disabled={saving}>
                {saving ? t.saving : t.saveName}
              </button>
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
        <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
          <button
            type="button"
            className={cardAction}
            onClick={() => {
              setName(person.full_name);
              setEditing(true);
            }}
          >
            {t.changeName}
          </button>
          <button type="button" className={cardAction} onClick={() => setShiftOpen(true)}>
            {usualCopy.button}
          </button>
          {person.is_active ? (
            <button
              type="button"
              className="ms-auto inline-flex min-h-9 items-center rounded-full px-3 text-[13px] font-medium text-danger hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              onClick={onDeactivate}
            >
              {t.deactivate}
            </button>
          ) : (
            <button
              type="button"
              className="ms-auto inline-flex min-h-9 items-center rounded-full px-3 text-[13px] font-medium text-ink hover:bg-subtle focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
              disabled={reactivating}
              onClick={onReactivate}
            >
              {reactivating ? t.reactivating : t.reactivate}
            </button>
          )}
        </div>
      )}
      {shiftOpen ? <UsualShiftPanel person={person} onClose={() => setShiftOpen(false)} /> : null}
    </li>
  );
}

function normaliseFeatureKey(raw: string): string | null {
  const key = raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
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
  // One brand: nothing to choose, so pick it.
  useEffect(() => {
    if (!brandId && brands.data?.length === 1) focusPlatform({ brandId: brands.data[0].id, branchId: null });
  }, [brandId, brands.data, focusPlatform]);
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
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
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
        {platform.isSuccess && features.length === 0 ? <EmptyState title={t.emptyTitle} body={t.emptyBody} /> : null}
        {features.length > 0 ? (
          <ul className="grid gap-3">
            {features.map((feature) => {
              const enabled = enabledKeys.has(feature.id);
              const pending = pendingToggle?.featureKey === feature.id;
              return (
                <li
                  key={feature.id}
                  className="flex flex-col gap-3 rounded-staff bg-canvas p-4 border border-border sm:flex-row sm:items-center sm:justify-between"
                >
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
                      {pending
                        ? enabled
                          ? t.disabling
                          : t.enabling
                        : enabled
                          ? fill(t.disableFor, { name: brandName ?? t.brandFallback })
                          : fill(t.enableFor, { name: brandName ?? t.brandFallback })}
                    </button>
                    {feature.is_core ? (
                      <span className="text-sm text-ink-secondary">{t.core}</span>
                    ) : (
                      // Deleting a feature is drastic, so it sits behind a menu (and still asks first).
                      <Menu>
                        <MenuTrigger
                          aria-label={fill(t.moreFor, { name: feature.name_en })}
                          className="inline-flex size-11 items-center justify-center rounded-staff text-ink-secondary outline-none hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
                        >
                          <MoreHorizontal aria-hidden className="size-5" />
                        </MenuTrigger>
                        <MenuContent align="end">
                          <MenuItem className="text-danger" disabled={remove.isPending} onClick={() => setRemoveKey(feature.id)}>
                            <Trash2 aria-hidden />
                            {t.delete}
                          </MenuItem>
                        </MenuContent>
                      </Menu>
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
        {!brandId ? <EmptyState title={t.noBrandTitle} body={t.noBrandBody} /> : null}
        {brandId && brand.isSuccess && entitlements.length === 0 ? <EmptyState title={t.noneTitle} body={t.noneBody} /> : null}
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
      {/* Adding a platform feature is a rare, developer-side job: tucked away below the daily work. */}
      <details className="group max-w-3xl rounded-staff border border-border bg-canvas">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-ink">
          <Plus aria-hidden className="size-4 transition-transform group-open:rotate-45" />
          {t.addTitle}
        </summary>
      <form
        className="grid gap-4 border-t border-border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <p className={hint}>{t.addHint}</p>
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
        <p id="add-feature-hint" className={hint}>
          {t.addDescribed}
        </p>
      </form>
      </details>
    </div>
  );
}
