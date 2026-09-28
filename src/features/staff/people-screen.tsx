"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { ErrorState, LoadingState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useScope } from "@/stores/scope";

const control = "h-11 w-full rounded-lg border px-3 text-sm";
const ROLES: components["schemas"]["UserRole"][] = ["CASHIER", "WAITER", "KITCHEN_STAFF", "RUNNER", "BRANCH_ADMIN"];

export function StaffScreen() {
  const branchId = useScope((state) => state.branchId);
  const brandId = useScope((state) => state.brandId);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<components["schemas"]["UserRole"]>("CASHIER");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const staff = useQuery({
    queryKey: ["staff", branchId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/staff", { params: { path: { branch_id: branchId ?? "" } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Staff failed");
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
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not add staff");
    },
    onSuccess: () => {
      toast.success("Staff added");
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: async (staffId: string) => {
      const result = await browserApi.DELETE("/api/v1/staff/{staff_id}", { params: { path: { staff_id: staffId } } });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not deactivate");
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
      if (!result.response.ok) throw asApiError(result.error, result.response, "Update failed");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["staff"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (!branchId) return null;
  if (staff.isLoading) return <LoadingState label="Loading staff" />;
  if (staff.isError || !staff.data) return <ErrorState body={staff.error?.message ?? "Staff missing"} onRetry={() => void staff.refetch()} />;

  return (
    <div className="grid gap-4">
      <h1 className="text-[length:var(--text-28)] font-semibold">Staff</h1>
      <form className="grid gap-2 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
        <input className={control} placeholder="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        <input className={control} type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <input className={control} type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <select className={control} value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
          {ROLES.map((item) => <option key={item}>{item}</option>)}
        </select>
        <button className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground" type="submit">Add staff</button>
      </form>
      <ul className="grid gap-2">
        {staff.data.map((person) => (
          <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
            <div>
              <p className="font-medium">{person.full_name}</p>
              <p className="text-sm text-muted-foreground">{person.role}</p>
            </div>
            <button type="button" className="min-h-11 text-sm underline" onClick={() => rename.mutate({ id: person.id, full_name: `${person.full_name}` })}>Save name</button>
            <button type="button" className="min-h-11 text-sm text-destructive" onClick={() => setRemoveId(person.id)}>Deactivate</button>
          </li>
        ))}
      </ul>
      <ConfirmDialog open={Boolean(removeId)} onOpenChange={(open) => !open && setRemoveId(null)} title="Deactivate this person?" description="They will no longer be able to sign in." confirmLabel="Deactivate" destructive onConfirm={() => removeId && remove.mutate(removeId)} />
    </div>
  );
}

export function FeaturesScreen() {
  const brandId = useScope((state) => state.brandId);
  const queryClient = useQueryClient();
  const [key, setKey] = useState("");
  const [nameEn, setNameEn] = useState("");
  const platform = useQuery({
    queryKey: ["features-platform"],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/features/platform");
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Features failed");
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
      const body: components["schemas"]["PlatformFeatureCreate"] = {
        id: key,
        name_en: nameEn,
        name_ar: nameEn,
        category: "OPS",
        is_core: false,
        is_premium: false,
        default_enabled: false,
      };
      const result = await browserApi.POST("/api/v1/features/platform", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not add feature");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["features-platform"] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const toggle = useMutation({
    mutationFn: async (featureKey: string) => {
      const result = await browserApi.PUT("/api/v1/features/brand/{brand_id}/{feature_key}", {
        params: { path: { brand_id: brandId ?? "", feature_key: featureKey } },
        body: { is_enabled_by_super_admin: true },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Entitlement failed");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["features-brand"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid gap-4">
      <h1 className="text-[length:var(--text-28)] font-semibold">Features</h1>
      <form className="grid gap-2 sm:grid-cols-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
        <input className={control} placeholder="Feature key" value={key} onChange={(event) => setKey(event.target.value)} required />
        <input className={control} placeholder="English name" value={nameEn} onChange={(event) => setNameEn(event.target.value)} required />
        <button className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground" type="submit">Add platform feature</button>
      </form>
      {platform.isLoading ? <LoadingState label="Loading features" /> : null}
      {platform.isError ? <ErrorState body={platform.error.message} onRetry={() => void platform.refetch()} /> : null}
      <ul className="grid gap-2">
        {(platform.data ?? []).map((feature) => (
          <li key={feature.id} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
            <span>{feature.name_en}</span>
            <button type="button" className="min-h-11 underline" onClick={() => toggle.mutate(feature.id)}>Enable for brand</button>
          </li>
        ))}
      </ul>
      <h2 className="font-medium">Brand entitlements</h2>
      <ul className="grid gap-2">
        {(brand.data ?? []).map((item) => (
          <li key={item.id} className="rounded-lg border p-3 text-sm">{item.feature_key} · {item.is_enabled_by_super_admin ? "on" : "off"}</li>
        ))}
      </ul>
    </div>
  );
}

export function DeliveryScreen() {
  const branchId = useScope((state) => state.branchId);
  const brandId = useScope((state) => state.brandId);
  const queryClient = useQueryClient();
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [govId, setGovId] = useState("");
  const [fee, setFee] = useState("25.00");
  const govs = useQuery({
    queryKey: ["delivery-govs", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/delivery/governorates");
      if (result.response.status === 404) return [];
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Governorates failed");
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
    mutationFn: async () => {
      const body: components["schemas"]["DeliveryGovernorateCreate"] = { name_en: nameEn, name_ar: nameAr, brand_id: brandId, is_active: true };
      const result = await browserApi.POST("/api/v1/delivery/governorates", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not create governorate");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["delivery-govs"] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const createZone = useMutation({
    mutationFn: async () => {
      const body: components["schemas"]["DeliveryZoneCreate"] = { name_en: nameEn, name_ar: nameAr, governorate_id: govId, is_active: true };
      const result = await browserApi.POST("/api/v1/delivery/governorates/{governorate_id}/zones", { params: { path: { governorate_id: govId } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not create zone");
    },
    onSuccess: () => void zones.refetch(),
    onError: (error: Error) => toast.error(error.message),
  });
  const setBranchFee = useMutation({
    mutationFn: async () => {
      if (!branchId) throw new Error("Choose a branch");
      const body: components["schemas"]["BranchDeliveryFeeCreate"] = {
        branch_id: branchId,
        governorate_id: govId,
        delivery_fee: fee,
        estimated_time_minutes: 45,
        min_order_amount: "0.00",
      };
      const result = await browserApi.POST("/api/v1/delivery/fees", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Fee failed");
    },
    onSuccess: () => toast.success("Fee saved"),
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="grid gap-4">
      <h1 className="text-[length:var(--text-28)] font-semibold">Delivery</h1>
      {!brandId ? <p className="text-sm">Choose a brand first. Delivery belongs to the brand, and a branch with no brand cannot load it.</p> : null}
      {govs.isError ? <ErrorState body={govs.error.message} onRetry={() => void govs.refetch()} /> : null}
      <form className="grid gap-2 sm:grid-cols-3" onSubmit={(event) => { event.preventDefault(); createGov.mutate(); }}>
        <input className={control} placeholder="English" value={nameEn} onChange={(event) => setNameEn(event.target.value)} />
        <input className={control} placeholder="Arabic" value={nameAr} onChange={(event) => setNameAr(event.target.value)} />
        <button className="min-h-11 rounded-lg bg-primary text-sm text-primary-foreground" type="submit">Add governorate</button>
      </form>
      <select className={control} value={govId} onChange={(event) => setGovId(event.target.value)}>
        <option value="">Governorate</option>
        {(govs.data ?? []).map((gov) => <option key={gov.id} value={gov.id}>{gov.name_en}</option>)}
      </select>
      <button type="button" className="min-h-11 w-fit rounded-lg border px-4 text-sm" onClick={() => createZone.mutate()}>Add zone with the names above</button>
      <ul className="grid gap-2">
        {(zones.data ?? []).map((zone) => <li key={zone.id} className="rounded-lg border p-3 text-sm">{zone.name_en}</li>)}
      </ul>
      <div className="flex gap-2">
        <input className={control} value={fee} onChange={(event) => setFee(event.target.value)} />
        <button type="button" className="min-h-11 rounded-lg bg-primary px-4 text-sm text-primary-foreground" onClick={() => setBranchFee.mutate()}>Set fee</button>
      </div>
    </div>
  );
}
