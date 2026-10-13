"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { LoadingState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { denyAccess } from "@/lib/auth/session-client";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale, type LocaleCode } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { navCopy } from "@/lib/i18n/staff/nav";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { canListStaff, canOpenInventoryPage, INVENTORY_HREFS, type InventoryPage } from "./access";

export const control = "h-11 w-full border border-input bg-background px-3 text-sm";
export const primaryButton =
  "inline-flex h-11 items-center justify-center border border-foreground bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50";
export const secondaryButton =
  "inline-flex h-11 items-center justify-center border border-input bg-background px-4 text-sm font-medium disabled:opacity-50";

export { INVENTORY_HREFS };

const TAB_ORDER: InventoryPage[] = [
  "overview",
  "stock",
  "movements",
  "ingredients",
  "units",
  "import",
  "recipes",
  "suppliers",
  "purchaseOrders",
  "counts",
  "transfers",
  "waste",
  "prep",
  "reports",
  "settings",
  "jobs",
];

export function InventorySection({ children }: { children: ReactNode }) {
  const nav = useStaffSection(navCopy);
  return (
    <RoleGate href="/app/inventory">
      <BranchGate screen={nav.inventory}>{children}</BranchGate>
    </RoleGate>
  );
}

export function InventoryFrame({ page, children }: { page: InventoryPage; children: ReactNode }) {
  const t = useStaffSection(inventoryCopy);
  const me = useStaffSession();
  const pathname = usePathname();
  const allowed = Boolean(me && canOpenInventoryPage(me.role, page));
  useEffect(() => {
    if (me && !allowed) denyAccess();
  }, [me, allowed]);
  if (!me) return null;
  if (!allowed) return <LoadingState label={t.loading} />;
  const tabs = TAB_ORDER.filter((item) => canOpenInventoryPage(me.role, item));
  return (
    <div className="grid gap-4">
      <nav aria-label={t.tabs.overview} className="flex gap-0 overflow-x-auto border-b">
        {tabs.map((item) => {
          const href = INVENTORY_HREFS[item];
          const active = pathname === href;
          return (
            <Link
              key={item}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 border-b-2 px-3 py-2 text-sm ${
                active ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.tabs[item]}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}

export type Warehouse = components["schemas"]["WarehouseResponse"];
export type LabeledWarehouse = Warehouse & { branchName: string | null };

export function warehouseLabel(
  warehouse: Pick<LabeledWarehouse, "name" | "kind" | "branchName">,
  labels: { branchStore: string; centralKitchen: string },
): string {
  if (warehouse.kind === "CENTRAL_KITCHEN") return `${warehouse.name} · ${labels.centralKitchen}`;
  return `${warehouse.branchName || warehouse.name} · ${labels.branchStore}`;
}

function branchTitle(
  branch: { display_name?: string | null; name?: unknown; slug?: string | null },
  locale: LocaleCode,
): string {
  const display = branch.display_name?.trim();
  return display || pickLocale(branch.name, locale) || branch.slug || "";
}

function currentBranchName(branchId: string): string {
  return useScope.getState().branches.find((branch) => branch.id === branchId)?.name ?? "";
}

/** Match X-Branch-ID to the path branch. The client otherwise sends the focused branch and the API rejects the mismatch. */
function forBranch(branchId: string) {
  return {
    async onRequest({ request }: { request: Request }) {
      request.headers.set("x-branch-id", branchId);
      return request;
    },
  };
}

async function branchStores(
  branch: { id: string; name: string },
  locale: LocaleCode,
  fallback: string,
): Promise<LabeledWarehouse[]> {
  const result = await browserApi.GET("/api/v1/inventory/branches/{branch_id}/warehouses", {
    params: { path: { branch_id: branch.id } as unknown as undefined },
    middleware: [forBranch(branch.id)],
  });
  if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, fallback, locale);
  return result.data.items.map((item) => ({ ...item, branchName: branch.name || null }));
}

/**
 * Warehouses this caller may read: every in-scope branch store, plus the brand's central kitchens.
 * There is no brand-wide warehouse list. Branch stores are GET /branches/{id}/warehouses, and that
 * route requires branch access, so a branch admin only receives their own store. Other branches'
 * stores are an API gap — do not invent ids or call branches they cannot open.
 */
export function useBrandWarehouses() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const brandId = useScope((state) => state.brandId);
  const branches = useScope((state) => state.branches);
  const branchKey = branches.map((branch) => branch.id).join(",");
  return useQuery({
    queryKey: ["inventory", "brand-warehouses", brandId, branchKey, locale],
    enabled: Boolean(brandId),
    queryFn: async () => {
      const known = branches.length > 0 ? branches : await listFocusedBranches(brandId ?? "", locale, t.loadFailed);
      const stores = (await Promise.all(known.map((branch) => branchStores(branch, locale, t.loadFailed)))).flat();
      const kitchens = await browserApi.GET("/api/v1/inventory/brands/{brand_id}/central-kitchens", {
        params: { path: { brand_id: brandId ?? "" } },
      });
      if (!kitchens.response.ok || !kitchens.data) throw asApiError(kitchens.error, kitchens.response, t.loadFailed, locale);
      return [
        ...stores,
        ...kitchens.data.items.map((item) => ({ ...item, branchName: null })),
      ];
    },
  });
}

async function listFocusedBranches(brandId: string, locale: LocaleCode, fallback: string) {
  const found: { id: string; name: string }[] = [];
  const limit = 100;
  let offset = 0;
  for (;;) {
    const result = await browserApi.GET("/api/v1/branches", {
      params: { query: { brand_id: brandId, include_inactive: false, limit, offset } },
    });
    if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, fallback, locale);
    for (const branch of result.data) {
      if (branch.brand_id && branch.brand_id !== brandId) continue;
      found.push({ id: branch.id, name: branchTitle(branch, locale) });
    }
    if (result.data.length < limit) return found;
    offset += limit;
  }
}

export function useWarehouses() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const brandId = useScope((state) => state.brandId);
  const branchId = useScope((state) => state.branchId);
  return useQuery({
    queryKey: ["inventory", "warehouses", brandId, branchId, locale],
    enabled: Boolean(brandId && branchId),
    queryFn: async () => {
      const name = currentBranchName(branchId ?? "");
      const branchName = name || (await focusedBranchName(branchId ?? "", locale));
      const stores = await branchStores({ id: branchId ?? "", name: branchName }, locale, t.loadFailed);
      const kitchens = await browserApi.GET("/api/v1/inventory/brands/{brand_id}/central-kitchens", {
        params: { path: { brand_id: brandId ?? "" } },
      });
      if (!kitchens.response.ok || !kitchens.data) throw asApiError(kitchens.error, kitchens.response, t.loadFailed, locale);
      return [...stores, ...kitchens.data.items.map((item) => ({ ...item, branchName: null }))];
    },
  });
}

async function focusedBranchName(branchId: string, locale: LocaleCode): Promise<string> {
  if (!branchId) return "";
  const profile = await browserApi.GET("/api/v1/branches/{branch_id}", {
    params: { path: { branch_id: branchId } },
  });
  if (!profile.response.ok || !profile.data) return "";
  return branchTitle(profile.data, locale);
}

export function useBranchCurrency(enabled = true) {
  const branchId = useScope((state) => state.branchId);
  const brandId = useScope((state) => state.brandId);
  const query = useQuery({
    queryKey: ["branch", branchId, brandId],
    enabled: enabled && Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}", {
        params: { path: { branch_id: branchId ?? "" } },
      });
      if (!result.response.ok || !result.data) return "EGP";
      return result.data.currency || "EGP";
    },
  });
  return query.data || "EGP";
}

export function WarehouseSelect({
  warehouses,
  value,
  onChange,
}: {
  warehouses: LabeledWarehouse[];
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useStaffSection(inventoryCopy);
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{t.warehouse}</span>
      <select className={control} value={value} onChange={(event) => onChange(event.target.value)}>
        {warehouses.map((warehouse) => (
          <option key={warehouse.id} value={warehouse.id}>
            {warehouseLabel(warehouse, t)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function useStaffNames() {
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  return useQuery({
    queryKey: ["inventory", "staff-names", branchId],
    enabled: Boolean(branchId && me && canListStaff(me.role)),
    retry: false,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/branches/{branch_id}/staff", {
        params: { path: { branch_id: branchId ?? "" } },
      });
      if (!result.response.ok || !result.data) return [];
      return result.data.records.map((person) => ({ id: person.id, name: person.full_name }));
    },
  });
}
