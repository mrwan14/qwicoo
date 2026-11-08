"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { MapPin, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { Button, buttonClass } from "@/components/ops/kit/button";
import { Card } from "@/components/ops/kit/card";
import { EmptyState } from "@/components/ops/kit/empty-state";
import { Input, Select } from "@/components/ops/kit/field";
import { PageHeader } from "@/components/ops/kit/page-header";
import { ErrorState, LoadingState } from "@/components/ops/states";
import { ApiError, asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { peopleCopy } from "@/lib/i18n/staff/people";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { areaNames, boundsForGovernorate, loadEgyptGovernorates, searchEgyptAreas, type EgyptAreaSuggestion } from "@/lib/maps/egypt";
import { useScope } from "@/stores/scope";

type Governorate = components["schemas"]["DeliveryGovernorateResponse"];
type Zone = components["schemas"]["DeliveryZoneResponse"];
/** The fields the fee table needs from a brand branch. */
type Branch = { id: string; name: unknown; slug: string };
type Fee = components["schemas"]["BranchDeliveryFeeResponse"];
type Text = ReturnType<typeof useDeliveryText>;

/** The brand feature that has to be on before the delivery API answers. */
const DELIVERY_FEATURE = "DELIVERY_MODULE";
const MONEY = /^\d+(\.\d{1,2})?$/;

function useDeliveryText() {
  return useStaffSection(peopleCopy).delivery;
}

function sameName(a: string, b: string) {
  return a.localeCompare(b, "en", { sensitivity: "accent" }) === 0;
}

/** Name in the reader's language, with the other language as a quieter second line. */
function placeNames(place: { name_en: string; name_ar: string }, locale: string) {
  return locale === "ar" ? { main: place.name_ar || place.name_en, other: place.name_en } : { main: place.name_en, other: place.name_ar };
}

export function DeliveryScreen() {
  const t = useDeliveryText();
  const brandId = useScope((state) => state.brandId);
  const focusPlatform = useScope((state) => state.focusPlatform);
  const queryClient = useQueryClient();
  const [govId, setGovId] = useState("");

  const brands = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands", { params: { query: { limit: 100 } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.brandsFailed);
      return result.data.items;
    },
  });
  const govs = useQuery({
    queryKey: ["delivery-govs", brandId],
    enabled: Boolean(brandId),
    retry: false,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/delivery/governorates");
      if (result.response.status === 404) return [];
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.governoratesFailed);
      return result.data;
    },
  });
  const turnOn = useMutation({
    mutationFn: async () => {
      const result = await browserApi.PUT("/api/v1/features/brand/{brand_id}/{feature_key}", {
        params: { path: { brand_id: brandId ?? "", feature_key: DELIVERY_FEATURE } },
        body: { is_enabled_by_super_admin: true },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.turnOnFailed);
    },
    onSuccess: () => {
      toast.success(fill(t.turnedOn, { brand: brandName }));
      void queryClient.invalidateQueries({ queryKey: ["features-brand"] });
      void queryClient.invalidateQueries({ queryKey: ["delivery-govs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const brandName = (brands.data ?? []).find((item) => item.id === brandId)?.name ?? t.thisBrand;
  const governorates = govs.data ?? [];
  // Keep the picked governorate; otherwise show the first one so the page never opens empty.
  const active = governorates.find((item) => item.id === govId) ?? governorates[0] ?? null;
  const locked = govs.error instanceof ApiError && govs.error.code === "FEATURE_LOCKED_BY_PLATFORM";

  const brandPicker = (
    <Select
      className="w-56"
      aria-label={t.brand}
      value={brandId ?? ""}
      onChange={(event) => {
        const next = event.target.value || null;
        if (next === brandId) return;
        setGovId("");
        focusPlatform({ brandId: next, branchId: null });
      }}
    >
      <option value="">{brands.isFetching && !brands.data ? t.loadingBrands : t.chooseBrand}</option>
      {(brands.data ?? []).map((brand) => (
        <option key={brand.id} value={brand.id}>
          {brand.name}
        </option>
      ))}
    </Select>
  );

  let body;
  if (!brandId) {
    body = <EmptyState icon={MapPin} title={t.pickBrandTitle} body={t.pickBrandBody} />;
  } else if (locked) {
    body = (
      <EmptyState
        icon={MapPin}
        title={fill(t.lockedTitle, { brand: brandName })}
        body={fill(t.lockedBody, { brand: brandName })}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button disabled={turnOn.isPending} onClick={() => turnOn.mutate()}>
              {turnOn.isPending ? t.turningOn : t.turnOn}
            </Button>
            <Link href="/app/features" className={buttonClass({ variant: "secondary" })}>
              {t.allFeatures}
            </Link>
          </div>
        }
      />
    );
  } else if (govs.isLoading) {
    body = <LoadingState label={t.loadingGovs} />;
  } else if (govs.isError) {
    body = <ErrorState body={govs.error.message} onRetry={() => void govs.refetch()} />;
  } else {
    body = (
      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <GovernorateList governorates={governorates} activeId={active?.id ?? null} brandId={brandId} onSelect={setGovId} />
        {active ? (
          <GovernorateDetail key={active.id} governorate={active} brandId={brandId} brandName={brandName} onRemoved={() => setGovId("")} />
        ) : (
          <EmptyState icon={MapPin} title={t.emptyGovTitle} body={fill(t.emptyGovBody, { brand: brandName })} />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-5">
      <PageHeader title={t.title} subtitle={fill(t.intro, { brand: brandName })} actions={brandPicker} />
      {brands.isError ? <p className="text-sm text-danger">{brands.error.message}</p> : null}
      {body}
    </div>
  );
}

function GovernorateList({
  governorates: list,
  activeId,
  brandId,
  onSelect,
}: {
  governorates: Governorate[];
  activeId: string | null;
  brandId: string;
  onSelect: (id: string) => void;
}) {
  const t = useDeliveryText();
  const { locale } = useLocale();
  return (
    <Card title={`${t.govTitle} · ${list.length}`}>
      {list.length > 0 ? (
        <ul className="-mx-1 grid gap-1">
          {list.map((gov) => {
            const names = placeNames(gov, locale);
            const current = gov.id === activeId;
            return (
              <li key={gov.id}>
                <button
                  type="button"
                  aria-current={current ? "true" : undefined}
                  className={cn(
                    "grid w-full gap-0.5 rounded-staff border px-3 py-2 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
                    current ? "border-ink bg-subtle" : "border-transparent hover:bg-subtle",
                  )}
                  onClick={() => onSelect(gov.id)}
                >
                  <span className="text-sm font-medium text-ink">{names.main}</span>
                  <span className="text-xs text-ink-secondary">
                    <bdi>{names.other}</bdi>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <AddGovernorate saved={list} brandId={brandId} onAdded={onSelect} />
    </Card>
  );
}

function AddGovernorate({ saved, brandId, onAdded }: { saved: Governorate[]; brandId: string; onAdded: (id: string) => void }) {
  const t = useDeliveryText();
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [placeId, setPlaceId] = useState("");
  const egypt = useQuery({
    queryKey: ["egypt-governorates"],
    staleTime: Infinity,
    retry: false,
    queryFn: () => loadEgyptGovernorates(),
  });
  const options = egypt.data ?? [];
  const picked = options.find((item) => item.placeId === placeId) ?? null;
  const isSaved = (nameEn: string) => saved.some((item) => sameName(item.name_en, nameEn));
  const create = useMutation({
    mutationFn: async (place: { nameEn: string; nameAr: string }) => {
      const body: components["schemas"]["DeliveryGovernorateCreate"] = { name_en: place.nameEn, name_ar: place.nameAr, brand_id: brandId, is_active: true };
      const result = await browserApi.POST("/api/v1/delivery/governorates", { body });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.createGovFailed);
      return result.data;
    },
    onSuccess: (gov) => {
      setPlaceId("");
      toast.success(fill(t.govAdded, { name: placeNames(gov, locale).main }));
      void queryClient.invalidateQueries({ queryKey: ["delivery-govs"] });
      onAdded(gov.id);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="grid gap-2 border-t border-border pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (picked) create.mutate(picked);
      }}
    >
      <span className="text-xs font-medium text-ink-secondary">{t.addGovLabel}</span>
      <div className="flex gap-2">
        <Select className="min-w-0 flex-1 [&_select]:pe-8" aria-label={t.addGovLabel} value={placeId} disabled={egypt.isLoading} onChange={(event) => setPlaceId(event.target.value)}>
          <option value="">{egypt.isLoading ? t.loadingMaps : egypt.isError ? t.govUnavailable : t.chooseGovernorate}</option>
          {options.map((item) => {
            const label = locale === "ar" ? item.nameAr : item.nameEn;
            return (
              <option key={item.placeId} value={item.placeId} disabled={isSaved(item.nameEn)}>
                {isSaved(item.nameEn) ? fill(t.alreadyOn, { name: label }) : label}
              </option>
            );
          })}
        </Select>
        <Button type="submit" size="field" disabled={!picked || create.isPending}>
          {create.isPending ? t.adding : t.add}
        </Button>
      </div>
      {egypt.isError ? <p className="text-xs text-danger">{egypt.error.message}</p> : null}
    </form>
  );
}

function GovernorateDetail({
  governorate,
  brandId,
  brandName,
  onRemoved,
}: {
  governorate: Governorate;
  brandId: string;
  brandName: string;
  onRemoved: () => void;
}) {
  const t = useDeliveryText();
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const names = placeNames(governorate, locale);
  const remove = useMutation({
    mutationFn: async () => {
      const result = await browserApi.DELETE("/api/v1/delivery/governorates/{governorate_id}", {
        params: { path: { governorate_id: governorate.id } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.removeGovFailed);
    },
    onSuccess: () => {
      setConfirming(false);
      toast.success(fill(t.govRemoved, { name: names.main }));
      onRemoved();
      void queryClient.invalidateQueries({ queryKey: ["delivery-govs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section aria-labelledby="delivery-gov-title" className="grid content-start gap-5 rounded-staff border border-border bg-canvas p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 id="delivery-gov-title" className="text-lg font-semibold text-ink">
            {names.main}
          </h2>
          <p className="text-sm text-ink-secondary">
                    <bdi>{names.other}</bdi>
                  </p>
        </div>
        <Button variant="dangerGhost" size="sm" onClick={() => setConfirming(true)}>
          {t.removeGov}
        </Button>
      </header>
      <Areas governorate={governorate} />
      <Fees governorate={governorate} brandId={brandId} brandName={brandName} />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={fill(t.removeGovTitle, { name: names.main })}
        description={fill(t.removeGovBody, { name: names.main })}
        confirmLabel={t.removeGov}
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </section>
  );
}

function Areas({ governorate }: { governorate: Governorate }) {
  const t = useDeliveryText();
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const govName = placeNames(governorate, locale).main;
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<EgyptAreaSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [missed, setMissed] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<Zone | null>(null);
  const zonesKey = ["delivery-zones", governorate.id];

  const zones = useQuery({
    queryKey: zonesKey,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/delivery/governorates/{governorate_id}/zones", {
        params: { path: { governorate_id: governorate.id } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.zonesFailed);
      return result.data;
    },
  });
  const bounds = useQuery({
    queryKey: ["egypt-gov-bounds", governorate.name_en],
    staleTime: Infinity,
    retry: false,
    queryFn: () => boundsForGovernorate(governorate.name_en),
  });
  const create = useMutation({
    mutationFn: async (place: { nameEn: string; nameAr: string }) => {
      const body: components["schemas"]["DeliveryZoneCreate"] = { name_en: place.nameEn, name_ar: place.nameAr, governorate_id: governorate.id, is_active: true };
      const result = await browserApi.POST("/api/v1/delivery/governorates/{governorate_id}/zones", {
        params: { path: { governorate_id: governorate.id } },
        body,
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.createZoneFailed);
      return place;
    },
    onSuccess: (place) => {
      toast.success(fill(t.zoneAdded, { name: locale === "ar" ? place.nameAr : place.nameEn }));
      void queryClient.invalidateQueries({ queryKey: zonesKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: async (zone: Zone) => {
      const result = await browserApi.DELETE("/api/v1/delivery/zones/{zone_id}", { params: { path: { zone_id: zone.id } } });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.removeZoneFailed);
      return zone;
    },
    onSuccess: (zone) => {
      setRemoving(null);
      toast.success(fill(t.zoneRemoved, { name: placeNames(zone, locale).main }));
      void queryClient.invalidateQueries({ queryKey: zonesKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setOptions([]);
      setSearching(false);
      setMissed(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setError("");
      void searchEgyptAreas(text, bounds.data ?? null)
        .then((found) => {
          if (cancelled) return;
          setOptions(found);
          setMissed(found.length === 0);
        })
        .catch((failure: Error) => {
          if (cancelled) return;
          setOptions([]);
          setError(failure.message);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [bounds.data, query]);

  const list = zones.data ?? [];

  async function pick(option: EgyptAreaSuggestion) {
    setOptions([]);
    setError("");
    try {
      const place = await areaNames(option.placeId);
      if (list.some((zone) => sameName(zone.name_en, place.nameEn))) {
        toast.message(fill(t.zoneExists, { name: locale === "ar" ? place.nameAr : place.nameEn }));
      } else {
        create.mutate(place);
      }
      setQuery("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t.createZoneFailed);
    }
  }

  return (
    <div className="grid gap-3 border-t border-border pt-4">
      <div className="grid gap-0.5">
        <h3 className="text-sm font-semibold text-ink">
          {t.zonesTitle} <span className="font-normal text-ink-secondary tabular-nums">· {list.length}</span>
        </h3>
        <p className="text-[13px] text-ink-secondary">{fill(t.zonesHint, { gov: govName })}</p>
      </div>
      <div className="relative">
        <Input
          icon={Search}
          role="combobox"
          aria-label={fill(t.searchArea, { gov: govName })}
          aria-expanded={options.length > 0}
          aria-controls="delivery-area-list"
          aria-autocomplete="list"
          placeholder={fill(t.searchArea, { gov: govName })}
          value={query}
          disabled={create.isPending}
          onChange={(event) => {
            setQuery(event.target.value);
            setError("");
          }}
        />
        {options.length > 0 ? (
          <ul
            id="delivery-area-list"
            role="listbox"
            className="absolute inset-x-0 top-full z-10 mt-1 grid max-h-64 overflow-auto rounded-staff border border-border bg-canvas py-1 shadow-dialog"
          >
            {options.map((option) => (
              <li key={option.placeId} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="grid w-full gap-0.5 px-3 py-2 text-start hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void pick(option)}
                >
                  <span className="text-sm font-medium text-ink">{option.label}</span>
                  {option.detail ? <span className="text-xs text-ink-secondary">{option.detail}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {searching ? <p className="text-xs text-ink-secondary">{t.searching}</p> : null}
      {create.isPending ? <p className="text-xs text-ink-secondary">{t.adding}</p> : null}
      {missed && !searching ? <p className="text-xs text-ink-secondary">{t.noAreas}</p> : null}
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}

      {zones.isLoading ? (
        <LoadingState label={t.loadingZones} />
      ) : zones.isError ? (
        <ErrorState body={zones.error.message} onRetry={() => void zones.refetch()} />
      ) : list.length === 0 ? (
        <p className="rounded-staff bg-subtle px-3 py-4 text-center text-sm text-ink-secondary">{t.emptyZones}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {list.map((zone) => {
            const zoneNames = placeNames(zone, locale);
            return (
              <li key={zone.id} title={zoneNames.other} className="inline-flex items-center gap-1 rounded-staff border border-border bg-canvas py-1 ps-3 pe-1 text-sm text-ink">
                {zoneNames.main}
                <button
                  type="button"
                  aria-label={fill(t.removeZone, { name: zoneNames.main })}
                  className="inline-flex size-7 items-center justify-center rounded-staff text-ink-secondary hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
                  onClick={() => setRemoving(zone)}
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={fill(t.removeZoneTitle, { name: removing ? placeNames(removing, locale).main : "" })}
        description={t.removeZoneBody}
        confirmLabel={t.removeGov}
        destructive
        pending={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      />
    </div>
  );
}

function Fees({ governorate, brandId, brandName }: { governorate: Governorate; brandId: string; brandName: string }) {
  const t = useDeliveryText();
  const { locale } = useLocale();
  const branches = useQuery({
    queryKey: ["brand-branches", brandId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands/{brand_id}/branches", { params: { path: { brand_id: brandId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.branchesFailed);
      return result.data;
    },
  });
  const list = branches.data ?? [];
  const fees = useQueries({
    queries: list.map((branch) => ({
      queryKey: ["delivery-fees", branch.id],
      queryFn: async () => {
        const result = await browserApi.GET("/api/v1/delivery/fees/branch/{branch_id}", { params: { path: { branch_id: branch.id } } });
        if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.feesFailed);
        return result.data;
      },
    })),
  });

  return (
    <div className="grid gap-3 border-t border-border pt-4">
      <div className="grid gap-0.5">
        <h3 className="text-sm font-semibold text-ink">{t.feesTitle}</h3>
        <p className="text-[13px] text-ink-secondary">{fill(t.feesHint, { gov: placeNames(governorate, locale).main })}</p>
      </div>
      {branches.isLoading ? (
        <LoadingState label={t.loadingFees} />
      ) : branches.isError ? (
        <ErrorState body={branches.error.message} onRetry={() => void branches.refetch()} />
      ) : list.length === 0 ? (
        <p className="rounded-staff bg-subtle px-3 py-4 text-center text-sm text-ink-secondary">{fill(t.noBranches, { brand: brandName })}</p>
      ) : (
        <div className="grid">
          <div className="grid grid-cols-[minmax(0,1fr)_8rem_6rem] gap-3 border-b border-border pb-2 text-xs font-medium text-ink-secondary">
            <span>{t.branch}</span>
            <span>{t.fee}</span>
            <span className="sr-only">{t.save}</span>
          </div>
          {list.map((branch, index) => {
            const query = fees[index];
            const saved = query?.data?.find((fee) => fee.governorate_id === governorate.id && !fee.zone_id) ?? null;
            return (
              <FeeRow
                key={`${branch.id}-${saved?.updated_at ?? "none"}`}
                branch={branch}
                governorate={governorate}
                saved={saved}
                loading={query?.isLoading ?? true}
                failed={query?.isError ? query.error.message : null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function FeeRow({
  branch,
  governorate,
  saved,
  loading,
  failed,
}: {
  branch: Branch;
  governorate: Governorate;
  saved: Fee | null;
  loading: boolean;
  failed: string | null;
}) {
  const t: Text = useDeliveryText();
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const name = pickLocale(branch.name, locale) || branch.slug;
  const [draft, setDraft] = useState(saved ? String(saved.delivery_fee) : "");
  const value = draft.trim();
  const valid = MONEY.test(value);
  const changed = value !== (saved ? String(saved.delivery_fee) : "") && !(saved && valid && Number(value) === Number(saved.delivery_fee));
  const save = useMutation({
    mutationFn: async () => {
      // Editing keeps the branch's own estimate and minimum; a new fee starts at 45 minutes and no minimum.
      const body: components["schemas"]["BranchDeliveryFeeCreate"] = {
        branch_id: branch.id,
        governorate_id: governorate.id,
        delivery_fee: value,
        estimated_time_minutes: saved?.estimated_time_minutes ?? 45,
        min_order_amount: saved?.min_order_amount ?? "0.00",
      };
      const result = await browserApi.POST("/api/v1/delivery/fees", { body });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.feeFailed);
    },
    onSuccess: () => {
      toast.success(fill(t.feeSaved, { branch: name }));
      void queryClient.invalidateQueries({ queryKey: ["delivery-fees", branch.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)_8rem_6rem] items-center gap-3 border-b border-border py-2.5 last:border-b-0"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && changed) save.mutate();
      }}
    >
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate text-sm font-medium text-ink">{name}</span>
        {failed ? (
          <span className="text-xs text-danger">{failed}</span>
        ) : value && !valid ? (
          <span className="text-xs text-danger">{t.feeInvalid}</span>
        ) : !saved && !loading ? (
          <span className="text-xs text-ink-secondary">{t.noFee}</span>
        ) : null}
      </span>
      <Input
        inputMode="decimal"
        aria-label={fill(t.feeFor, { branch: name })}
        aria-invalid={value && !valid ? true : undefined}
        placeholder={loading ? "…" : "0.00"}
        disabled={loading || Boolean(failed)}
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d.]/g, ""))}
      />
      <Button type="submit" size="field" className="w-full px-3" variant={changed && valid ? "primary" : "secondary"} disabled={!changed || !valid || save.isPending}>
        {save.isPending ? t.saving : t.save}
      </Button>
    </form>
  );
}
