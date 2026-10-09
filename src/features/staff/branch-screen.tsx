"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { useStaffSession } from "@/components/ops/staff-session";
import { PIN_ROLES } from "@/lib/auth/scope";
import { useDenyWhenMissing } from "@/lib/auth/session-client";
import { useScope } from "@/stores/scope";
import { LocationPickerDialog, type PickedLocation } from "@/components/ops/location-picker";
import { ApiError, asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { fill } from "@/lib/i18n/dictionary";
import { branchCopy } from "@/lib/i18n/staff/branch";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { mediaUrl } from "@/lib/media";
import { StatusChip } from "@/components/ops/status-chip";
import { ErrorState, LoadingState } from "@/components/ops/states";
import type { components } from "@/lib/api/schema";

const control = "h-11 w-full rounded-lg border px-3 text-sm";
const hint = "max-w-lg text-sm leading-6 text-muted-foreground";

const TAB_KEYS = ["profile", "hours", "location", "financials", "sla", "offline", "pin", "tables"] as const;

type BranchTab = (typeof TAB_KEYS)[number];
type BranchText = (typeof branchCopy)["en"];

export function BranchScreen({ branchId }: { branchId: string }) {
  const t = useStaffSection(branchCopy);
  const me = useStaffSession();
  const [tab, setTab] = useState<BranchTab>("profile");
  const branch = useQuery({
    queryKey: ["branch", branchId],
    retry: false,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}", { params: { path: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.branchFailed);
      return result.data;
    },
  });
  const parentBrandId = branch.data?.brand_id ?? null;
  const parentBrand = useQuery({
    queryKey: ["brand", parentBrandId],
    enabled: Boolean(parentBrandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands/{brand_id}", { params: { path: { brand_id: parentBrandId ?? "" } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.brandFailed);
      return result.data;
    },
  });
  const missing = useDenyWhenMissing(branch.error);
  useEffect(() => {
    if (branch.data) {
      useScope.getState().focusPlatform({ brandId: branch.data.brand_id ?? null, branchId: branch.data.id });
    }
  }, [branch.data]);
  if (branch.isLoading || missing) return <LoadingState label={t.loadingBranch} />;
  if (branch.isError || !branch.data) return <ErrorState body={branch.error?.message ?? t.branchMissing} onRetry={() => void branch.refetch()} />;
  const branchRecord = branch.data;
  const logoSrc = mediaUrl(branchRecord.logo_url) ?? mediaUrl(parentBrand.data?.logo_url);
  const branchTitle = branchRecord.display_name || branchRecord.slug;

  const canSeePin = Boolean(me && PIN_ROLES.includes(me.role));
  const canSetOffline = Boolean(me && OFFLINE_ADMIN_ROLES.includes(me.role));
  const tabs = TAB_KEYS.filter((item) => (item !== "pin" || canSeePin) && (item !== "offline" || canSetOffline));
  return (
    <div className="grid gap-4">
      <Link
        href={branchRecord.brand_id ? `/app/brands/${branchRecord.brand_id}` : "/app/brands"}
        className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
        {t.back}
      </Link>
      <div className="flex items-center gap-3">
        {logoSrc ? (
          // Stored logos are on the API host, which next/image is not set up to optimise.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt={fill(t.logoAlt, { name: branchTitle })} className="size-14 rounded-xl object-cover ring-1 ring-foreground/5" />
        ) : null}
        <h1 className="text-[length:var(--text-28)] font-semibold">{branchTitle}</h1>
      </div>
      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label={t.settingsLabel}>
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={`min-h-11 shrink-0 rounded-full border px-3 text-sm ${tab === item ? "border-primary/40 bg-secondary font-medium" : ""}`}
            onClick={() => setTab(item)}
          >
            {t.tabs[item]}
          </button>
        ))}
      </div>
      {tab === "profile" ? <ProfileTab branchId={branchId} currency={branchRecord.currency} address={branchRecord.address ?? ""} /> : null}
      {tab === "hours" ? <HoursTab branchId={branchId} hours={branchRecord.opening_hours} /> : null}
      {tab === "location" ? <LocationTab branch={branchRecord} /> : null}
      {tab === "financials" ? <FinancialsTab branchId={branchId} /> : null}
      {tab === "sla" ? <SlaTab branchId={branchId} /> : null}
      {tab === "pin" && canSeePin ? <PinTab branchId={branchId} /> : null}
      {tab === "offline" && canSetOffline ? <OfflineTab branchId={branchId} /> : null}
      {tab === "tables" ? <TablesTab branchId={branchId} /> : null}
    </div>
  );
}

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

type Weekday = (typeof WEEKDAY_KEYS)[number];

function HoursTab({ branchId, hours }: { branchId: string; hours: components["schemas"]["OpeningHours"] | null | undefined }) {
  const t = useStaffSection(branchCopy);
  const queryClient = useQueryClient();
  const [days, setDays] = useState(() => daysFromHours(hours));
  useEffect(() => {
    setDays(daysFromHours(hours));
  }, [hours]);
  const save = useMutation({
    mutationFn: async () => {
      const opening_hours: components["schemas"]["OpeningHours"] = {};
      for (const key of WEEKDAY_KEYS) {
        const day = days[key];
        if (day.closed) {
          opening_hours[key] = [];
          continue;
        }
        if (day.open === day.close) throw new Error(fill(t.hoursMismatch, { day: t.days[key] }));
        opening_hours[key] = [{ open: day.open, close: day.close }];
      }
      const result = await browserApi.PATCH("/api/v1/branches/{branch_id}", {
        params: { path: { branch_id: branchId } },
        body: { opening_hours },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotSaveHours);
    },
    onSuccess: () => {
      toast.success(t.hoursSaved);
      void queryClient.invalidateQueries({ queryKey: ["branch", branchId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form className="grid max-w-xl gap-3" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <p className={hint}>{t.hoursHint}</p>
      {WEEKDAY_KEYS.map((key) => {
        const day = days[key];
        return (
          <div key={key} className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end">
            <span className="text-sm font-medium">{t.days[key]}</span>
            <label className="grid gap-1 text-sm">
              {t.opens}
              <input className={control} type="time" value={day.open} disabled={day.closed} onChange={(event) => setDays((current) => ({ ...current, [key]: { ...current[key], open: event.target.value } }))} />
            </label>
            <label className="grid gap-1 text-sm">
              {t.closes}
              <input className={control} type="time" value={day.close} disabled={day.closed} onChange={(event) => setDays((current) => ({ ...current, [key]: { ...current[key], close: event.target.value } }))} />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={day.closed} onChange={(event) => setDays((current) => ({ ...current, [key]: { ...current[key], closed: event.target.checked } }))} />
              {t.closed}
            </label>
          </div>
        );
      })}
      <button className="min-h-11 w-fit rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50" type="submit" disabled={save.isPending}>
        {save.isPending ? t.saving : t.saveHours}
      </button>
    </form>
  );
}

function daysFromHours(hours: components["schemas"]["OpeningHours"] | null | undefined): Record<Weekday, { open: string; close: string; closed: boolean }> {
  const next = {} as Record<Weekday, { open: string; close: string; closed: boolean }>;
  for (const key of WEEKDAY_KEYS) {
    if (!hours) {
      next[key] = { open: "09:00", close: "23:00", closed: false };
      continue;
    }
    const range = hours[key]?.[0];
    next[key] = range
      ? { open: range.open.slice(0, 5), close: range.close.slice(0, 5), closed: false }
      : { open: "09:00", close: "23:00", closed: true };
  }
  return next;
}

function ProfileTab({ branchId, currency, address: savedAddress }: { branchId: string; currency: string; address: string }) {
  const t = useStaffSection(branchCopy);
  const queryClient = useQueryClient();
  const [address, setAddress] = useState(savedAddress);
  const save = useMutation({
    mutationFn: async () => {
      const result = await browserApi.PATCH("/api/v1/branches/{branch_id}", {
        params: { path: { branch_id: branchId } },
        body: { address },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.updateFailed);
    },
    onSuccess: () => {
      toast.success(t.profileSaved);
      void queryClient.invalidateQueries({ queryKey: ["branch", branchId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form className="grid max-w-lg gap-2" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <p className={hint}>{fill(t.currencyHint, { currency })}</p>
      <label className="grid gap-1 text-sm">
        {t.address}
        <input className={control} placeholder={t.addressPlaceholder} value={address} onChange={(event) => setAddress(event.target.value)} />
      </label>
      <p id="save-profile-hint" className={hint}>{t.saveProfileHint}</p>
      <button className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground" type="submit" aria-describedby="save-profile-hint">{t.saveProfile}</button>
    </form>
  );
}

function LocationTab({ branch }: { branch: components["schemas"]["BranchResponse"] }) {
  const t = useStaffSection(branchCopy);
  const queryClient = useQueryClient();
  const saved = branch.latitude != null && branch.longitude != null
    ? { latitude: Number(branch.latitude), longitude: Number(branch.longitude), address: branch.address ?? "" }
    : null;
  const [location, setLocation] = useState<PickedLocation | null>(saved);
  const [radius, setRadius] = useState(branch.geofence_radius_meters);
  const [pickerOpen, setPickerOpen] = useState(false);
  const save = useMutation({
    mutationFn: async () => {
      if (!location) throw new Error(t.pickLocation);
      const body: components["schemas"]["UpdateBranchLocationRequest"] = {
        latitude: location.latitude,
        longitude: location.longitude,
        geofence_radius_meters: radius,
      };
      const result = await browserApi.PUT("/api/v1/branches/{branch_id}/location", {
        params: { path: { branch_id: branch.id } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.locationFailed);
      if (location.address && location.address !== branch.address) {
        const patched = await browserApi.PATCH("/api/v1/branches/{branch_id}", {
          params: { path: { branch_id: branch.id } },
          body: { address: location.address },
        });
        if (!patched.response.ok) throw asApiError(patched.error, patched.response, t.addressFailed);
      }
    },
    onSuccess: () => {
      toast.success(t.locationSaved);
      void queryClient.invalidateQueries({ queryKey: ["branch", branch.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form className="grid max-w-lg gap-3" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <p className={hint}>{t.locationHint}</p>
      <p id="open-map-hint" className={hint}>{t.openMapHint}</p>
      <button
        type="button"
        className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-start text-sm hover:border-primary/40"
        aria-describedby="open-map-hint"
        onClick={() => setPickerOpen(true)}
      >
        <MapPin aria-hidden className="size-4 shrink-0 text-primary" />
        {location ? (
          <span className="grid gap-0.5">
            <span className="line-clamp-2">{location.address || t.pinned}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{location.latitude}, {location.longitude}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{t.noLocation}</span>
        )}
        <span className="ms-auto text-xs text-primary">{t.openMap}</span>
      </button>
      <label className="grid gap-1 text-sm">
        {t.geofence}
        <span className={hint}>{t.geofenceHint}</span>
        <input className={control} type="number" min={5} max={5000} value={radius} onChange={(event) => setRadius(Number(event.target.value))} />
      </label>
      <p id="save-location-hint" className={hint}>{t.saveLocationHint}</p>
      <button className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground disabled:opacity-50" type="submit" disabled={!location || save.isPending} aria-describedby="save-location-hint">{t.saveLocation}</button>
      <LocationPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} value={location} radiusMeters={radius} onConfirm={setLocation} />
    </form>
  );
}

function FinancialsTab({ branchId }: { branchId: string }) {
  const t = useStaffSection(branchCopy);
  const settings = useQuery({
    queryKey: ["fin", branchId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/financial-settings", { params: { path: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.settingsFailed);
      return result.data;
    },
  });
  if (settings.isLoading) return <LoadingState label={t.loadingSettings} />;
  if (settings.isError || !settings.data) return <ErrorState body={settings.error?.message ?? t.settingsMissing} onRetry={() => void settings.refetch()} />;
  return <FinancialsForm branchId={branchId} settings={settings.data} />;
}

function FinancialsForm({ branchId, settings }: { branchId: string; settings: components["schemas"]["BranchFinancialSettingsResponse"] }) {
  const t = useStaffSection(branchCopy);
  const queryClient = useQueryClient();
  const [tax, setTax] = useState(settings.tax_rate);
  const [fee, setFee] = useState(settings.service_fee_rate);
  const save = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["UpdateBranchFinancialSettingsRequest"] = {
        tax_rate: tax,
        service_fee_rate: fee,
        is_service_taxable: settings.is_service_taxable,
        is_tax_inclusive: settings.is_tax_inclusive,
        service_fee_dine_in_only: settings.service_fee_dine_in_only,
      };
      const result = await browserApi.PUT("/api/v1/branches/{branch_id}/financial-settings", {
        params: { path: { branch_id: branchId } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.saveFailed);
    },
    onSuccess: () => {
      toast.success(t.financialsSaved);
      void queryClient.invalidateQueries({ queryKey: ["fin", branchId] });
      void queryClient.invalidateQueries({ queryKey: ["branch", branchId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form className="grid max-w-lg gap-2" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <p className={hint}>{t.financialsHint}</p>
      <label className="grid gap-1 text-sm">
        {t.taxRate}
        <span className={hint}>{fill(t.currentRate, { rate: settings.tax_rate })}</span>
        <input className={control} value={tax} onChange={(event) => setTax(event.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        {t.serviceFee}
        <span className={hint}>{fill(t.currentRate, { rate: settings.service_fee_rate })}</span>
        <input className={control} value={fee} onChange={(event) => setFee(event.target.value)} />
      </label>
      <p id="save-financials-hint" className={hint}>{t.saveFinancialsHint}</p>
      <button className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground" type="submit" aria-describedby="save-financials-hint">{t.saveFinancials}</button>
    </form>
  );
}

const OFFLINE_ADMIN_ROLES: readonly string[] = ["BRANCH_ADMIN", "REGIONAL_MANAGER", "BRAND_ADMIN", "SUPER_ADMIN"];

function OfflineTab({ branchId }: { branchId: string }) {
  const t = useStaffSection(branchCopy);
  const config = useQuery({
    queryKey: ["offline-config", branchId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/offline-config", { params: { path: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.offlineFailed);
      return result.data;
    },
  });
  if (config.isLoading) return <LoadingState label={t.loadingOffline} />;
  if (config.isError || !config.data) return <ErrorState body={config.error?.message ?? t.offlineMissing} onRetry={() => void config.refetch()} />;
  return <OfflineForm branchId={branchId} enabled={config.data.offline_pos_enabled} hours={config.data.offline_max_hours} />;
}

function OfflineForm({ branchId, enabled: savedEnabled, hours: savedHours }: { branchId: string; enabled: boolean; hours: number }) {
  const t = useStaffSection(branchCopy);
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(savedEnabled);
  const [hours, setHours] = useState(savedHours);
  const valid = Number.isInteger(hours) && hours >= 1 && hours <= 72;
  const save = useMutation({
    mutationFn: async () => {
      const result = await browserApi.PATCH("/api/v1/branches/{branch_id}/offline-config", {
        params: { path: { branch_id: branchId } },
        body: { offline_pos_enabled: enabled, offline_max_hours: hours },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.offlineSaveFailed);
    },
    onSuccess: () => {
      toast.success(t.offlineSaved);
      void queryClient.invalidateQueries({ queryKey: ["offline-config", branchId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form className="grid max-w-lg gap-3" onSubmit={(event) => { event.preventDefault(); if (valid) save.mutate(); }}>
      <p className={hint}>{t.offlineHint}</p>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="size-5" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        {t.offlineAllow}
      </label>
      <label className="grid gap-1 text-sm">
        {t.offlineHours}
        <span className={hint}>{t.offlineHoursHint}</span>
        <input className={control} type="number" min={1} max={72} value={hours} onChange={(event) => setHours(Number(event.target.value))} />
      </label>
      {!valid ? <p className="text-sm text-destructive">{t.offlineHoursInvalid}</p> : null}
      <button className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground disabled:opacity-50" type="submit" disabled={!valid || save.isPending}>
        {t.saveOffline}
      </button>
    </form>
  );
}

function SlaTab({ branchId }: { branchId: string }) {
  const t = useStaffSection(branchCopy);
  const sla = useQuery({
    queryKey: ["sla", branchId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/sla-config", { params: { path: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.slaFailed);
      return result.data;
    },
  });
  if (sla.isLoading) return <LoadingState label={t.loadingSla} />;
  if (sla.isError || !sla.data) return <ErrorState body={sla.error?.message ?? t.slaMissing} onRetry={() => void sla.refetch()} />;
  return <SlaForm branchId={branchId} minutes={sla.data.sla_prep_time_minutes} />;
}

function SlaForm({ branchId, minutes: savedMinutes }: { branchId: string; minutes: number }) {
  const t = useStaffSection(branchCopy);
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState(savedMinutes);
  const save = useMutation({
    mutationFn: async () => {
      const result = await browserApi.PATCH("/api/v1/branches/{branch_id}/sla-config", {
        params: { path: { branch_id: branchId } },
        body: { sla_prep_time_minutes: minutes },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.slaSaveFailed);
    },
    onSuccess: () => {
      toast.success(t.slaSaved);
      void queryClient.invalidateQueries({ queryKey: ["sla", branchId] });
      void queryClient.invalidateQueries({ queryKey: ["branch", branchId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form className="grid max-w-lg gap-2" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <p className={hint}>{t.slaHint}</p>
      <label className="grid gap-1 text-sm">
        {t.slaMinutes}
        <span className={hint}>{fill(t.currentTarget, { minutes: savedMinutes })}</span>
        <input className={control} type="number" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
      </label>
      <p id="save-sla-hint" className={hint}>{t.saveSlaHint}</p>
      <button className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground" type="submit" aria-describedby="save-sla-hint">{t.saveSla}</button>
    </form>
  );
}

function PinTab({ branchId }: { branchId: string }) {
  const t = useStaffSection(branchCopy);
  const [confirm, setConfirm] = useState(false);
  const pin = useQuery({
    queryKey: ["pin", branchId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/access-pin", { params: { path: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.pinFailed);
      return result.data;
    },
  });
  const rotate = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/branches/{branch_id}/access-pin/rotate", { params: { path: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.rotateFailed);
      return result.data;
    },
    onSuccess: () => {
      setConfirm(false);
      void pin.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="grid max-w-lg gap-2">
      <p className={hint}>{t.pinHint}</p>
      <p className="text-2xl font-semibold tracking-widest">{pin.data?.access_pin ?? "—"}</p>
      <p id="rotate-pin-hint" className={hint}>{t.rotateHint}</p>
      <button
        type="button"
        className="inline-flex min-h-11 w-fit shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        aria-describedby="rotate-pin-hint"
        disabled={rotate.isPending}
        onClick={() => setConfirm(true)}
      >
        <RefreshCw aria-hidden className="size-4" />
        {rotate.isPending ? t.rotating : t.rotatePin}
      </button>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={t.rotateTitle} description={t.rotateBody} confirmLabel={t.rotate} destructive onConfirm={() => rotate.mutate()} />
    </div>
  );
}

type TableDetail = components["schemas"]["TableDetailResponse"];
type ChipTone = "available" | "browsing" | "ordered" | "ready" | "soldout" | "neutral";

function tableTone(table: TableDetail): ChipTone {
  if (!table.is_active) return "soldout";
  switch (table.status) {
    case "AVAILABLE":
      return "available";
    case "BROWSING":
      return "browsing";
    case "AWAITING_FOOD":
    case "BILL_REQUESTED":
      return "ordered";
    case "EATING":
      return "ready";
    case "NEEDS_CLEANING":
      return "soldout";
    default:
      return "neutral";
  }
}

function tableLabel(table: TableDetail, labels: BranchText["tableStatus"]): string {
  if (!table.is_active) return labels.inactive;
  switch (table.status) {
    case "AVAILABLE":
      return labels.AVAILABLE;
    case "BROWSING":
      return labels.BROWSING;
    case "AWAITING_FOOD":
      return labels.AWAITING_FOOD;
    case "EATING":
      return labels.EATING;
    case "BILL_REQUESTED":
      return labels.BILL_REQUESTED;
    case "NEEDS_CLEANING":
      return labels.NEEDS_CLEANING;
    default:
      return table.status;
  }
}

function seatLabel(capacity: number, one: string, many: string): string {
  return capacity === 1 ? one : fill(many, { count: capacity });
}

function TablesTab({ branchId }: { branchId: string }) {
  const t = useStaffSection(branchCopy);
  const [number, setNumber] = useState("");
  const queryClient = useQueryClient();
  const tables = useQuery({
    queryKey: ["tables", branchId],
    retry: false,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/tables", { params: { path: { branch_id: branchId } } });
      if (result.response.status === 500) throw new ApiError(500, t.tableListUnavailable);
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.tablesFailed);
      return result.data;
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["TableCreateRequest"] = { table_number: number, capacity: 4, zone_name: "Indoor" };
      const result = await browserApi.POST("/api/v1/branches/{branch_id}/tables", { params: { path: { branch_id: branchId } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotCreateTable);
    },
    onSuccess: () => {
      toast.success(t.tableCreated);
      void queryClient.invalidateQueries({ queryKey: ["tables", branchId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="grid gap-3">
      <p className={hint}>{t.tablesHint}</p>
      <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
        <label className="grid min-w-0 flex-1 gap-1 text-sm">
          {t.tableNumber}
          <input className={control} placeholder={t.tableNumberPlaceholder} value={number} onChange={(event) => setNumber(event.target.value)} required />
        </label>
        <button
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium whitespace-nowrap text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          type="submit"
          aria-describedby="add-table-hint"
          disabled={create.isPending}
        >
          <Plus aria-hidden className="size-4" />
          {create.isPending ? t.adding : t.addTable}
        </button>
      </form>
      <p id="add-table-hint" className={hint}>{t.addTableHint}</p>
      {tables.isError ? (
        <ErrorState title={t.noTableList} body={tables.error.message} onRetry={() => void tables.refetch()} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(tables.data ?? []).map((table) => (
            <li key={table.id} className="flex min-h-28 flex-col justify-between gap-3 rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg font-semibold">{fill(t.tableTitle, { number: table.table_number })}</p>
                <StatusChip tone={tableTone(table)}>{tableLabel(table, t.tableStatus)}</StatusChip>
              </div>
              <p className="text-sm text-muted-foreground">{table.zone_name} · {seatLabel(table.capacity, t.oneSeat, t.manySeats)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
