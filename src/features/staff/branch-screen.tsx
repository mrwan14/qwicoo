"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { ApiError, asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { ErrorState, LoadingState } from "@/components/ops/states";
import type { components } from "@/lib/api/schema";

const control = "h-11 w-full rounded-lg border px-3 text-sm";

export function BranchScreen({ branchId }: { branchId: string }) {
  const [tab, setTab] = useState<"profile" | "location" | "financials" | "sla" | "pin" | "tables">("profile");
  const branch = useQuery({
    queryKey: ["branch", branchId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}", { params: { path: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Branch failed");
      return result.data;
    },
  });
  if (branch.isLoading) return <LoadingState label="Loading branch" />;
  if (branch.isError || !branch.data) return <ErrorState body={branch.error?.message ?? "Branch missing"} onRetry={() => void branch.refetch()} />;
  const branchRecord = branch.data;

  const tabs = ["profile", "location", "financials", "sla", "pin", "tables"] as const;
  return (
    <div className="grid gap-4">
      <h1 className="text-[length:var(--text-28)] font-semibold">{branchRecord.display_name || branchRecord.slug}</h1>
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((item) => (
          <button key={item} type="button" className="min-h-11 shrink-0 rounded-full border px-3 text-sm capitalize" onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>
      {tab === "profile" ? <ProfileTab branchId={branchId} currency={branchRecord.currency} /> : null}
      {tab === "location" ? <LocationTab branchId={branchId} /> : null}
      {tab === "financials" ? <FinancialsTab branchId={branchId} /> : null}
      {tab === "sla" ? <SlaTab branchId={branchId} /> : null}
      {tab === "pin" ? <PinTab branchId={branchId} /> : null}
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

function LocationTab({ branchId }: { branchId: string }) {
  const [latitude, setLatitude] = useState("30.0444");
  const [longitude, setLongitude] = useState("31.2357");
  const [radius, setRadius] = useState(150);
  const save = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["UpdateBranchLocationRequest"] = {
        latitude,
        longitude,
        geofence_radius_meters: radius,
      };
      const result = await browserApi.PUT("/api/v1/branches/{branch_id}/location", {
        params: { path: { branch_id: branchId } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Location failed");
    },
    onSuccess: () => toast.success("Location saved"),
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form className="grid max-w-lg gap-2" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <input className={control} value={latitude} onChange={(event) => setLatitude(event.target.value)} />
      <input className={control} value={longitude} onChange={(event) => setLongitude(event.target.value)} />
      <input className={control} type="number" value={radius} onChange={(event) => setRadius(Number(event.target.value))} />
      <button className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground" type="submit">Save location</button>
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
