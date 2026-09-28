"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
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
import { ErrorState, LoadingState } from "@/components/ops/states";
import type { components } from "@/lib/api/schema";

const control = "h-11 w-full rounded-lg border px-3 text-sm";

const TAB_LABELS = {
  profile: "Profile",
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
  const missing = useDenyWhenMissing(branch.error);
  useEffect(() => {
    if (branch.data) {
      useScope.getState().focusPlatform({ brandId: branch.data.brand_id ?? null, branchId: branch.data.id });
    }
  }, [branch.data]);
  if (branch.isLoading || missing) return <LoadingState label="Loading branch" />;
  if (branch.isError || !branch.data) return <ErrorState body={branch.error?.message ?? "Branch missing"} onRetry={() => void branch.refetch()} />;
  const branchRecord = branch.data;

  const canSeePin = Boolean(me && PIN_ROLES.includes(me.role));
  const tabs = (Object.keys(TAB_LABELS) as BranchTab[]).filter((item) => item !== "pin" || canSeePin);
  return (
    <div className="grid gap-4">
      <h1 className="text-[length:var(--text-28)] font-semibold">{branchRecord.display_name || branchRecord.slug}</h1>
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
      {tab === "profile" ? <ProfileTab branchId={branchId} currency={branchRecord.currency} /> : null}
      {tab === "location" ? <LocationTab branch={branchRecord} /> : null}
      {tab === "financials" ? <FinancialsTab branchId={branchId} /> : null}
      {tab === "sla" ? <SlaTab branchId={branchId} /> : null}
      {tab === "pin" && canSeePin ? <PinTab branchId={branchId} /> : null}
      {tab === "tables" ? <TablesTab branchId={branchId} /> : null}
    </div>
  );
}

function ProfileTab({ branchId, currency }: { branchId: string; currency: string }) {
  const [address, setAddress] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const result = await browserApi.PATCH("/api/v1/branches/{branch_id}", {
        params: { path: { branch_id: branchId } },
        body: { address },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Update failed");
    },
    onSuccess: () => toast.success("Profile saved"),
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form className="grid max-w-lg gap-2" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <p className="text-sm text-muted-foreground">Currency {currency}</p>
      <input className={control} placeholder="Address" value={address} onChange={(event) => setAddress(event.target.value)} />
      <button className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground" type="submit">Save profile</button>
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
      <button
        type="button"
        className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-start text-sm hover:border-primary/40"
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
        <input className={control} type="number" min={5} max={5000} value={radius} onChange={(event) => setRadius(Number(event.target.value))} />
      </label>
      <button className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground disabled:opacity-50" type="submit" disabled={!location || save.isPending}>Save location</button>
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
  const [tax, setTax] = useState("0.14");
  const [fee, setFee] = useState("0.00");
  const save = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["UpdateBranchFinancialSettingsRequest"] = {
        tax_rate: tax,
        service_fee_rate: fee,
        is_service_taxable: false,
        is_tax_inclusive: false,
        service_fee_dine_in_only: true,
      };
      const result = await browserApi.PUT("/api/v1/branches/{branch_id}/financial-settings", {
        params: { path: { branch_id: branchId } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Save failed");
    },
    onSuccess: () => toast.success("Financial settings saved"),
    onError: (error: Error) => toast.error(error.message),
  });
  if (settings.isLoading) return <LoadingState label="Loading settings" />;
  return (
    <form className="grid max-w-lg gap-2" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <p className="text-sm">Current tax {settings.data?.tax_rate}</p>
      <input className={control} value={tax} onChange={(event) => setTax(event.target.value)} />
      <input className={control} value={fee} onChange={(event) => setFee(event.target.value)} />
      <button className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground" type="submit">Save financial settings</button>
    </form>
  );
}

function SlaTab({ branchId }: { branchId: string }) {
  const [minutes, setMinutes] = useState(20);
  const sla = useQuery({
    queryKey: ["sla", branchId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/sla-config", { params: { path: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "SLA failed");
      return result.data;
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const result = await browserApi.PATCH("/api/v1/branches/{branch_id}/sla-config", {
        params: { path: { branch_id: branchId } },
        body: { sla_prep_time_minutes: minutes },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "SLA save failed");
    },
    onSuccess: () => toast.success("SLA saved"),
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form className="grid max-w-lg gap-2" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <p className="text-sm">Current {sla.data?.sla_prep_time_minutes ?? "—"} minutes</p>
      <input className={control} type="number" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
      <button className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground" type="submit">Save SLA</button>
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
    <div className="grid gap-2">
      <p className="text-2xl font-semibold tracking-widest">{pin.data?.access_pin ?? "—"}</p>
      <button type="button" className="min-h-11 w-fit rounded-lg border px-4 text-sm" onClick={() => setConfirm(true)}>Rotate PIN</button>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Rotate the table PIN?" description="Printed QR cards keep working, but the old PIN stops." confirmLabel="Rotate" destructive onConfirm={() => rotate.mutate()} />
    </div>
  );
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
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
        <input className={control} placeholder="Table number" value={number} onChange={(event) => setNumber(event.target.value)} required />
        <button className="min-h-11 rounded-lg bg-primary px-4 text-sm text-primary-foreground" type="submit">Add table</button>
      </form>
      {tables.isError ? (
        <ErrorState title="No table list" body={tables.error.message} onRetry={() => void tables.refetch()} />
      ) : (
        <ul className="grid gap-2">
          {(tables.data ?? []).map((table) => (
            <li key={table.id} className="rounded-lg border p-3 text-sm">{table.table_number}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
