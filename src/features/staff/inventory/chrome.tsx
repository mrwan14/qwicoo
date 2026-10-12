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
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { navCopy } from "@/lib/i18n/staff/nav";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { canOpenInventoryPage, INVENTORY_HREFS, type InventoryPage } from "./access";

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

export function useWarehouses() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const brandId = useScope((state) => state.brandId);
  const branchId = useScope((state) => state.branchId);
  return useQuery({
    queryKey: ["inventory", "warehouses", brandId, branchId],
    enabled: Boolean(brandId && branchId),
    queryFn: async () => {
      const branch = await browserApi.GET("/api/v1/inventory/branches/{branch_id}/warehouses", {
        params: { path: { branch_id: branchId ?? "" } as unknown as undefined },
      });
      if (!branch.response.ok || !branch.data) throw asApiError(branch.error, branch.response, t.loadFailed, locale);
      const kitchens = await browserApi.GET("/api/v1/inventory/brands/{brand_id}/central-kitchens", {
        params: { path: { brand_id: brandId ?? "" } },
      });
      if (!kitchens.response.ok || !kitchens.data) throw asApiError(kitchens.error, kitchens.response, t.loadFailed, locale);
      return [...branch.data.items, ...kitchens.data.items];
    },
  });
}

export function useBranchCurrency() {
  const branchId = useScope((state) => state.branchId);
  const brandId = useScope((state) => state.brandId);
  const query = useQuery({
    queryKey: ["branch", branchId, brandId],
    enabled: Boolean(branchId),
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
  warehouses: Warehouse[];
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
            {warehouse.name} · {warehouse.kind === "CENTRAL_KITCHEN" ? t.centralKitchen : t.branchStore}
          </option>
        ))}
      </select>
    </label>
  );
}

export function useStaffNames() {
  const branchId = useScope((state) => state.branchId);
  return useQuery({
    queryKey: ["inventory", "staff-names", branchId],
    enabled: Boolean(branchId),
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
