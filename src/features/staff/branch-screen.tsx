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
import { mediaUrl } from "@/lib/media";
import { StatusChip } from "@/components/ops/status-chip";
import { ErrorState, LoadingState } from "@/components/ops/states";
import type { components } from "@/lib/api/schema";

const control = "h-11 w-full rounded-lg border px-3 text-sm";
const hint = "max-w-lg text-sm leading-6 text-muted-foreground";

const TAB_LABELS = {
  profile: "Profile",
  hours: "Operating hours",
  location: "Location",
  financials: "Financials",
  sla: "SLA",
  pin: "Access PIN",
  tables: "Tables",
} as const;

type BranchTab = keyof typeof TAB_LABELS;

export function BranchScreen({ branchId }: { branchId: string }) {
  const me = useStaffSession();
  const [tab, setTab] = useState<BranchTab>("profile");
  const branch = useQuery({
    queryKey: ["branch", branchId],
    retry: false,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}", { params: { path: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Branch failed");
      return result.data;
    },
  });
  const parentBrandId = branch.data?.brand_id ?? null;
  const parentBrand = useQuery({
    queryKey: ["brand", parentBrandId],
    enabled: Boolean(parentBrandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands/{brand_id}", { params: { path: { brand_id: parentBrandId ?? "" } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Brand failed");
      return result.data;
    },
  });
  const missing = useDenyWhenMissing(branch.error);
  useEffect(() => {
    if (branch.data) {
      useScope.getState().focusPlatform({ brandId: branch.data.brand_id ?? null, branchId: branch.data.id });
    }
  }, [branch.data]);
  if (branch.isLoading || missing) return <LoadingState label="Loading branch" />;
  if (branch.isError || !branch.data) return <ErrorState body={branch.error?.message ?? "Branch missing"} onRetry={() => void branch.refetch()} />;
  const branchRecord = branch.data;
  const logoSrc = mediaUrl(branchRecord.logo_url) ?? mediaUrl(parentBrand.data?.logo_url);
  const branchTitle = branchRecord.display_name || branchRecord.slug;

  const canSeePin = Boolean(me && PIN_ROLES.includes(me.role));
  const tabs = (Object.keys(TAB_LABELS) as BranchTab[]).filter((item) => item !== "pin" || canSeePin);
  return (
    <div className="grid gap-4">
      <Link
        href={branchRecord.brand_id ? `/app/brands/${branchRecord.brand_id}` : "/app/brands"}
        className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back
      </Link>
      <div className="flex items-center gap-3">
        {logoSrc ? (
          // Stored logos are on the API host, which next/image is not set up to optimise.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} alt={`${branchTitle} logo`} className="size-14 rounded-xl object-cover ring-1 ring-foreground/5" />
        ) : null}
        <h1 className="text-[length:var(--text-28)] font-semibold">{branchTitle}</h1>
      </div>
      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Branch settings">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={`min-h-11 shrink-0 rounded-full border px-3 text-sm ${tab === item ? "border-primary/40 bg-secondary font-medium" : ""}`}
            onClick={() => setTab(item)}
          >
            {TAB_LABELS[item]}
          </button>
        ))}
      </div>
      {tab === "profile" ? <ProfileTab branchId={branchId} currency={branchRecord.currency} address={branchRecord.address ?? ""} /> : null}
      {tab === "hours" ? <HoursTab branchId={branchId} hours={branchRecord.opening_hours} /> : null}
      {tab === "location" ? <LocationTab branch={branchRecord} /> : null}
      {tab === "financials" ? <FinancialsTab branchId={branchId} /> : null}
      {tab === "sla" ? <SlaTab branchId={branchId} /> : null}
      {tab === "pin" && canSeePin ? <PinTab branchId={branchId} /> : null}
      {tab === "tables" ? <TablesTab branchId={branchId} /> : null}
    </div>
  );
}

const WEEKDAYS = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
] as const;

type Weekday = (typeof WEEKDAYS)[number][0];

function HoursTab({ branchId, hours }: { branchId: string; hours: components["schemas"]["OpeningHours"] | null | undefined }) {
  const queryClient = useQueryClient();
  const [days, setDays] = useState(() => daysFromHours(hours));
  useEffect(() => {
    setDays(daysFromHours(hours));
  }, [hours]);
  const save = useMutation({
    mutationFn: async () => {
      const opening_hours: components["schemas"]["OpeningHours"] = {};
      for (const [key] of WEEKDAYS) {
        const day = days[key];
        if (day.closed) {
          opening_hours[key] = [];
          continue;
        }
        if (day.open === day.close) throw new Error(`${dayLabel(key)} needs a closing time that is different from the opening time.`);
        opening_hours[key] = [{ open: day.open, close: day.close }];
      }
      const result = await browserApi.PATCH("/api/v1/branches/{branch_id}", {
        params: { path: { branch_id: branchId } },
        body: { opening_hours },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not save operating hours");
    },
    onSuccess: () => {
      toast.success("Operating hours saved");
      void queryClient.invalidateQueries({ queryKey: ["branch", branchId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form className="grid max-w-xl gap-3" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <p className={hint}>When this branch is open. Brand and branch admins who check in are on time if they arrive by the opening time, plus a short grace period. A closing time earlier than the opening time means the branch stays open past midnight.</p>
      {WEEKDAYS.map(([key, label]) => {
        const day = days[key];
        return (
          <div key={key} className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end">
            <span className="text-sm font-medium">{label}</span>
            <label className="grid gap-1 text-sm">
              Opens
              <input className={control} type="time" value={day.open} disabled={day.closed} onChange={(event) => setDays((current) => ({ ...current, [key]: { ...current[key], open: event.target.value } }))} />
            </label>
            <label className="grid gap-1 text-sm">
              Closes
              <input className={control} type="time" value={day.close} disabled={day.closed} onChange={(event) => setDays((current) => ({ ...current, [key]: { ...current[key], close: event.target.value } }))} />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={day.closed} onChange={(event) => setDays((current) => ({ ...current, [key]: { ...current[key], closed: event.target.checked } }))} />
              Closed
            </label>
          </div>
        );
      })}
      <button className="min-h-11 w-fit rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50" type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save operating hours"}
      </button>
    </form>
  );
}

function dayLabel(key: Weekday): string {
  return WEEKDAYS.find(([day]) => day === key)?.[1] ?? key;
}

function daysFromHours(hours: components["schemas"]["OpeningHours"] | null | undefined): Record<Weekday, { open: string; close: string; closed: boolean }> {
  const next = {} as Record<Weekday, { open: string; close: string; closed: boolean }>;
  for (const [key] of WEEKDAYS) {
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
  const queryClient = useQueryClient();
  const [address, setAddress] = useState(savedAddress);
  const save = useMutation({
    mutationFn: async () => {
      const result = await browserApi.PATCH("/api/v1/branches/{branch_id}", {
        params: { path: { branch_id: branchId } },
        body: { address },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Update failed");
    },
    onSuccess: () => {
      toast.success("Profile saved");
      void queryClient.invalidateQueries({ queryKey: ["branch", branchId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form className="grid max-w-lg gap-2" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <p className={hint}>The address for this branch. Currency is {currency} and is not changed here.</p>
      <label className="grid gap-1 text-sm">
        Address
        <input className={control} placeholder="Address" value={address} onChange={(event) => setAddress(event.target.value)} />
      </label>
      <p id="save-profile-hint" className={hint}>Saves the address above.</p>
      <button className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground" type="submit" aria-describedby="save-profile-hint">Save profile</button>
    </form>
  );
}

function LocationTab({ branch }: { branch: components["schemas"]["BranchResponse"] }) {
  const queryClient = useQueryClient();
  const saved = branch.latitude != null && branch.longitude != null
    ? { latitude: Number(branch.latitude), longitude: Number(branch.longitude), address: branch.address ?? "" }
    : null;
  const [location, setLocation] = useState<PickedLocation | null>(saved);
  const [radius, setRadius] = useState(branch.geofence_radius_meters);
  const [pickerOpen, setPickerOpen] = useState(false);
  const save = useMutation({
    mutationFn: async () => {
      if (!location) throw new Error("Pick the branch location on the map");
      const body: components["schemas"]["UpdateBranchLocationRequest"] = {
        latitude: location.latitude,
        longitude: location.longitude,
        geofence_radius_meters: radius,
      };
      const result = await browserApi.PUT("/api/v1/branches/{branch_id}/location", {
        params: { path: { branch_id: branch.id } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Location failed");
      if (location.address && location.address !== branch.address) {
        const patched = await browserApi.PATCH("/api/v1/branches/{branch_id}", {
          params: { path: { branch_id: branch.id } },
          body: { address: location.address },
        });
        if (!patched.response.ok) throw asApiError(patched.error, patched.response, "Address failed");
      }
    },
    onSuccess: () => {
      toast.success("Location saved");
      void queryClient.invalidateQueries({ queryKey: ["branch", branch.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form className="grid max-w-lg gap-3" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <p className={hint}>Where this branch is, and how far a guest can be from it and still order at a table.</p>
      <p id="open-map-hint" className={hint}>Opens the map so you can drop a pin for this branch.</p>
      <button
        type="button"
        className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-start text-sm hover:border-primary/40"
        aria-describedby="open-map-hint"
        onClick={() => setPickerOpen(true)}
      >
        <MapPin aria-hidden className="size-4 shrink-0 text-primary" />
        {location ? (
          <span className="grid gap-0.5">
            <span className="line-clamp-2">{location.address || "Pinned location"}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{location.latitude}, {location.longitude}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">No location yet</span>
        )}
        <span className="ms-auto text-xs text-primary">Open map</span>
      </button>
      <label className="grid gap-1 text-sm">
        Geofence radius (m)
        <span className={hint}>How many metres from the pin a guest can be and still join a table.</span>
        <input className={control} type="number" min={5} max={5000} value={radius} onChange={(event) => setRadius(Number(event.target.value))} />
      </label>
      <p id="save-location-hint" className={hint}>Saves the pin and the geofence radius.</p>
      <button className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground disabled:opacity-50" type="submit" disabled={!location || save.isPending} aria-describedby="save-location-hint">Save location</button>
      <LocationPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} value={location} radiusMeters={radius} onConfirm={setLocation} />
    </form>
  );
}

function FinancialsTab({ branchId }: { branchId: string }) {
  const settings = useQuery({
    queryKey: ["fin", branchId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/financial-settings", { params: { path: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Settings failed");
      return result.data;
    },
  });
  if (settings.isLoading) return <LoadingState label="Loading settings" />;
  if (settings.isError || !settings.data) return <ErrorState body={settings.error?.message ?? "Settings missing"} onRetry={() => void settings.refetch()} />;
  return <FinancialsForm branchId={branchId} settings={settings.data} />;
}

function FinancialsForm({ branchId, settings }: { branchId: string; settings: components["schemas"]["BranchFinancialSettingsResponse"] }) {
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
      if (!result.response.ok) throw asApiError(result.error, result.response, "Save failed");
    },
    onSuccess: () => {
      toast.success("Financial settings saved");
      void queryClient.invalidateQueries({ queryKey: ["fin", branchId] });
      void queryClient.invalidateQueries({ queryKey: ["branch", branchId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form className="grid max-w-lg gap-2" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <p className={hint}>Tax and service fee for this branch. Enter a decimal: 0.14 means 14%.</p>
      <label className="grid gap-1 text-sm">
        Tax rate
        <span className={hint}>Current rate {settings.tax_rate}.</span>
        <input className={control} value={tax} onChange={(event) => setTax(event.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">
        Service fee rate
        <span className={hint}>Current rate {settings.service_fee_rate}.</span>
        <input className={control} value={fee} onChange={(event) => setFee(event.target.value)} />
      </label>
      <p id="save-financials-hint" className={hint}>Saves these rates. Menu prices are not changed here.</p>
      <button className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground" type="submit" aria-describedby="save-financials-hint">Save financial settings</button>
    </form>
  );
}

function SlaTab({ branchId }: { branchId: string }) {
  const sla = useQuery({
    queryKey: ["sla", branchId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/sla-config", { params: { path: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "SLA failed");
      return result.data;
    },
  });
  if (sla.isLoading) return <LoadingState label="Loading preparation target" />;
  if (sla.isError || !sla.data) return <ErrorState body={sla.error?.message ?? "Preparation target missing"} onRetry={() => void sla.refetch()} />;
  return <SlaForm branchId={branchId} minutes={sla.data.sla_prep_time_minutes} />;
}

function SlaForm({ branchId, minutes: savedMinutes }: { branchId: string; minutes: number }) {
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState(savedMinutes);
  const save = useMutation({
    mutationFn: async () => {
      const result = await browserApi.PATCH("/api/v1/branches/{branch_id}/sla-config", {
        params: { path: { branch_id: branchId } },
        body: { sla_prep_time_minutes: minutes },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "SLA save failed");
    },
    onSuccess: () => {
      toast.success("SLA saved");
      void queryClient.invalidateQueries({ queryKey: ["sla", branchId] });
      void queryClient.invalidateQueries({ queryKey: ["branch", branchId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form className="grid max-w-lg gap-2" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <p className={hint}>How long the kitchen should take to prepare an order. An order that takes longer is over this target.</p>
      <label className="grid gap-1 text-sm">
        Preparation target (minutes)
        <span className={hint}>Current target {savedMinutes} minutes. It must be greater than zero.</span>
        <input className={control} type="number" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
      </label>
      <p id="save-sla-hint" className={hint}>Saves the preparation target for this branch.</p>
      <button className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground" type="submit" aria-describedby="save-sla-hint">Save SLA</button>
    </form>
  );
}

function PinTab({ branchId }: { branchId: string }) {
  const [confirm, setConfirm] = useState(false);
  const pin = useQuery({
    queryKey: ["pin", branchId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/access-pin", { params: { path: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "PIN failed");
      return result.data;
    },
  });
  const rotate = useMutation({
    mutationFn: async () => {
      const result = await browserApi.POST("/api/v1/branches/{branch_id}/access-pin/rotate", { params: { path: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Rotate failed");
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
      <p className={hint}>Guests who are outside the restaurant enter this PIN to join a table. It refreshes on its own after 24 hours.</p>
      <p className="text-2xl font-semibold tracking-widest">{pin.data?.access_pin ?? "—"}</p>
      <p id="rotate-pin-hint" className={hint}>Issues a new PIN now. Printed QR cards still work, but the previous PIN stops.</p>
      <button
        type="button"
        className="inline-flex min-h-11 w-fit shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        aria-describedby="rotate-pin-hint"
        disabled={rotate.isPending}
        onClick={() => setConfirm(true)}
      >
        <RefreshCw aria-hidden className="size-4" />
        {rotate.isPending ? "Rotating…" : "Rotate PIN"}
      </button>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Rotate the table PIN?" description="Printed QR cards keep working, but the old PIN stops." confirmLabel="Rotate" destructive onConfirm={() => rotate.mutate()} />
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

function tableLabel(table: TableDetail): string {
  if (!table.is_active) return "Inactive";
  switch (table.status) {
    case "AVAILABLE":
      return "Available";
    case "BROWSING":
      return "Browsing";
    case "AWAITING_FOOD":
      return "Awaiting food";
    case "EATING":
      return "Eating";
    case "BILL_REQUESTED":
      return "Bill requested";
    case "NEEDS_CLEANING":
      return "Needs cleaning";
    default:
      return table.status;
  }
}

function seatLabel(capacity: number): string {
  return capacity === 1 ? "1 seat" : `${capacity} seats`;
}

function TablesTab({ branchId }: { branchId: string }) {
  const [number, setNumber] = useState("");
  const queryClient = useQueryClient();
  const tables = useQuery({
    queryKey: ["tables", branchId],
    retry: false,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/tables", { params: { path: { branch_id: branchId } } });
      if (result.response.status === 500) throw new ApiError(500, "Table list is unavailable.");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Tables failed");
      return result.data;
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["TableCreateRequest"] = { table_number: number, capacity: 4, zone_name: "Indoor" };
      const result = await browserApi.POST("/api/v1/branches/{branch_id}/tables", { params: { path: { branch_id: branchId } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not create table");
    },
    onSuccess: () => {
      toast.success("Table created");
      void queryClient.invalidateQueries({ queryKey: ["tables", branchId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="grid gap-3">
      <p className={hint}>Tables for this branch. A new table starts in the Indoor zone with 4 seats.</p>
      <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
        <label className="grid min-w-0 flex-1 gap-1 text-sm">
          Table number
          <input className={control} placeholder="Table number" value={number} onChange={(event) => setNumber(event.target.value)} required />
        </label>
        <button
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium whitespace-nowrap text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          type="submit"
          aria-describedby="add-table-hint"
          disabled={create.isPending}
        >
          <Plus aria-hidden className="size-4" />
          {create.isPending ? "Adding…" : "Add table"}
        </button>
      </form>
      <p id="add-table-hint" className={hint}>Creates a table with the number you enter.</p>
      {tables.isError ? (
        <ErrorState title="No table list" body={tables.error.message} onRetry={() => void tables.refetch()} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(tables.data ?? []).map((table) => (
            <li key={table.id} className="flex min-h-28 flex-col justify-between gap-3 rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg font-semibold">Table {table.table_number}</p>
                <StatusChip tone={tableTone(table)}>{tableLabel(table)}</StatusChip>
              </div>
              <p className="text-sm text-muted-foreground">{table.zone_name} · {seatLabel(table.capacity)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
