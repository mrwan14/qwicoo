"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { StatusChip } from "@/components/ops/status-chip";
import { EmptyState, ErrorState, LoadingState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useScope } from "@/stores/scope";

const control = "h-11 w-full rounded-lg border px-3 text-sm";
const hint = "text-sm leading-6 text-muted-foreground";
const primaryButton = "inline-flex min-h-11 w-fit shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";
const secondaryButton = "inline-flex min-h-11 w-fit shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";
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

function normaliseFeatureKey(raw: string): string | null {
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return /^[A-Z0-9_]{2,50}$/.test(key) ? key : null;
}

export function FeaturesScreen() {
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
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Brands failed");
      return result.data.items;
    },
  });
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
      const id = normaliseFeatureKey(key);
      if (!id) throw new Error("Use at least two letters or numbers, such as DRIVE_THRU.");
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
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not add feature");
    },
    onSuccess: () => {
      toast.success("Feature added");
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
      if (!result.response.ok) throw asApiError(result.error, result.response, input.enabled ? "Could not enable feature" : "Could not disable feature");
    },
    onSuccess: (_data, input) => {
      toast.success(input.enabled ? "Feature enabled for this brand" : "Feature disabled for this brand");
      void queryClient.invalidateQueries({ queryKey: ["features-brand"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: async (featureKey: string) => {
      const result = await browserApi.DELETE("/api/v1/features/platform/{feature_key}", {
        params: { path: { feature_key: featureKey } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not delete feature");
    },
    onSuccess: () => {
      toast.success("Feature deleted");
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
        <h1 className="text-[length:var(--text-28)] font-semibold">Features</h1>
        <p className={`mt-1 max-w-2xl ${hint}`}>Platform features Qwicoo can offer. A feature stays off until you enable it for the brand you have open.</p>
      </header>

      <form className="grid max-w-3xl gap-4 rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
        <div>
          <h2 className="text-lg font-semibold">Add a platform feature</h2>
          <p className={hint}>Creates a feature for the whole platform. It is not turned on for a brand yet.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Feature key
            <span className={hint}>Letters and numbers. Drive-thru is saved as DRIVE_THRU.</span>
            <input className={control} value={key} onChange={(event) => setKey(event.target.value)} required />
          </label>
          <label className="grid gap-1 text-sm">
            English name
            <span className={hint}>The name staff see, such as Drive-thru.</span>
            <input className={control} value={nameEn} onChange={(event) => setNameEn(event.target.value)} required />
          </label>
        </div>
        <button className={primaryButton} type="submit" disabled={create.isPending} aria-describedby="add-feature-hint">
          <Plus aria-hidden className="size-4" />
          {create.isPending ? "Adding…" : "Add platform feature"}
        </button>
        <p id="add-feature-hint" className={hint}>Adds the feature to the platform list below.</p>
      </form>

      <section className="grid max-w-3xl gap-3">
        <div>
          <h2 className="text-lg font-semibold">Brand</h2>
          <p className={hint}>Choose the brand before enabling or disabling a feature.</p>
        </div>
        <label className="grid gap-1 text-sm">
          Brand
          <select
            className={control}
            value={brandId ?? ""}
            onChange={(event) => {
              const next = event.target.value || null;
              focusPlatform({ brandId: next, branchId: next === brandId ? branchId : null });
            }}
          >
            <option value="">{brands.isFetching ? "Loading brands…" : "Choose a brand"}</option>
            {(brands.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        {brands.isError ? <p className="text-sm text-destructive">{brands.error.message}</p> : null}
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="text-lg font-semibold">Platform features</h2>
          <p className={hint}>{brandName ? `Enable or disable a feature for ${brandName}.` : "Choose a brand above before changing a feature."}</p>
        </div>
        {platform.isLoading ? <LoadingState label="Loading features" /> : null}
        {platform.isError ? <ErrorState body={platform.error.message} onRetry={() => void platform.refetch()} /> : null}
        {platform.isSuccess && features.length === 0 ? (
          <EmptyState title="No platform features yet" body="Add a feature above. It can then be enabled for a brand." />
        ) : null}
        {features.length > 0 ? (
          <ul className="grid gap-3">
            {features.map((feature) => {
              const enabled = enabledKeys.has(feature.id);
              const pending = pendingToggle?.featureKey === feature.id;
              return (
                <li key={feature.id} className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="grid gap-1">
                    <p className="font-semibold">{feature.name_en}</p>
                    <p className="text-sm text-muted-foreground">{feature.id}</p>
                    {feature.description ? <p className={hint}>{feature.description}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip tone={enabled ? "available" : "neutral"}>{enabled ? "Enabled" : "Off"}</StatusChip>
                    <button
                      type="button"
                      className={enabled ? secondaryButton : primaryButton}
                      disabled={!brandId || toggle.isPending}
                      onClick={() => toggle.mutate({ featureKey: feature.id, enabled: !enabled })}
                    >
                      {pending ? (enabled ? "Disabling…" : "Enabling…") : enabled ? `Disable for ${brandName ?? "brand"}` : `Enable for ${brandName ?? "brand"}`}
                    </button>
                    {feature.is_core ? (
                      <span className="text-sm text-muted-foreground">Core feature</span>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center rounded-xl border border-destructive/30 px-4 text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                        disabled={remove.isPending}
                        onClick={() => setRemoveKey(feature.id)}
                      >
                        Delete
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
          title="Delete this feature?"
          description="It is removed from the platform, and brands can no longer turn it on."
          confirmLabel="Delete"
          destructive
          onConfirm={() => removeKey && remove.mutate(removeKey)}
        />
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="text-lg font-semibold">Brand entitlements</h2>
          <p className={hint}>{brandName ? `Features turned on or off for ${brandName}.` : "Choose a brand above to see its features."}</p>
        </div>
        {!brandId ? (
          <EmptyState title="No brand chosen" body="Choose a brand above to see which features are on." />
        ) : null}
        {brandId && brand.isSuccess && entitlements.length === 0 ? (
          <EmptyState title="No features for this brand yet" body="Enable a platform feature above and it will show up here." />
        ) : null}
        {entitlements.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {entitlements.map((item) => {
              const name = features.find((feature) => feature.id === item.feature_key)?.name_en;
              return (
                <li key={item.id} className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <p className="font-semibold">{name ?? item.feature_key}</p>
                      {name ? <p className="text-sm text-muted-foreground">{item.feature_key}</p> : null}
                    </div>
                    <StatusChip tone={item.is_enabled_by_super_admin ? "available" : "soldout"}>{item.is_enabled_by_super_admin ? "On" : "Off"}</StatusChip>
                  </div>
                  <button
                    type="button"
                    className={item.is_enabled_by_super_admin ? secondaryButton : primaryButton}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ featureKey: item.feature_key, enabled: !item.is_enabled_by_super_admin })}
                  >
                    {pendingToggle?.featureKey === item.feature_key
                      ? item.is_enabled_by_super_admin
                        ? "Disabling…"
                        : "Enabling…"
                      : item.is_enabled_by_super_admin
                        ? `Disable for ${brandName ?? "brand"}`
                        : `Enable for ${brandName ?? "brand"}`}
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
  const branchId = useScope((state) => state.branchId);
  const brandId = useScope((state) => state.brandId);
  const focusPlatform = useScope((state) => state.focusPlatform);
  const queryClient = useQueryClient();
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [govId, setGovId] = useState("");
  const [fee, setFee] = useState("25.00");
  const brands = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands", { params: { query: { limit: 100 } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Brands failed");
      return result.data.items;
    },
  });
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
      <label className="grid max-w-lg gap-1 text-sm">
        Brand
        <select
          className={control}
          value={brandId ?? ""}
          onChange={(event) => focusPlatform({ brandId: event.target.value || null, branchId })}
        >
          <option value="">Select a brand</option>
          {(brands.data ?? []).map((brand) => (
            <option key={brand.id} value={brand.id}>{brand.name}</option>
          ))}
        </select>
      </label>
      {brands.isError ? <p className="text-sm text-destructive">{brands.error.message}</p> : null}
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
