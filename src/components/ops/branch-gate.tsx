"use client";

import { useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { focusPlatformBranch, switchBranch } from "@/lib/auth/session-client";
import { pickLocale } from "@/lib/i18n/locale-text";
import { useScope } from "@/stores/scope";

const control = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm";

/**
 * Branch-level screens only mount once a branch is in scope, so none of
 * their requests can go out without X-Branch-ID.
 */
export function BranchGate({ screen, children }: { screen: string; children: ReactNode }) {
  const branchId = useScope((state) => state.branchId);
  const isPlatform = useScope((state) => state.homeScope === "platform");

  if (!branchId) return <ChooseBranch screen={screen} />;
  if (!isPlatform) return children;
  return (
    <div className="grid gap-4">
      <PlatformBranchBar branchId={branchId} />
      {children}
    </div>
  );
}

function branchLabel(branch: { display_name?: string | null; name?: unknown; slug?: string | null }) {
  return branch.display_name || pickLocale(branch.name, "en") || branch.slug || "Branch";
}

function PlatformBranchBar({ branchId }: { branchId: string }) {
  const brandId = useScope((state) => state.brandId);
  const branch = useQuery({
    queryKey: ["branch", branchId],
    retry: false,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}", { params: { path: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Branch failed");
      return result.data;
    },
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-sm shadow-elev-1">
      <span className="inline-flex min-w-0 items-center gap-2">
        <Store aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">Working in</span>
        <span className="truncate font-medium">{branch.data ? branchLabel(branch.data) : "…"}</span>
      </span>
      <button
        type="button"
        className="min-h-10 rounded-lg border px-3 text-sm hover:bg-muted"
        onClick={() => void focusPlatformBranch({ brandId, branchId: null })}
      >
        Change branch
      </button>
    </div>
  );
}

function ChooseBranch({ screen }: { screen: string }) {
  const isPlatform = useScope((state) => state.homeScope === "platform");
  return (
    <div className="grid max-w-xl gap-4 rounded-xl border border-dashed bg-card p-6 shadow-elev-1">
      <div>
        <h2 className="text-[length:var(--text-20)] font-semibold">Choose a branch first</h2>
        <p className="mt-2 text-sm text-muted-foreground">{screen} works on one branch at a time. Pick the branch to open.</p>
      </div>
      {isPlatform ? <PlatformBranchPicker /> : <OwnBranchPicker />}
    </div>
  );
}

function BranchButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-start text-sm hover:border-primary/40 hover:bg-muted"
      onClick={onClick}
    >
      <Store aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function OwnBranchPicker() {
  const branches = useScope((state) => state.branches);
  if (branches.length === 0) {
    return <p className="text-sm text-muted-foreground">No branch is assigned to your account yet. Ask your admin to add you to one.</p>;
  }
  return (
    <ul className="grid gap-2">
      {branches.map((branch) => (
        <li key={branch.id}>
          <BranchButton label={branch.name} onClick={() => void switchBranch(branch.id)} />
        </li>
      ))}
    </ul>
  );
}

function PlatformBranchPicker() {
  const focusedBrand = useScope((state) => state.brandId);
  const [picked, setPicked] = useState<string | null>(null);

  const brands = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands", { params: { query: { limit: 100 } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Brands failed");
      return result.data.items;
    },
  });
  const list = brands.data ?? [];
  const usable = list.filter((brand) => brand.is_active && (brand.branches?.length ?? 0) > 0);
  const brandId =
    picked ??
    usable.find((brand) => brand.id === focusedBrand)?.id ??
    usable[0]?.id ??
    list.find((brand) => brand.is_active)?.id ??
    list[0]?.id ??
    null;

  const branches = useQuery({
    queryKey: ["brand-branches", brandId],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/brands/{brand_id}/branches", {
        params: { path: { brand_id: brandId ?? "" } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Branches failed");
      return result.data;
    },
  });

  if (brands.isLoading) return <LoadingState label="Loading brands" />;
  if (brands.isError) return <ErrorState body={brands.error.message} onRetry={() => void brands.refetch()} />;
  if (list.length === 0) {
    return (
      <EmptyState
        title="No brands yet"
        body="Create a brand and a branch first."
        action={<Link href="/app/brands" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">Go to Brands</Link>}
      />
    );
  }

  return (
    <div className="grid gap-3">
      {list.length > 1 ? (
        <label className="grid gap-1 text-sm">
          Brand
          <select className={control} value={brandId ?? ""} onChange={(event) => setPicked(event.target.value)}>
            {list.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.is_active ? brand.name : `${brand.name} (inactive)`}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {branches.isLoading ? <LoadingState label="Loading branches" /> : null}
      {branches.isError ? <ErrorState body={branches.error.message} onRetry={() => void branches.refetch()} /> : null}
      {branches.data && branches.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This brand has no branches yet.{" "}
          <Link className="underline" href={`/app/brands/${brandId}`}>
            Add one
          </Link>
          .
        </p>
      ) : null}
      {branches.data && branches.data.length > 0 ? (
        <ul className="grid gap-2">
          {branches.data.map((branch) => (
            <li key={branch.id}>
              <BranchButton label={branchLabel(branch)} onClick={() => void focusPlatformBranch({ brandId, branchId: branch.id })} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
