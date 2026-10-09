"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImagePlus, MapPin, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { EntityCard } from "@/components/ops/entity-card";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { brandsCopy } from "@/lib/i18n/staff/brands";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { LocationPickerDialog, type PickedLocation } from "@/components/ops/location-picker";
import { LiveCount } from "@/components/ops/live-fact";
import { PageHeader } from "@/components/ops/page-header";
import { StatusChip } from "@/components/ops/status-chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, LoadingState } from "@/components/ops/states";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AnalyticsScreen } from "@/features/staff/backoffice-screen";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { mediaUrl, presignedUploadUrl } from "@/lib/media";
import { useDenyWhenMissing } from "@/lib/auth/session-client";
import { useScope } from "@/stores/scope";

const control = "h-11 w-full rounded-lg border px-3 text-sm";
const cardGrid = "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3";

function BrandMeta({ brand }: { brand: components["schemas"]["BrandResponse"] }) {
  const t = useStaffSection(brandsCopy);
  return (
    <>
      {brand.slug}
      {Array.isArray(brand.branches) ? (
        <>
          {" · "}
          <LiveCount value={brand.branches.length} /> {brand.branches.length === 1 ? t.branch : t.branches}
        </>
      ) : null}
    </>
  );
}

function BrandMenu({
  active,
  pending,
  onDeactivate,
  onActivate,
}: {
  active: boolean;
  pending: boolean;
  onDeactivate: () => void;
  onActivate: () => void;
}) {
  const t = useStaffSection(brandsCopy);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t.actions}
        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <MoreHorizontal aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {active ? (
          <DropdownMenuItem variant="destructive" className="min-h-11" onClick={onDeactivate}>
            {t.deactivate}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="min-h-11" disabled={pending} onClick={onActivate}>
            {pending ? t.activating : t.activate}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BrandsScreen() {
  const t = useStaffSection(brandsCopy);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const brands = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands", { params: { query: { limit: 100 } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.brandsFailed);
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
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotCreate);
    },
    onSuccess: () => {
      toast.success(t.created);
      setName("");
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["brands"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: async (brandId: string) => {
      const result = await browserApi.DELETE("/api/v1/brands/{brand_id}", { params: { path: { brand_id: brandId } } });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotDeactivate);
    },
    onSuccess: () => {
      setRemoveId(null);
      void queryClient.invalidateQueries({ queryKey: ["brands"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const activate = useMutation({
    mutationFn: async (brandId: string) => {
      const result = await browserApi.PATCH("/api/v1/brands/{brand_id}", {
        params: { path: { brand_id: brandId } },
        body: { is_active: true },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotActivate);
    },
    onSuccess: () => {
      toast.success(t.activated);
      void queryClient.invalidateQueries({ queryKey: ["brands"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (brands.isLoading) return <LoadingState label={t.loadingBrands} />;
  if (brands.isError) return <ErrorState body={brands.error.message} onRetry={() => void brands.refetch()} />;

  const list = brands.data ?? [];

  return (
    <div className="grid gap-4">
      <PageHeader
        title={t.title}
        detail={
          list.length > 0 ? (
            <>
              <LiveCount value={list.length} /> {list.length === 1 ? t.brand : t.brands}
            </>
          ) : undefined
        }
        action={
          <button type="button" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground" onClick={() => setCreateOpen(true)}>
            {t.create}
          </button>
        }
      />
      {list.length === 0 ? (
        <EmptyState title={t.emptyTitle} body={t.emptyBody} action={<button type="button" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground" onClick={() => setCreateOpen(true)}>{t.create}</button>} />
      ) : (
        <ul className={cardGrid}>
          {list.map((brand) => (
            <li key={brand.id}>
              <EntityCard
                href={`/app/brands/${brand.id}`}
                title={brand.name}
                meta={<BrandMeta brand={brand} />}
                badge={<StatusChip tone={brand.is_active ? "available" : "soldout"}>{brand.is_active ? t.active : t.inactive}</StatusChip>}
                menu={
                  <BrandMenu
                    active={brand.is_active}
                    pending={activate.isPending && activate.variables === brand.id}
                    onDeactivate={() => setRemoveId(brand.id)}
                    onActivate={() => activate.mutate(brand.id)}
                  />
                }
                onClick={() => {
                  if (useScope.getState().homeScope === "platform") {
                    useScope.getState().focusPlatform({ brandId: brand.id, branchId: null });
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.create}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
            <input className={control} placeholder={t.namePlaceholder} value={name} onChange={(event) => setName(event.target.value)} required />
            <button className="min-h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground" type="submit" disabled={create.isPending}>{t.create}</button>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={Boolean(removeId)} onOpenChange={(open) => !open && setRemoveId(null)} title={t.deactivateTitle} description={t.deactivateBody} confirmLabel={t.deactivate} destructive onConfirm={() => removeId && remove.mutate(removeId)} />
    </div>
  );
}

export function BrandDetailScreen({ brandId }: { brandId: string }) {
  const t = useStaffSection(brandsCopy);
  const isPlatform = useScope((state) => state.homeScope === "platform");
  if (!isPlatform) return <BrandOwnerDashboard brandId={brandId} />;
  return <BrandSetup brandId={brandId} backHref="/app/brands" backLabel={t.back} />;
}

export function BrandSettingsScreen({ brandId }: { brandId: string }) {
  const t = useStaffSection(brandsCopy);
  return <BrandSetup brandId={brandId} backHref={`/app/brands/${brandId}`} backLabel={t.dashboard} />;
}

function BrandOwnerDashboard({ brandId }: { brandId: string }) {
  const t = useStaffSection(brandsCopy);
  const brand = useQuery({
    queryKey: ["brand", brandId],
    retry: false,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands/{brand_id}", { params: { path: { brand_id: brandId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.brandFailed);
      return result.data;
    },
  });
  const missing = useDenyWhenMissing(brand.error);
  if (brand.isLoading || missing) return <LoadingState label={t.loadingBrand} />;
  if (brand.isError || !brand.data) return <ErrorState body={brand.error?.message ?? t.brandMissing} onRetry={() => void brand.refetch()} />;
  return (
    <div className="grid gap-4">
      <PageHeader
        title={brand.data.name}
        action={
          <Link href={`/app/brands/${brandId}/settings`} className="inline-flex min-h-11 items-center bg-secondary px-4 text-sm font-medium hover:bg-muted">
            {t.settings}
          </Link>
        }
      />
      <AnalyticsScreen view="dashboard" embedded />
    </div>
  );
}

function BrandSetup({ brandId, backHref, backLabel }: { brandId: string; backHref: string; backLabel: string }) {
  const t = useStaffSection(brandsCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [branchOpen, setBranchOpen] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const isPlatform = useScope((state) => state.homeScope === "platform");
  const focusedBrandId = useScope((state) => state.brandId);
  useLayoutEffect(() => {
    if (useScope.getState().homeScope === "platform") {
      useScope.getState().focusPlatform({ brandId, branchId: null });
    }
  }, [brandId]);
  const brand = useQuery({
    queryKey: ["brand", brandId],
    retry: false,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands/{brand_id}", { params: { path: { brand_id: brandId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.brandFailed);
      return result.data;
    },
  });
  const missing = useDenyWhenMissing(brand.error);
  useEffect(() => {
    if (brand.data) useScope.getState().focusPlatform({ brandId: brand.data.id, branchId: null });
  }, [brand.data]);
  const branches = useQuery({
    queryKey: ["brand-branches", brandId],
    enabled: brand.isSuccess && (!isPlatform || focusedBrandId === brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands/{brand_id}/branches", { params: { path: { brand_id: brandId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.branchesFailed);
      return result.data;
    },
  });
  const logo = useMutation({
    mutationFn: async (file: File) => uploadLogo(file, "brands", async (publicUrl) => {
      const result = await browserApi.POST("/api/v1/brands/{brand_id}/logo", {
        params: { path: { brand_id: brandId } },
        body: { logo_url: publicUrl },
        headers: { "Content-Type": "application/json" },
      } as never);
      if (!result.response.ok) throw asApiError(result.error, result.response, t.logoFailed);
    }, { url: t.uploadUrlFailed, upload: t.uploadFailed }),
    onSuccess: () => {
      toast.success(t.logoSaved);
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

  if (brand.isLoading || missing) return <LoadingState label={t.loadingBrand} />;
  if (brand.isError || !brand.data) return <ErrorState body={brand.error?.message ?? t.brandMissing} onRetry={() => void brand.refetch()} />;

  return (
    <div className="grid gap-4">
      <Link
        href={backHref}
        className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
        {backLabel}
      </Link>
      <PageHeader
        title={brand.data.name}
        action={
          isPlatform ? (
            <Link href="/app/invitations" className="inline-flex min-h-11 items-center bg-secondary px-4 text-sm font-medium hover:bg-muted">
              {t.inviteAdmin}
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
        <div className="grid gap-0.5">
          <h2 className="text-lg font-semibold">{t.branchesTitle}</h2>
          {branches.isSuccess ? (
            <p className="text-sm text-muted-foreground">
              <LiveCount value={branches.data.length} /> {branches.data.length === 1 ? t.branch : t.branches}
            </p>
          ) : null}
        </div>
        <button type="button" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground" onClick={() => setBranchOpen(true)}>
          {t.addBranch}
        </button>
      </div>
      <CreateBranchDialog brandId={brandId} open={branchOpen} onOpenChange={setBranchOpen} />
      <ul className={cardGrid}>
        {(branches.data ?? []).map((branch) => (
          <li key={branch.id}>
            <EntityCard
              href={`/app/branches/${branch.id}`}
              title={pickLocale(branch.name, locale)}
              meta={branch.slug}
              imageUrl={mediaUrl(logoPreview ?? brand.data.logo_url)}
              imageAlt={fill(t.logoAlt, { name: brand.data.name })}
              badge={<StatusChip tone={branch.is_active ? "available" : "soldout"}>{branch.is_active ? t.active : t.inactive}</StatusChip>}
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
  const t = useStaffSection(brandsCopy);
  const inputRef = useRef<HTMLInputElement>(null);
  const mark = name.trim().charAt(0).toUpperCase() || "B";
  const shown = mediaUrl(logoUrl?.trim() ? logoUrl : null);
  return (
    <section className="flex flex-col gap-4 bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary">
        {shown ? (
          // Logo files are stored on the upload host, which next/image is not set up to optimise.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={fill(t.logoAlt, { name })} className="size-full object-cover" />
        ) : (
          <span className="text-2xl font-semibold text-primary">{mark}</span>
        )}
      </div>
      <div className="grid gap-2">
        <div>
          <h2 className="font-semibold">{t.logo}</h2>
          <p id="brand-logo-hint" className="text-sm leading-6 text-muted-foreground">{t.logoHint}</p>
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
          {pending ? t.uploading : shown ? t.replaceLogo : t.chooseLogo}
        </button>
      </div>
    </section>
  );
}

function CreateBranchDialog({ brandId, open, onOpenChange }: { brandId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useStaffSection(brandsCopy);
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
      if (!location) throw new Error(t.pickLocation);
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
      if (!result.response.ok) throw asApiError(result.error, result.response, t.couldNotCreateBranch);
    },
    onSuccess: () => {
      toast.success(t.branchCreated);
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
          <DialogTitle>{t.addBranch}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              {t.nameEn}
              <input className={control} value={nameEn} onChange={(event) => setNameEn(event.target.value)} required />
            </label>
            <label className="grid gap-1 text-sm">
              {t.nameAr}
              <input className={control} dir="rtl" value={nameAr} onChange={(event) => setNameAr(event.target.value)} placeholder={nameEn} />
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            {t.displayName}
            <input className={control} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t.displayNamePlaceholder} />
          </label>

          <div className="grid gap-1 text-sm">
            <span>{t.location}</span>
            <button
              type="button"
              className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-start hover:border-primary/40"
              onClick={() => setPickerOpen(true)}
            >
              <MapPin aria-hidden className="size-4 shrink-0 text-primary" />
              {location ? (
                <span className="grid gap-0.5">
                  <span className="line-clamp-2">{location.address || t.pinned}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{location.latitude}, {location.longitude}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">{t.chooseOnMap}</span>
              )}
              <span className="ms-auto text-xs text-primary">{location ? t.change : t.openMap}</span>
            </button>
          </div>
          <label className="grid gap-1 text-sm">
            {t.streetAddress}
            <input className={control} value={address} onChange={(event) => setAddress(event.target.value)} placeholder={t.streetPlaceholder} />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              {t.geofence}
              <input className={control} type="number" min={5} max={5000} value={radius} onChange={(event) => setRadius(Number(event.target.value))} required />
            </label>
            <label className="grid gap-1 text-sm">
              {t.prepTime}
              <input className={control} type="number" min={1} value={prepMinutes} onChange={(event) => setPrepMinutes(Number(event.target.value))} required />
            </label>
          </div>

          <button className="min-h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50" type="submit" disabled={create.isPending || !location}>
            {create.isPending ? t.creating : t.createBranch}
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

async function uploadLogo(
  file: File,
  folder: "brands" | "items" | "general",
  after: (publicUrl: string) => Promise<void>,
  failed: { url: string; upload: string },
) {
  const body: components["schemas"]["PresignedUrlRequest"] = {
    filename: file.name,
    content_type: file.type || "image/png",
    folder,
  };
  const signed = await browserApi.POST("/api/v1/media/presigned-url", { body });
  if (!signed.response.ok || !signed.data) throw asApiError(signed.error, signed.response, failed.url);
  const uploadUrl = presignedUploadUrl(signed.data.upload_url);
  const uploaded = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "content-type": file.type || "image/png" } });
  if (!uploaded.ok) throw new Error(failed.upload);
  await after(signed.data.public_url);
}
