"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImagePlus, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { EntityCard } from "@/components/ops/entity-card";
import { pickLocale } from "@/lib/i18n/locale-text";
import { LocationPickerDialog, type PickedLocation } from "@/components/ops/location-picker";
import { PageHeader } from "@/components/ops/page-header";
import { StatusChip } from "@/components/ops/status-chip";
import { EmptyState, ErrorState, LoadingState } from "@/components/ops/states";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useDenyWhenMissing } from "@/lib/auth/session-client";
import { useScope } from "@/stores/scope";

const control = "h-11 w-full rounded-lg border px-3 text-sm";

export function BrandsScreen() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const brands = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands", { params: { query: { limit: 100 } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Brands failed");
      return result.data.items;
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      const body: Omit<components["schemas"]["BrandCreate"], "slug"> = { name, is_active: true };
      // The API derives the slug from the name. Drop the cast once `npm run gen:api`
      // picks up the schema where `slug` is no longer required.
      const result = await browserApi.POST("/api/v1/brands", {
        body: body as components["schemas"]["BrandCreate"],
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not create brand");
    },
    onSuccess: () => {
      toast.success("Brand created");
      setName("");
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["brands"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: async (brandId: string) => {
      const result = await browserApi.DELETE("/api/v1/brands/{brand_id}", { params: { path: { brand_id: brandId } } });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not deactivate brand");
    },
    onSuccess: () => {
      setRemoveId(null);
      void queryClient.invalidateQueries({ queryKey: ["brands"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (brands.isLoading) return <LoadingState label="Loading brands" />;
  if (brands.isError) return <ErrorState body={brands.error.message} onRetry={() => void brands.refetch()} />;

  const list = brands.data ?? [];

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Brands"
        action={
          <button type="button" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground" onClick={() => setCreateOpen(true)}>
            Create brand
          </button>
        }
      />
      {list.length === 0 ? (
        <EmptyState title="Create your first brand" body="A brand is the home for branches, menus, and staff." action={<button type="button" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground" onClick={() => setCreateOpen(true)}>Create brand</button>} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((brand) => (
            <li key={brand.id} className="grid gap-2">
              <EntityCard
                href={`/app/brands/${brand.id}`}
                title={brand.name}
                meta={brand.slug}
                badge={<StatusChip tone={brand.is_active ? "available" : "soldout"}>{brand.is_active ? "Active" : "Inactive"}</StatusChip>}
              />
              <button type="button" className="min-h-11 text-sm text-destructive" onClick={() => setRemoveId(brand.id)}>Deactivate</button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create brand</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
            <input className={control} placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} required />
            <button className="min-h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground" type="submit" disabled={create.isPending}>Create brand</button>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={Boolean(removeId)} onOpenChange={(open) => !open && setRemoveId(null)} title="Deactivate this brand?" description="Branches under the brand are deactivated with it." confirmLabel="Deactivate" destructive onConfirm={() => removeId && remove.mutate(removeId)} />
    </div>
  );
}

export function BrandDetailScreen({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();
  const [branchOpen, setBranchOpen] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const isPlatform = useScope((state) => state.homeScope === "platform");
  const brand = useQuery({
    queryKey: ["brand", brandId],
    retry: false,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands/{brand_id}", { params: { path: { brand_id: brandId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Brand failed");
      return result.data;
    },
  });
  const missing = useDenyWhenMissing(brand.error);
  useEffect(() => {
    if (brand.data) useScope.getState().focusPlatform({ brandId: brand.data.id, branchId: null });
  }, [brand.data]);
  const branches = useQuery({
    queryKey: ["brand-branches", brandId],
    enabled: brand.isSuccess,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands/{brand_id}/branches", { params: { path: { brand_id: brandId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Branches failed");
      return result.data;
    },
  });
  const logo = useMutation({
    mutationFn: async (file: File) => uploadLogo(file, "brands", async () => {
      const result = await browserApi.POST("/api/v1/brands/{brand_id}/logo", {
        params: { path: { brand_id: brandId } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Logo failed");
    }),
    onSuccess: () => {
      toast.success("Logo saved");
      void queryClient.invalidateQueries({ queryKey: ["brand", brandId] });
    },
    onError: (error: Error) => {
      setLogoPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      toast.error(error.message);
    },
  });

  if (brand.isLoading || missing) return <LoadingState label="Loading brand" />;
  if (brand.isError || !brand.data) return <ErrorState body={brand.error?.message ?? "Brand missing"} onRetry={() => void brand.refetch()} />;

  return (
    <div className="grid gap-4">
      <Link
        href="/app/brands"
        className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back
      </Link>
      <PageHeader
        title={brand.data.name}
        action={
          isPlatform ? (
            <Link href="/app/invitations" className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-medium hover:bg-muted">
              Invite Brand Admin
            </Link>
          ) : undefined
        }
      />
      <BrandLogo
        name={brand.data.name}
        logoUrl={logoPreview ?? brand.data.logo_url}
        pending={logo.isPending}
        onFile={(file) => {
          const url = URL.createObjectURL(file);
          setLogoPreview((current) => {
            if (current) URL.revokeObjectURL(current);
            return url;
          });
          logo.mutate(file);
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Branches</h2>
        <button type="button" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground" onClick={() => setBranchOpen(true)}>
          Add branch
        </button>
      </div>
      <CreateBranchDialog brandId={brandId} open={branchOpen} onOpenChange={setBranchOpen} />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {(branches.data ?? []).map((branch) => (
          <li key={branch.id}>
            <EntityCard
              href={`/app/branches/${branch.id}`}
              title={pickLocale(branch.name)}
              meta={branch.slug}
              badge={<StatusChip tone={branch.is_active ? "available" : "soldout"}>{branch.is_active ? "Active" : "Inactive"}</StatusChip>}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function BrandLogo({
  name,
  logoUrl,
  pending,
  onFile,
}: {
  name: string;
  logoUrl?: string | null;
  pending: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mark = name.trim().charAt(0).toUpperCase() || "B";
  const shown = logoUrl?.trim() ? logoUrl : null;
  return (
    <section className="flex max-w-lg flex-col gap-4 rounded-2xl bg-card p-4 shadow-elev-1 ring-1 ring-foreground/5 sm:flex-row sm:items-center">
      <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary">
        {shown ? (
          // Logo files are stored on the upload host, which next/image is not set up to optimise.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={`${name} logo`} className="size-full object-cover" />
        ) : (
          <span className="text-2xl font-semibold text-primary">{mark}</span>
        )}
      </div>
      <div className="grid gap-2">
        <div>
          <h2 className="font-semibold">Logo</h2>
          <p id="brand-logo-hint" className="text-sm leading-6 text-muted-foreground">Shown to guests and staff. A square image works best.</p>
        </div>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          aria-describedby="brand-logo-hint"
          disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onFile(file);
          }}
        />
        <button
          type="button"
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus aria-hidden className="size-4" />
          {pending ? "Uploading…" : shown ? "Replace logo" : "Choose logo"}
        </button>
      </div>
    </section>
  );
}

function CreateBranchDialog({ brandId, open, onOpenChange }: { brandId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [radius, setRadius] = useState(150);
  const [prepMinutes, setPrepMinutes] = useState(20);
  const [pickerOpen, setPickerOpen] = useState(false);

  function reset() {
    setNameEn("");
    setNameAr("");
    setDisplayName("");
    setAddress("");
    setLocation(null);
    setRadius(150);
    setPrepMinutes(20);
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!location) throw new Error("Pick the branch location on the map");
      const body: components["schemas"]["BranchCreate"] = {
        name: { en: nameEn.trim(), ar: nameAr.trim() || nameEn.trim() },
        display_name: displayName.trim() || null,
        address: address.trim() || location.address || null,
        latitude: location.latitude,
        longitude: location.longitude,
        currency: "EGP",
        timezone: "Africa/Cairo",
        geofence_radius_meters: radius,
        sla_prep_time_minutes: prepMinutes,
        is_geofence_enabled: true,
        tax_rate: "0",
        service_fee_rate: "0",
        is_service_taxable: false,
        is_tax_inclusive: false,
        service_fee_dine_in_only: true,
        is_active: true,
      };
      const result = await browserApi.POST("/api/v1/brands/{brand_id}/branches", { params: { path: { brand_id: brandId } }, body });
      if (!result.response.ok) throw asApiError(result.error, result.response, "Could not create branch");
    },
    onSuccess: () => {
      toast.success("Branch created");
      reset();
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["brand-branches", brandId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add branch</DialogTitle>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Name (English)
              <input className={control} value={nameEn} onChange={(event) => setNameEn(event.target.value)} required />
            </label>
            <label className="grid gap-1 text-sm">
              Name (Arabic)
              <input className={control} dir="rtl" value={nameAr} onChange={(event) => setNameAr(event.target.value)} placeholder={nameEn} />
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            Display name
            <input className={control} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Shown to guests, optional" />
          </label>

          <div className="grid gap-1 text-sm">
            <span>Location</span>
            <button
              type="button"
              className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-start hover:border-primary/40"
              onClick={() => setPickerOpen(true)}
            >
              <MapPin aria-hidden className="size-4 shrink-0 text-primary" />
              {location ? (
                <span className="grid gap-0.5">
                  <span className="line-clamp-2">{location.address || "Pinned location"}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{location.latitude}, {location.longitude}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Choose on map</span>
              )}
              <span className="ms-auto text-xs text-primary">{location ? "Change" : "Open map"}</span>
            </button>
          </div>
          <label className="grid gap-1 text-sm">
            Street address
            <input className={control} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Filled from the map, edit if needed" />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Geofence radius (m)
              <input className={control} type="number" min={5} max={5000} value={radius} onChange={(event) => setRadius(Number(event.target.value))} required />
            </label>
            <label className="grid gap-1 text-sm">
              Prep time (min)
              <input className={control} type="number" min={1} value={prepMinutes} onChange={(event) => setPrepMinutes(Number(event.target.value))} required />
            </label>
          </div>

          <button className="min-h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50" type="submit" disabled={create.isPending || !location}>
            {create.isPending ? "Creating…" : "Create branch"}
          </button>
        </form>
        <LocationPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          value={location}
          radiusMeters={radius}
          onConfirm={(picked) => {
            setLocation(picked);
            setAddress(picked.address);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

async function uploadLogo(file: File, folder: "brands" | "items" | "general", after: (publicUrl: string) => Promise<void>) {
  const body: components["schemas"]["PresignedUrlRequest"] = {
    filename: file.name,
    content_type: file.type || "image/png",
    folder,
  };
  const signed = await browserApi.POST("/api/v1/media/presigned-url", { body });
  if (!signed.response.ok || !signed.data) throw asApiError(signed.error, signed.response, "Upload URL failed");
  const uploadUrl = signed.data.upload_url.startsWith("http")
    ? signed.data.upload_url
    : `${process.env.API_BASE_URL ?? ""}${signed.data.upload_url}`;
  const uploaded = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "content-type": file.type || "image/png" } });
  if (!uploaded.ok) throw new Error("Upload failed");
  await after(signed.data.public_url);
}
