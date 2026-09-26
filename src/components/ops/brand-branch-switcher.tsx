"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { browserApi } from "@/lib/api/browser";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useStaffSession } from "@/components/ops/staff-session";
import { pickLocale } from "@/lib/i18n/locale-text";
import { useWorkspace } from "@/stores/workspace";

function useWorkspaceOptions() {
  const me = useStaffSession();
  const brandId = useWorkspace((state) => state.brandId);

  const brands = useQuery({
    queryKey: ["brands"],
    enabled: Boolean(me),
    queryFn: async () => {
      const { data, response } = await browserApi.GET("/api/v1/brands", {
        params: { query: { limit: 100 } },
      });
      if (!response.ok) return [];
      return data?.items ?? [];
    },
  });

  const branches = useQuery({
    queryKey: ["branches", brandId],
    enabled: Boolean(me),
    queryFn: async () => {
      const filtered = await browserApi.GET("/api/v1/branches", {
        params: {
          query: brandId ? { brand_id: brandId, limit: 100 } : { limit: 100 },
        },
      });
      if (filtered.response.ok && filtered.data && filtered.data.length > 0) {
        return filtered.data;
      }
      const all = await browserApi.GET("/api/v1/branches", {
        params: { query: { limit: 100 } },
      });
      if (!all.response.ok || !all.data) return [];
      return all.data;
    },
  });

  return { brands, branches };
}

export function WorkspaceBootstrap() {
  const me = useStaffSession();
  const { brands, branches } = useWorkspaceOptions();
  const brandId = useWorkspace((state) => state.brandId);
  const branchId = useWorkspace((state) => state.branchId);

  useEffect(() => {
    if (!me || !brands.data || !branches.data) return;

    const allowed = new Set(me.allowed_branch_ids ?? []);
    const visible =
      allowed.size > 0
        ? branches.data.filter((branch) => allowed.has(branch.id))
        : branches.data;
    const store = useWorkspace.getState();
    const brandOk = brands.data.some((brand) => brand.id === store.brandId);
    const nextBrand = brandOk ? store.brandId : (brands.data[0]?.id ?? null);
    if (nextBrand !== store.brandId) store.setBrandId(nextBrand);

    const forBrand = visible.filter(
      (branch) => !nextBrand || branch.brand_id === nextBrand || branch.brand_id == null,
    );
    const pool = forBrand.length > 0 ? forBrand : visible;
    const branchOk = pool.some((branch) => branch.id === store.branchId);
    const nextBranch = branchOk ? store.branchId : (pool[0]?.id ?? null);
    if (nextBranch !== store.branchId) store.setBranchId(nextBranch);
  }, [me, brands.data, branches.data, brandId, branchId]);

  return null;
}

function branchLabel(branch: { name: unknown; display_name?: string | null }): string {
  return branch.display_name || pickLocale(branch.name, "en") || "Branch";
}

function Fields({
  idPrefix,
  brands,
  branches,
  layout = "stacked",
}: {
  idPrefix: string;
  brands: ReturnType<typeof useWorkspaceOptions>["brands"];
  branches: ReturnType<typeof useWorkspaceOptions>["branches"];
  layout?: "inline" | "stacked";
}) {
  const brandId = useWorkspace((state) => state.brandId);
  const branchId = useWorkspace((state) => state.branchId);
  const setBrandId = useWorkspace((state) => state.setBrandId);
  const setBranchId = useWorkspace((state) => state.setBranchId);
  const inline = layout === "inline";
  const fieldClass = inline ? "flex shrink-0 items-center gap-2" : "grid gap-1";
  const selectClass = inline
    ? "h-11 w-44 rounded-lg border border-input bg-background px-3 text-sm"
    : "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm";

  return (
    <div className={inline ? "flex min-w-0 items-center gap-3" : "grid gap-3"}>
      {(brands.data ?? []).length > 0 ? (
        <div className={fieldClass}>
          <Label htmlFor={`${idPrefix}-brand`} className="shrink-0">
            Brand
          </Label>
          <select
            id={`${idPrefix}-brand`}
            className={selectClass}
            value={brandId ?? brands.data?.[0]?.id ?? ""}
            onChange={(event) => {
              setBrandId(event.target.value || null);
              setBranchId(null);
            }}
          >
            {(brands.data ?? []).map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className={inline ? "min-w-0 truncate text-sm text-muted-foreground" : "text-sm text-muted-foreground"}>
          {brands.isFetching ? "Loading brands" : "Branch only. This account has no brand list."}
        </p>
      )}
      <div className={fieldClass}>
        <Label htmlFor={`${idPrefix}-branch`} className="shrink-0">
          Branch
        </Label>
        <select
          id={`${idPrefix}-branch`}
          className={selectClass}
          value={branchId ?? ""}
          onChange={(event) => setBranchId(event.target.value || null)}
        >
          <option value="">No branch</option>
          {(branches.data ?? []).map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branchLabel(branch)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function BrandBranchSwitcher() {
  const options = useWorkspaceOptions();
  const brandId = useWorkspace((state) => state.brandId);
  const branchId = useWorkspace((state) => state.branchId);
  const branch = (options.branches.data ?? []).find((item) => item.id === branchId);
  const brand = (options.brands.data ?? []).find((item) => item.id === brandId);

  return (
    <>
      <div className="hidden min-w-0 items-center lg:flex">
        <Fields idPrefix="desk" layout="inline" brands={options.brands} branches={options.branches} />
      </div>
      <Sheet>
        <SheetTrigger className="inline-flex h-11 max-w-[12rem] items-center truncate rounded-lg border px-3 text-sm lg:hidden">
          {brand?.name ? `${brand.name} · ` : ""}
          {branch ? branchLabel(branch) : "Branch"}
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[80dvh]">
          <SheetHeader>
            <SheetTitle>Brand and branch</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <Fields idPrefix="sheet" brands={options.brands} branches={options.branches} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
