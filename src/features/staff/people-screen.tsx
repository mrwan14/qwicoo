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
import { pickLocale } from "@/lib/i18n/locale-text";
import { areaNames, boundsForGovernorate, loadEgyptGovernorates, searchEgyptAreas, type EgyptAreaSuggestion } from "@/lib/maps/egypt";
import { useScope } from "@/stores/scope";

const control = "h-11 w-full rounded-lg border px-3 text-sm";
const hint = "text-sm leading-6 text-muted-foreground";
const sectionCard = "grid max-w-3xl gap-4 rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5";
const primaryButton = "inline-flex min-h-11 w-fit shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";
const secondaryButton = "inline-flex min-h-11 w-fit shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";
const ROLES = ["CASHIER", "WAITER", "KITCHEN_STAFF", "RUNNER", "BRANCH_ADMIN"] as const;
const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  CASHIER: "Cashier",
  WAITER: "Waiter",
  KITCHEN_STAFF: "Kitchen",
  RUNNER: "Runner",
  BRANCH_ADMIN: "Branch admin",
};
const ROLE_HINTS: Record<(typeof ROLES)[number], string> = {
  CASHIER: "Takes payment at the till.",
  WAITER: "Serves tables and takes orders.",
  KITCHEN_STAFF: "Sees tickets on the kitchen display.",
  RUNNER: "Brings ready food to the table.",
  BRANCH_ADMIN: "Manages this branch.",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role as (typeof ROLES)[number]] ?? role;
}

function clock(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "";
}

export function StaffScreen() {
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
    onSuccess: () => {
      toast.success("Name saved");
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!branchId) return null;
  if (staff.isLoading) return <LoadingState label="Loading staff" />;
  if (staff.isError || !staff.data) return <ErrorState body={staff.error?.message ?? "Staff missing"} onRetry={() => void staff.refetch()} />;

  const people = staff.data;
  const staffSearch = staffQuery.trim().toLowerCase();
  const visiblePeople = staffSearch
    ? people.filter((person) =>
        [person.full_name, person.email, roleLabel(person.role)].join(" ").toLowerCase().includes(staffSearch),
      )
    : people;
  const personToRemove = people.find((person) => person.id === removeId);

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-[length:var(--text-28)] font-semibold">Staff</h1>
        <p className={`mt-1 max-w-2xl ${hint}`}>People who can sign in at this branch. Each person has one role.</p>
      </header>

      <form className={sectionCard} onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
        <div>
          <h2 className="text-lg font-semibold">Add a person</h2>
          <p className={hint}>They sign in with the email and password. The shift is 10:00 to 18:00.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Full name
            <span className={hint}>The name other staff see.</span>
            <input className={control} value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </label>
          <label className="grid gap-1 text-sm">
            Email
            <span className={hint}>They use this to sign in.</span>
            <input className={control} type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="grid gap-1 text-sm">
            Password
            <span className={hint}>They use this the first time they sign in.</span>
            <input className={control} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <label className="grid gap-1 text-sm">
            Role
            <span className={hint}>{ROLE_HINTS[role]}</span>
            <select className={control} value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
              {ROLES.map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}
            </select>
          </label>
        </div>
        <button className={primaryButton} type="submit" disabled={create.isPending}>
          <Plus aria-hidden className="size-4" />
          {create.isPending ? "Adding…" : "Add staff"}
        </button>
      </form>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">People at this branch</h2>
            <p className={hint}>{people.length === 1 ? "1 person" : `${people.length} people`}</p>
          </div>
          <label className="grid w-full max-w-xs gap-1 text-sm">
            Search
            <input className={control} value={staffQuery} onChange={(event) => setStaffQuery(event.target.value)} placeholder="Name, email, or role" />
          </label>
        </div>
        {people.length === 0 ? <EmptyState title="No staff yet" body="Add a person above. They can then sign in at this branch." /> : null}
        {people.length > 0 && visiblePeople.length === 0 ? <EmptyState title="No people match" body="Try another name, email, or role." /> : null}
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
        title="Deactivate this person?"
        description={personToRemove ? `${personToRemove.full_name} will no longer be able to sign in.` : "They will no longer be able to sign in."}
        confirmLabel="Deactivate"
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
        <StatusChip tone={person.is_active ? "available" : "soldout"}>{person.is_active ? "Active" : "Inactive"}</StatusChip>
      </div>
      <p className="text-sm">{roleLabel(person.role)}{shift ? ` · ${shift}` : ""}</p>
      {editing ? (
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (edited) onRename(name.trim());
          }}
        >
          <label className="grid gap-1 text-sm">
            Full name
            <input className={control} value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <div className="flex flex-wrap gap-2">
            {edited ? (
              <button className={primaryButton} type="submit" disabled={saving}>{saving ? "Saving…" : "Save name"}</button>
            ) : null}
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                setName(person.full_name);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryButton} onClick={() => { setName(person.full_name); setEditing(true); }}>
            Change name
          </button>
          {person.is_active ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-xl border border-destructive/30 px-4 text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              onClick={onDeactivate}
            >
              Deactivate
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
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Brands failed");
      return result.data.items;
    },
  });
  const brandBranches = useQuery({
    queryKey: ["brand-branches", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands/{brand_id}/branches", { params: { path: { brand_id: brandId ?? "" } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Branches failed");
      return result.data;
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
    mutationFn: async (place: { nameEn: string; nameAr: string }) => {
      const body: components["schemas"]["DeliveryGovernorateCreate"] = { name_en: place.nameEn, name_ar: place.nameAr, brand_id: brandId, is_active: true };
      const result = await browserApi.POST("/api/v1/delivery/governorates", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not create governorate");
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
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not create zone");
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
      if (!chosenBranch) throw new Error("Choose a branch");
      if (!govId) throw new Error("Choose a governorate");
      const body: components["schemas"]["BranchDeliveryFeeCreate"] = {
        branch_id: chosenBranch,
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
  const branchLabel = selectedBranch ? pickLocale(selectedBranch.name) || selectedBranch.slug : null;
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

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-[length:var(--text-28)] font-semibold">Delivery</h1>
        <p className={`mt-1 max-w-2xl ${hint}`}>
          Where {brandName ?? "this brand"} delivers, and what a branch charges. Guests choose a governorate, then a zone, when they order.
        </p>
      </header>

      <section className="grid max-w-3xl gap-3">
        <div>
          <h2 className="text-lg font-semibold">Brand</h2>
          <p className={hint}>Governorates belong to the brand. Choose it before adding areas or a fee.</p>
        </div>
        <label className="grid gap-1 text-sm">
          Brand
          <select
            className={control}
            value={brandId ?? ""}
            onChange={(event) => {
              const next = event.target.value || null;
              if (next !== brandId) chooseSavedGovernorate("");
              focusPlatform({ brandId: next, branchId: next === brandId ? branchId : null });
            }}
          >
            <option value="">{brands.isFetching ? "Loading brands…" : "Choose a brand"}</option>
            {(brands.data ?? []).map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </select>
        </label>
        {brands.isError ? <p className="text-sm text-destructive">{brands.error.message}</p> : null}
      </section>

      <section className={sectionCard}>
        <div>
          <h2 className="text-lg font-semibold">Governorates</h2>
          <p className={hint}>A governorate is a region guests can choose, such as Cairo. The list is Egypt’s governorates from Google Maps, in English and Arabic.</p>
        </div>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (draftGov) createGov.mutate(draftGov);
          }}
        >
          <label className="grid gap-1 text-sm">
            Governorate
            <span className={hint}>Choose one. The Arabic name is saved with it.</span>
            <select
              className={control}
              value={draftGovId}
              disabled={!brandId || egypt.isLoading}
              onChange={(event) => setDraftGovId(event.target.value)}
            >
              <option value="">
                {egypt.isLoading ? "Loading governorates from Google Maps…" : egypt.isError ? "Governorates unavailable" : "Choose a governorate"}
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
            {createGov.isPending ? "Adding…" : "Add governorate"}
          </button>
          <p id="add-governorate-hint" className={hint}>
            {governorateAlreadyAdded
              ? `${draftGov?.nameEn ?? "This governorate"} is already on ${brandName ?? "this brand"}.`
              : draftGov
                ? `Adds ${draftGov.nameEn} to ${brandName ?? "the chosen brand"}.`
                : `Adds the chosen governorate to ${brandName ?? "the chosen brand"}.`}
          </p>
        </form>
        {govs.isLoading ? <LoadingState label="Loading governorates" /> : null}
        {govs.isError ? <ErrorState body={govs.error.message} onRetry={() => void govs.refetch()} /> : null}
        {brandId && govs.isSuccess && governorates.length === 0 ? (
          <EmptyState title="No governorates yet" body="Add one above. Guests cannot choose a delivery area until a governorate exists." />
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
          <h2 className="text-lg font-semibold">Zones</h2>
          <p className={hint}>A zone is an area inside the governorate, such as a district or city. Pick it from Google Maps. The English and Arabic names are saved together.</p>
        </div>
        <label className="grid gap-1 text-sm">
          Governorate
          <span className={hint}>Areas are limited to this governorate.</span>
          <select className={control} value={govId} onChange={(event) => chooseSavedGovernorate(event.target.value)} disabled={!brandId}>
            <option value="">{governorates.length === 0 ? "Add a governorate first" : "Choose a governorate"}</option>
            {governorates.map((gov) => <option key={gov.id} value={gov.id}>{gov.name_en}</option>)}
          </select>
        </label>
        <div className="grid gap-1 text-sm">
          <label className="grid gap-1" htmlFor="delivery-area">
            Area
            <span className={hint}>{selectedGov ? `Districts and cities in ${selectedGov.name_en}.` : "Choose a governorate first."}</span>
            <input
              id="delivery-area"
              className={control}
              role="combobox"
              aria-expanded={areaOptions.length > 0}
              aria-controls="delivery-area-list"
              aria-autocomplete="list"
              placeholder={selectedGov ? "Type an area, then choose it" : "Choose a governorate first"}
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
          {areaSearching ? <p className={hint}>Searching Google Maps…</p> : null}
          {areaMiss && !areaSearching && areaQuery.trim().length >= 2 ? <p className={hint}>No areas match that. Try a district or city name.</p> : null}
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
          {createZone.isPending ? "Adding…" : "Add zone"}
        </button>
        <p id="add-zone-hint" className={hint}>
          {selectedGov && areaPick
            ? `Adds ${areaPick.nameEn} inside ${selectedGov.name_en}.`
            : "Choose a governorate, type an area, and pick it from the list."}
        </p>
        {govId && zones.isSuccess && zoneItems.length === 0 ? (
          <EmptyState title="No zones in this governorate" body="Guests can still choose the governorate. A zone lets them pick a smaller area." />
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
          <h2 className="text-lg font-semibold">Delivery fee</h2>
          <p className={hint}>
            What guests pay, in EGP, to have an order delivered from one branch to the governorate you chose. Saving also sets a 45 minute estimate and no minimum order.
          </p>
        </div>
        <label className="grid gap-1 text-sm">
          Branch
          <span className={hint}>The fee is saved for this branch only.</span>
          <select
            className={control}
            value={branchLabel ? branchId ?? "" : ""}
            disabled={!brandId || brandBranches.isLoading}
            onChange={(event) => focusPlatform({ brandId, branchId: event.target.value || null })}
          >
            <option value="">{brandBranches.isFetching ? "Loading branches…" : "Choose a branch"}</option>
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>{pickLocale(branch.name) || branch.slug}</option>
            ))}
          </select>
        </label>
        {brandBranches.isError ? <p className="text-sm text-destructive">{brandBranches.error.message}</p> : null}
        <label className="grid max-w-xs gap-1 text-sm">
          Fee (EGP)
          <input className={control} inputMode="decimal" value={fee} onChange={(event) => setFee(event.target.value)} />
        </label>
        <button
          type="button"
          className={primaryButton}
          disabled={!branchLabel || !govId || setBranchFee.isPending}
          aria-describedby="set-fee-hint"
          onClick={() => setBranchFee.mutate()}
        >
          {setBranchFee.isPending ? "Saving…" : "Set fee"}
        </button>
        <p id="set-fee-hint" className={hint}>
          {branchLabel && selectedGov
            ? `Saves ${fee || "0.00"} EGP for ${branchLabel} delivering to ${selectedGov.name_en}.`
            : "Choose a branch and a governorate before saving the fee."}
        </p>
      </section>
    </div>
  );
}
