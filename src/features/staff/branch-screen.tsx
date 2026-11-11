"use client";

import { can } from "@/lib/auth/permissions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, MapPin } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "cn";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader as KitPageHeader } from "@/components/ops/kit/page-header";
import { Tabs } from "@/components/ops/kit/tabs";
import { NestedHeaders } from "@/components/ops/page-header";
import { SettingsFrame } from "@/features/staff/settings/frame";
import { settingsCopy } from "@/lib/i18n/staff/settings";
import { useStaffSession } from "@/components/ops/staff-session";
import { useDenyWhenMissing } from "@/lib/auth/session-client";
import { useScope } from "@/stores/scope";
import { LocationPickerDialog, type PickedLocation } from "@/components/ops/location-picker";
import { ApiError, asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { fill } from "@/lib/i18n/dictionary";
import { formatMoney } from "@/lib/format/money";
import { useLocale } from "@/lib/i18n/locale-store";
import { branchCopy } from "@/lib/i18n/staff/branch";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { mediaUrl } from "@/lib/media";
import { GEOFENCE_MAX, GEOFENCE_MIN, clampGeofence } from "@/lib/geofence";
import { asBranch } from "@/features/staff/menu/shared";
import { Switch } from "@/components/ops/kit/field";
import { ErrorState, LoadingState, QueryErrorState } from "@/components/ops/states";
import type { components } from "@/lib/api/schema";

const control =
  "h-11 w-full rounded-[10px] border border-border bg-canvas px-3 text-sm text-ink outline-none transition-colors hover:border-ink-secondary/50 focus-visible:border-ink disabled:bg-subtle disabled:text-disabled";
const hint = "text-sm leading-6 text-ink-secondary";
/** Small print under a field or above a save button. */
const note = "text-xs leading-5 text-ink-secondary";
const fieldLabel = "grid gap-1.5 text-sm font-medium text-ink";
const primaryButton =
  "inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50";
const secondaryButton =
  "inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-full border border-border bg-canvas px-4 text-sm font-medium text-ink transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50";
/** Save row at the bottom of a card: the note on the start side, the button on the end. */
const saveRow = "flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4";

type BranchTab = "profile" | "qwicoo" | "hours" | "location" | "financials" | "sla" | "offline";

/** Branch settings in three tabs. Tables, QR codes and the guest PIN live in Settings → Tables & QR. */
const GROUP_KEYS = ["details", "money", "service"] as const;
type BranchGroup = (typeof GROUP_KEYS)[number];
const GROUPS: Record<BranchGroup, readonly BranchTab[]> = {
  details: ["profile", "location", "hours"],
  money: ["financials", "qwicoo"],
  service: ["sla", "offline"],
};
/** Sections that need the full width; the rest pair up two to a row on wide screens. */
const WIDE: ReadonlySet<BranchTab> = new Set(["hours"]);

export function BranchScreen({ branchId }: { branchId: string }) {
  const t = useStaffSection(branchCopy);
  const me = useStaffSession();
  const settings = useStaffSection(settingsCopy);
  const params = useSearchParams();
  const router = useRouter();
  const movedToTablesQr = params.get("tab") === "tables";
  // The Tables tab moved to Settings → Tables & QR, which works on the branch picked in the top bar.
  useEffect(() => {
    if (!movedToTablesQr) return;
    useScope.getState().setActiveBranch(branchId);
    router.replace("/app/settings/tables-qr");
  }, [movedToTablesQr, branchId, router]);
  const group = GROUP_KEYS.find((key) => key === params.get("tab")) ?? "details";
  const platform = useScope((state) => state.homeScope === "platform");
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
  if (movedToTablesQr || branch.isLoading || missing) return <LoadingState label={t.loadingBranch} />;
  if (branch.isError || !branch.data) return <ErrorState body={branch.error?.message ?? t.branchMissing} onRetry={() => void branch.refetch()} />;
  const branchRecord = branch.data;
  const logoSrc = mediaUrl(branchRecord.logo_url) ?? mediaUrl(parentBrand.data?.logo_url);
  const branchTitle = branchRecord.display_name || branchRecord.slug;

  const canSetOffline = can(me?.role, "branch.offline");
  const visible = (item: BranchTab) => item !== "offline" || canSetOffline;
  const tabs = GROUP_KEYS.filter((key) => GROUPS[key].some(visible)).map((key) => ({
    value: key,
    label: settings.branchTabs[key],
    href: `/app/branches/${branchId}${key === "details" ? "" : `?tab=${key}`}`,
  }));
  const sections = GROUPS[group].filter(visible);
  const body = (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
      {sections.map((item) => (
        <section
          key={item}
          className={cn(
            "grid min-w-0 content-start gap-4 rounded-[16px] border border-border bg-canvas p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
            (WIDE.has(item) || sections.length === 1) && "xl:col-span-2",
          )}
        >
          <h2 className="text-base font-semibold text-ink">{t.tabs[item]}</h2>
          {item === "profile" ? <ProfileTab branchId={branchId} currency={branchRecord.currency} address={branchRecord.address ?? ""} /> : null}
          {item === "qwicoo" ? <QwicooTab branchId={branchId} /> : null}
          {item === "hours" ? <HoursTab branchId={branchId} hours={branchRecord.opening_hours} /> : null}
          {item === "location" ? <LocationTab branch={branchRecord} /> : null}
          {item === "financials" ? <FinancialsTab branchId={branchId} /> : null}
          {item === "sla" ? <SlaTab branchId={branchId} /> : null}
          {item === "offline" ? <OfflineTab branchId={branchId} /> : null}
        </section>
      ))}
    </div>
  );
  const title = (
    <span className="inline-flex items-center gap-3">
      {logoSrc ? (
        // Stored logos are on the API host, which next/image is not set up to optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt={fill(t.logoAlt, { name: branchTitle })} className="size-10 rounded-staff border border-border object-cover" />
      ) : null}
      {branchTitle}
    </span>
  );

  if (!platform) {
    return (
      <SettingsFrame item="branch" title={title} subtitle={settings.items.branch.body} tab={group} tabs={tabs}>
        {body}
      </SettingsFrame>
    );
  }
  // App Admin comes here from a brand, so the way back is that brand.
  return (
    <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-5">
      <KitPageHeader back={{ href: branchRecord.brand_id ? `/app/brands/${branchRecord.brand_id}` : "/app/brands", label: t.back }} title={title} />
      <Tabs label={settings.branchTabsLabel} value={group} items={tabs} />
      <NestedHeaders>{body}</NestedHeaders>
    </div>
  );
}

function BranchMobileSwitches({ branchId }: { branchId: string }) {
  const t = useStaffSection(branchCopy);
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["mobile-settings", branchId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/mobile-settings", {
        params: { path: { branch_id: branchId } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.switchesFailed);
      return result.data;
    },
  });
  const save = useMutation({
    mutationFn: async (next: components["schemas"]["BranchMobileSettings"]) => {
      const result = await browserApi.PATCH("/api/v1/branches/{branch_id}/mobile-settings", {
        params: { path: { branch_id: branchId } },
        body: next,
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.switchesFailed);
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["mobile-settings", branchId], data);
      toast.success(t.switchesSaved);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (settings.isLoading) return <p className={hint}>{t.checkingFee}</p>;
  if (settings.isError || !settings.data) return <p className="text-sm text-danger">{settings.error?.message ?? t.switchesFailed}</p>;
  const current = settings.data;
  const rows = [
    ["mobile_ordering", t.mobileOrdering],
    ["curbside", t.curbside],
    ["drive_thru", t.driveThru],
    ["mobile_delivery", t.mobileDelivery],
  ] as const;
  return (
    <ul className="grid divide-y divide-border overflow-hidden rounded-[12px] border border-border">
      {rows.map(([key, label]) => (
        <li key={key} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm">
          <span className="font-medium text-ink">{label}</span>
          <span className="flex items-center gap-2.5">
            <span className={cn("text-xs", current[key] ? "font-medium text-success" : "text-ink-secondary")} aria-hidden>
              {current[key] ? t.switchOn : t.switchOff}
            </span>
            <Switch aria-label={label} checked={current[key]} disabled={save.isPending} onCheckedChange={(next) => save.mutate({ ...current, [key]: next })} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function QwicooTab({ branchId }: { branchId: string }) {
  const t = useStaffSection(branchCopy);
  const { locale } = useLocale();
  const [govId, setGovId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [amount, setAmount] = useState("0.00");
  const [result, setResult] = useState<components["schemas"]["CalculateDeliveryFeeResponse"] | null>(null);
  const governorates = useQuery({
    queryKey: ["delivery-governorates", branchId],
    retry: (count, error) => !(error instanceof ApiError && error.status === 403) && count < 2,
    queryFn: async () => {
      const response = await browserApi.GET("/api/v1/delivery/governorates", { middleware: [asBranch(branchId)] });
      if (!response.response.ok || !response.data) throw asApiError(response.error, response.response, t.feeFailed);
      return response.data;
    },
  });
  const zones = useQuery({
    queryKey: ["delivery-zones", govId],
    enabled: Boolean(govId),
    queryFn: async () => {
      const response = await browserApi.GET("/api/v1/delivery/governorates/{governorate_id}/zones", {
        params: { path: { governorate_id: govId } },
        middleware: [asBranch(branchId)],
      });
      if (!response.response.ok || !response.data) throw asApiError(response.error, response.response, t.feeFailed);
      return response.data;
    },
  });
  const check = useMutation({
    mutationFn: async () => {
      if (!govId) throw new Error(t.chooseGovernorate);
      const response = await browserApi.POST("/api/v1/delivery/calculate-fee", {
        middleware: [asBranch(branchId)],
        body: {
          branch_id: branchId,
          governorate_id: govId,
          zone_id: zoneId || null,
          order_amount: amount,
        },
      });
      if (!response.response.ok || !response.data) throw asApiError(response.error, response.response, t.feeFailed);
      return response.data;
    },
    onSuccess: (data) => setResult(data),
    onError: (error: Error) => toast.error(error.message),
  });
  const nameOf = (row: { name_en: string; name_ar: string }) => (locale === "ar" ? row.name_ar || row.name_en : row.name_en);
  // Delivery switched off for the brand: say so instead of a fee checker with nothing to pick.
  const deliveryOff =
    governorates.error instanceof ApiError &&
    (governorates.error.code === "FEATURE_LOCKED_BY_PLATFORM" || governorates.error.status === 403);

  if (deliveryOff) {
    return (
      <div className="grid gap-4">
        <p className={hint}>{t.qwicooHint}</p>
        <BranchMobileSwitches branchId={branchId} />
        <p className="rounded-[12px] bg-subtle/60 p-4 text-sm text-ink-secondary">{t.deliveryOff}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <p className={hint}>{t.qwicooHint}</p>
      <BranchMobileSwitches branchId={branchId} />
      <Link href="/app/delivery" className={secondaryButton}>
        {t.zones}
        <ArrowUpRight aria-hidden className="size-4 rtl:-scale-x-100" />
      </Link>
      {governorates.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {governorates.error.message}
        </p>
      ) : null}
      <form
        className="grid gap-3 rounded-[12px] bg-subtle/60 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          check.mutate();
        }}
      >
        <h3 className="text-sm font-semibold text-ink">{t.checkFee}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={fieldLabel}>
            {t.governorate}
            <select
              className={control}
              value={govId}
              onChange={(event) => {
                setGovId(event.target.value);
                setZoneId("");
                setResult(null);
              }}
            >
              <option value="">{t.chooseGovernorate}</option>
              {(governorates.data ?? []).map((gov) => (
                <option key={gov.id} value={gov.id}>
                  {nameOf(gov)}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldLabel}>
            {t.zone}
            <select className={control} value={zoneId} onChange={(event) => setZoneId(event.target.value)} disabled={!govId}>
              <option value="">{t.anyZone}</option>
              {(zones.data ?? []).map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {nameOf(zone)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-40">
            <label className={fieldLabel}>
              {t.orderAmount}
              <input className={control} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
          </div>
          <button type="submit" className={primaryButton} disabled={check.isPending || !govId}>
            {check.isPending ? t.checkingFee : t.checkFee}
          </button>
        </div>
      </form>
      {result ? (
        <div className="grid gap-1 rounded-[12px] border border-border px-4 py-3 text-sm">
          <p className="font-medium text-ink">
            {fill(t.feeResult, { fee: formatMoney(result.delivery_fee, "EGP", locale), minutes: result.estimated_time_minutes })}
          </p>
          {result.is_serviceable ? null : <p>{t.notServiceable}</p>}
          {result.meets_minimum ? null : <p>{fill(t.belowMinimum, { amount: formatMoney(result.min_order_amount, "EGP", locale) })}</p>}
        </div>
      ) : null}
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
        // 00:00 to 00:00 is how the API stores "open 24 hours".
        if (day.allDay) {
          opening_hours[key] = [{ open: "00:00", close: "00:00" }];
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
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <p className={hint}>{t.hoursHint}</p>
          <p className={note}>{t.hoursExample}</p>
        </div>
        <button
          type="button"
          className={secondaryButton}
          onClick={() => setDays((current) => Object.fromEntries(WEEKDAY_KEYS.map((key) => [key, { ...current.mon }])) as typeof current)}
        >
          {fill(t.sameEveryDay, { day: t.days.mon })}
        </button>
      </div>
      <div className="grid divide-y divide-border overflow-hidden rounded-[12px] border border-border">
        {WEEKDAY_KEYS.map((key) => {
          const day = days[key];
          return (
            <div
              key={key}
              className={cn("grid gap-2 px-4 py-2.5 sm:grid-cols-[7rem_1fr_1fr_auto_auto] sm:items-center sm:gap-4", day.closed && "bg-subtle/50")}
            >
              <span className="text-sm font-semibold text-ink">{t.days[key]}</span>
              <label className="flex items-center gap-2 text-xs text-ink-secondary">
                {t.opens}
                <input
                  className={cn(control, "h-10")}
                  type="time"
                  value={day.open}
                  disabled={day.closed || day.allDay}
                  onChange={(event) => setDays((current) => ({ ...current, [key]: { ...current[key], open: event.target.value } }))}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-ink-secondary">
                {t.closes}
                <input
                  className={cn(control, "h-10")}
                  type="time"
                  value={day.close}
                  disabled={day.closed || day.allDay}
                  onChange={(event) => setDays((current) => ({ ...current, [key]: { ...current[key], close: event.target.value } }))}
                />
              </label>
              <label className="flex min-h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={day.allDay}
                  disabled={day.closed}
                  onChange={(event) => setDays((current) => ({ ...current, [key]: { ...current[key], allDay: event.target.checked } }))}
                />
                {t.allDay}
              </label>
              <label className="flex min-h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={day.closed}
                  onChange={(event) => setDays((current) => ({ ...current, [key]: { ...current[key], closed: event.target.checked } }))}
                />
                {t.closed}
              </label>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end">
        <button className={primaryButton} type="submit" disabled={save.isPending}>
          {save.isPending ? t.saving : t.saveHours}
        </button>
      </div>
    </form>
  );
}

type DayHours = { open: string; close: string; closed: boolean; allDay: boolean };

function daysFromHours(hours: components["schemas"]["OpeningHours"] | null | undefined): Record<Weekday, DayHours> {
  const next = {} as Record<Weekday, DayHours>;
  for (const key of WEEKDAY_KEYS) {
    if (!hours) {
      next[key] = { open: "09:00", close: "23:00", closed: false, allDay: false };
      continue;
    }
    const range = hours[key]?.[0];
    const open = range?.open.slice(0, 5);
    const close = range?.close.slice(0, 5);
    next[key] = range
      ? open === "00:00" && close === "00:00"
        ? { open: "09:00", close: "23:00", closed: false, allDay: true }
        : { open: open ?? "09:00", close: close ?? "23:00", closed: false, allDay: false }
      : { open: "09:00", close: "23:00", closed: true, allDay: false };
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
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <p className={hint}>{fill(t.currencyHint, { currency })}</p>
      <label className={fieldLabel}>
        {t.address}
        <input className={control} placeholder={t.addressPlaceholder} value={address} onChange={(event) => setAddress(event.target.value)} />
      </label>
      <div className={saveRow}>
        <p id="save-profile-hint" className={note}>
          {t.saveProfileHint}
        </p>
        <button className={primaryButton} type="submit" aria-describedby="save-profile-hint">
          {t.saveProfile}
        </button>
      </div>
    </form>
  );
}

function LocationTab({ branch }: { branch: components["schemas"]["BranchResponse"] }) {
  const t = useStaffSection(branchCopy);
  const queryClient = useQueryClient();
  const saved =
    branch.latitude != null && branch.longitude != null
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
        geofence_radius_meters: clampGeofence(radius),
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
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <p className={hint}>{t.locationHint}</p>
      <p id="open-map-hint" className={note}>
        {t.openMapHint}
      </p>
      <button
        type="button"
        className="flex min-h-12 items-center gap-3 rounded-[12px] border border-border px-3.5 py-2.5 text-start text-sm transition-colors hover:border-ink-secondary/50 hover:bg-subtle/50"
        aria-describedby="open-map-hint"
        onClick={() => setPickerOpen(true)}
      >
        <MapPin aria-hidden className="size-4 shrink-0 text-primary" />
        {location ? (
          <span className="grid gap-0.5">
            <span className="line-clamp-2">{location.address || t.pinned}</span>
            <span className="text-xs text-ink-secondary tabular-nums">
              {location.latitude}, {location.longitude}
            </span>
          </span>
        ) : (
          <span className="text-ink-secondary">{t.noLocation}</span>
        )}
        <span className="ms-auto shrink-0 rounded-full bg-subtle px-2.5 py-1 text-xs font-medium text-ink">{t.openMap}</span>
      </button>
      <label className={fieldLabel}>
        {t.geofence}
        <span className={cn(note, "font-normal")}>{t.geofenceHint}</span>
        <input
          className={control}
          type="number"
          min={GEOFENCE_MIN}
          max={GEOFENCE_MAX}
          value={radius}
          onChange={(event) => setRadius(Number(event.target.value))}
          onBlur={() => setRadius(clampGeofence(radius))}
        />
      </label>
      <div className={saveRow}>
        <p id="save-location-hint" className={note}>
          {t.saveLocationHint}
        </p>
        <button className={primaryButton} type="submit" disabled={!location || save.isPending} aria-describedby="save-location-hint">
          {t.saveLocation}
        </button>
      </div>
      <LocationPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} value={location} radiusMeters={clampGeofence(radius)} onConfirm={setLocation} />
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
  if (settings.isError) return <QueryErrorState error={settings.error} screen={t.tabs.financials} onRetry={() => void settings.refetch()} />;
  if (!settings.data) return <ErrorState body={t.settingsMissing} onRetry={() => void settings.refetch()} />;
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
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <p className={hint}>{t.financialsHint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <RateField label={t.taxRate} value={tax} saved={settings.tax_rate} onChange={setTax} currentLabel={t.currentRate} />
        <RateField label={t.serviceFee} value={fee} saved={settings.service_fee_rate} onChange={setFee} currentLabel={t.currentRate} />
      </div>
      <div className={saveRow}>
        <p id="save-financials-hint" className={note}>
          {t.saveFinancialsHint}
        </p>
        <button className={primaryButton} type="submit" disabled={save.isPending} aria-describedby="save-financials-hint">
          {t.saveFinancials}
        </button>
      </div>
    </form>
  );
}

/** A decimal rate (0.14) with its percentage beside it, so 14% is clear while typing. */
function RateField({
  label,
  value,
  saved,
  currentLabel,
  onChange,
}: {
  label: string;
  value: string;
  saved: string;
  currentLabel: string;
  onChange: (value: string) => void;
}) {
  const number = Number(value);
  const percent = value.trim() !== "" && Number.isFinite(number) ? `${Number((number * 100).toFixed(2))}%` : "—";
  return (
    <label className={fieldLabel}>
      {label}
      <span className="relative">
        <input className={cn(control, "pe-16 tabular-nums")} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} />
        <span
          aria-hidden
          className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-ink tabular-nums"
        >
          {percent}
        </span>
      </span>
      <span className={cn(note, "font-normal")}>{fill(currentLabel, { rate: saved })}</span>
    </label>
  );
}

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
  if (config.isError) return <QueryErrorState error={config.error} screen={t.tabs.offline} onRetry={() => void config.refetch()} />;
  if (!config.data) return <ErrorState body={t.offlineMissing} onRetry={() => void config.refetch()} />;
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
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) save.mutate();
      }}
    >
      <p className={hint}>{t.offlineHint}</p>
      <div className="flex min-h-12 items-center justify-between gap-3 rounded-[12px] border border-border px-4 py-2 text-sm">
        <span className="font-medium text-ink">{t.offlineAllow}</span>
        <Switch aria-label={t.offlineAllow} checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <label className={fieldLabel}>
        {t.offlineHours}
        <span className={cn(note, "font-normal")}>{t.offlineHoursHint}</span>
        <input className={control} type="number" min={1} max={72} value={hours} onChange={(event) => setHours(Number(event.target.value))} />
      </label>
      {!valid ? <p className="text-sm text-danger">{t.offlineHoursInvalid}</p> : null}
      <div className="flex justify-end border-t border-border pt-4">
        <button className={primaryButton} type="submit" disabled={!valid || save.isPending}>
          {t.saveOffline}
        </button>
      </div>
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
  if (sla.isError) return <QueryErrorState error={sla.error} screen={t.tabs.sla} onRetry={() => void sla.refetch()} />;
  if (!sla.data) return <ErrorState body={t.slaMissing} onRetry={() => void sla.refetch()} />;
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
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <p className={hint}>{t.slaHint}</p>
      <label className={fieldLabel}>
        {t.slaMinutes}
        <span className={cn(note, "font-normal")}>{fill(t.currentTarget, { minutes: savedMinutes })}</span>
        <input className={control} type="number" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
      </label>
      <div className={saveRow}>
        <p id="save-sla-hint" className={note}>
          {t.saveSlaHint}
        </p>
        <button className={primaryButton} type="submit" aria-describedby="save-sla-hint">
          {t.saveSla}
        </button>
      </div>
    </form>
  );
}
