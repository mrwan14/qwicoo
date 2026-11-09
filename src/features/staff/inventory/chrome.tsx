"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { BranchGate } from "@/components/ops/branch-gate";
import { buttonClass } from "@/components/ops/kit/button";
import { KpiCard } from "@/components/ops/kit/card";
import { formatAmount } from "@/components/ops/kit/money";
import { PageHeader as KitPageHeader } from "@/components/ops/kit/page-header";
import { SegmentedControl } from "@/components/ops/kit/segmented";
import { Tabs } from "@/components/ops/kit/tabs";
import { NestedHeaders } from "@/components/ops/page-header";
import { SettingsFrame } from "@/features/staff/settings/frame";
import { RoleGate } from "@/components/ops/screen";
import { LoadingState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { denyAccess } from "@/lib/auth/session-client";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import type { LocaleCode } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { navCopy } from "@/lib/i18n/staff/nav";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { canListBranches, canListStaff, canOpenInventoryPage, canSeeReports, INVENTORY_HREFS, type InventoryPage } from "./access";
import { formatQty, lineValue } from "./qty";
import { warehouseLabel } from "./transfers";

/** Shared by every inventory screen, so they all take the kit look. */
export const control =
  "h-[42px] w-full rounded-staff border border-border bg-canvas px-3 text-sm text-ink outline-none placeholder:text-disabled focus-visible:border-focus disabled:bg-subtle disabled:text-disabled";
export const primaryButton = buttonClass({ size: "field" });
export const secondaryButton = buttonClass({ variant: "secondary", size: "field" });

export { INVENTORY_HREFS };

type StockTab = "stock" | "recipes" | "buying" | "counts";

/** The four Stock tabs, each a small set of the existing inventory pages. */
// Most-used first: what's in stock, ordering more, counting and waste, then recipe setup.
const STOCK_TABS: readonly { tab: StockTab; views: readonly InventoryPage[] }[] = [
  { tab: "stock", views: ["stock", "movements"] },
  { tab: "buying", views: ["purchaseOrders", "suppliers", "transfers"] },
  { tab: "counts", views: ["counts", "waste"] },
  { tab: "recipes", views: ["recipes", "ingredients", "prep"] },
];
const SETTINGS_VIEWS: readonly InventoryPage[] = ["settings", "units", "import", "jobs"];

type Place =
  | { kind: "stock"; tab: StockTab; views: readonly InventoryPage[] }
  | { kind: "settings"; views: readonly InventoryPage[] }
  | { kind: "reports"; views: readonly InventoryPage[] };

function placeOf(page: InventoryPage): Place {
  if (page === "overview") return { kind: "stock", tab: "stock", views: STOCK_TABS[0].views };
  if (page === "reports") return { kind: "reports", views: ["reports"] };
  if (SETTINGS_VIEWS.includes(page)) return { kind: "settings", views: SETTINGS_VIEWS };
  const found = STOCK_TABS.find((entry) => entry.views.includes(page)) ?? STOCK_TABS[0];
  return { kind: "stock", tab: found.tab, views: found.views };
}

export function InventorySection({ children }: { children: ReactNode }) {
  const nav = useStaffSection(navCopy);
  return (
    <RoleGate href="/app/stock">
      <BranchGate screen={nav.inventory}>{children}</BranchGate>
    </RoleGate>
  );
}

/** Stock value, low and out counts from the branch store, and open purchase orders. */
function StockKpis() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const branchId = useScope((state) => state.branchId);
  const currency = useBranchCurrency();
  const warehouses = useWarehouses();
  const selected = warehouses.data?.[0]?.id ?? "";
  const stock = useQuery({
    queryKey: ["inventory", "stock", selected],
    enabled: Boolean(selected),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/warehouses/{warehouse_id}/stock", { params: { path: { warehouse_id: selected } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      // Same key and shape as the Stock screen, so the two share one request.
      return result.data.items;
    },
  });
  const overview = useQuery({
    queryKey: ["inventory", "branch-overview", branchId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/branches/{branch_id}/overview", {
        params: { path: { branch_id: branchId ?? "" } as unknown as undefined },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data;
    },
  });
  const me = useStaffSession();
  const reports = Boolean(me && canSeeReports(me.role));
  const jobs = useQuery({
    queryKey: ["inventory", "jobs", "FAILED", branchId],
    enabled: reports && Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/inventory/deduction-jobs", { params: { query: { status: "FAILED", branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data.items;
    },
  });
  const rows = stock.data ?? [];
  const value = rows.reduce((sum, row) => sum + Number(lineValue(row.on_hand, row.avg_cost)), 0);
  const loading = warehouses.isLoading || stock.isLoading;
  return (
    <div className="grid grid-cols-1 gap-3">
      {jobs.data && jobs.data.length > 0 ? (
        <p className="flex flex-wrap items-center gap-2 rounded-staff bg-danger-bg px-3 py-2.5 text-sm text-ink" role="status">
          <span aria-hidden className="size-2 rounded-full bg-danger" />
          <span className="font-medium">{t.overview.failedJobs}</span> {formatQty(jobs.data.length, locale)}
          <Link href={INVENTORY_HREFS.jobs} className="font-medium underline underline-offset-4">
            {t.overview.jobsLink}
          </Link>
        </p>
      ) : null}
      {/* Low and out items are listed under "Needs ordering" on the Stock page, so only value and orders here. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard label={t.hub.kpis.value} value={stock.data ? formatAmount(value, currency, locale) : "—"} loading={loading} />
        <KpiCard
          label={t.hub.kpis.openOrders}
          value={overview.data?.pending_purchase_orders != null ? formatQty(overview.data.pending_purchase_orders, locale) : "—"}
          loading={overview.isLoading}
          note={overview.data?.transfers_to_receive ? fill(t.hub.kpis.toReceive, { count: overview.data.transfers_to_receive }) : undefined}
        />
      </div>
    </div>
  );
}

function ViewSwitch({ views, page }: { views: readonly InventoryPage[]; page: InventoryPage }) {
  const t = useStaffSection(inventoryCopy);
  const router = useRouter();
  if (views.length < 2) return null;
  return (
    <SegmentedControl
      label={t.hub.viewLabel}
      value={page === "overview" ? "stock" : page}
      onValueChange={(next) => router.push(INVENTORY_HREFS[next])}
      items={views.map((view) => ({ value: view, label: t.hub.views[view] }))}
    />
  );
}

/**
 * Frame for every inventory page. Stock pages get the four Stock tabs with a view switch;
 * units, import, jobs and rules sit under Settings → Stock; usage under Reports.
 */
export function InventoryFrame({ page, children }: { page: InventoryPage; children: ReactNode }) {
  const t = useStaffSection(inventoryCopy);
  const reports = useStaffSection(reportsCopy);
  const me = useStaffSession();
  const allowed = Boolean(me && canOpenInventoryPage(me.role, page));
  const router = useRouter();
  // Cashier and kitchen open Stock on the one page their job needs (waste, counts) instead of a denial.
  const fallback = me && !allowed ? STOCK_TABS.flatMap((entry) => entry.views).find((view) => canOpenInventoryPage(me.role, view)) : undefined;
  useEffect(() => {
    if (!me || allowed) return;
    if (fallback && (page === "overview" || page === "stock")) router.replace(INVENTORY_HREFS[fallback]);
    else denyAccess();
  }, [me, allowed, fallback, page, router]);
  if (!me) return null;
  if (!allowed) return <LoadingState label={t.loading} />;
  const place = placeOf(page);
  const views = place.views.filter((view) => canOpenInventoryPage(me.role, view));

  if (place.kind === "settings") {
    return (
      <SettingsFrame
        item="stock"
        title={t.hub.settingsTitle}
        subtitle={t.hub.settingsSubtitle}
        tab={page}
        tabs={views.map((view) => ({ value: view, label: t.hub.views[view], href: INVENTORY_HREFS[view] }))}
      >
        {children}
      </SettingsFrame>
    );
  }
  if (place.kind === "reports") {
    return (
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-5">
        <KitPageHeader back={{ href: "/app/reports", label: fill(reports.backTo, { group: reports.groups.stock }) }} title={t.hub.reportsTitle} subtitle={t.hub.reportsSubtitle} />
        <NestedHeaders>{children}</NestedHeaders>
      </div>
    );
  }

  const tabs = STOCK_TABS.map((entry) => ({ ...entry, views: entry.views.filter((view) => canOpenInventoryPage(me.role, view)) })).filter(
    (entry) => entry.views.length > 0,
  );
  return (
    <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-5">
      <KitPageHeader title={t.hub.title} />
      <div className="flex flex-wrap items-end gap-4">
        <Tabs
          label={t.hub.tabsLabel}
          value={place.tab}
          className="min-w-0 flex-1 basis-full md:basis-auto"
          items={tabs.map((entry) => ({ value: entry.tab, label: t.hub.tabs[entry.tab], href: INVENTORY_HREFS[entry.views[0]] }))}
        />
        <ViewSwitch views={views} page={page} />
      </div>
      {place.tab === "stock" ? <StockKpis /> : null}
      <NestedHeaders>{children}</NestedHeaders>
    </div>
  );
}

export type Warehouse = components["schemas"]["WarehouseResponse"];
export type LabeledWarehouse = Warehouse & { branchName: unknown };

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
  branch: { id: string; name: unknown },
  locale: LocaleCode,
  fallback: string,
): Promise<LabeledWarehouse[]> {
  const result = await browserApi.GET("/api/v1/inventory/branches/{branch_id}/warehouses", {
    params: { path: { branch_id: branch.id } as unknown as undefined },
    middleware: [forBranch(branch.id)],
  });
  if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, fallback, locale);
  return result.data.items.map((item) => ({ ...item, branchName: branch.name ?? null }));
}

/**
 * Warehouses this caller may read: every in-scope branch store, plus the brand's central kitchens.
 * Branch stores are GET /branches/{id}/warehouses, and that route requires branch access, so a
 * branch admin only receives their own store. Transfer targets are a different list
 * (GET /brands/{id}/transfer-destinations); do not invent ids here.
 */
export function useBrandWarehouses() {
  const t = useStaffSection(inventoryCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const brandId = useScope((state) => state.brandId);
  const branchId = useScope((state) => state.branchId);
  const branches = useScope((state) => state.branches);
  const branchKey = branches.map((branch) => branch.id).join(",");
  const listBranches = canListBranches(me?.role);
  return useQuery({
    queryKey: ["inventory", "brand-warehouses", brandId, branchKey, branchId, me?.role, locale],
    enabled: Boolean(brandId && me),
    queryFn: async () => {
      let known: { id: string; name: unknown }[];
      if (!listBranches) {
        const focused = branches.find((branch) => branch.id === branchId);
        known = focused ? [focused] : branchId ? [{ id: branchId, name: "" }] : [];
      } else {
        let listed: { id: string; name: unknown }[] = [];
        try {
          listed = await listFocusedBranches(brandId ?? "", locale, t.loadFailed);
        } catch (error) {
          if (branches.length === 0) throw error;
        }
        const rawNames = new Map(listed.map((branch) => [branch.id, branch.name]));
        const scope = branches.length > 0 ? branches : listed;
        known = scope.map((branch) => ({ id: branch.id, name: rawNames.get(branch.id) ?? branch.name }));
      }
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
  const found: { id: string; name: unknown }[] = [];
  const limit = 100;
  let offset = 0;
  for (;;) {
    const result = await browserApi.GET("/api/v1/branches", {
      params: { query: { brand_id: brandId, include_inactive: false, limit, offset } },
    });
    if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, fallback, locale);
    for (const branch of result.data) {
      if (branch.brand_id && branch.brand_id !== brandId) continue;
      found.push({ id: branch.id, name: branch.name });
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
      const branchName = (await branchNameValue(branchId ?? "")) ?? currentBranchName(branchId ?? "");
      const stores = await branchStores({ id: branchId ?? "", name: branchName }, locale, t.loadFailed);
      const kitchens = await browserApi.GET("/api/v1/inventory/brands/{brand_id}/central-kitchens", {
        params: { path: { brand_id: brandId ?? "" } },
      });
      if (!kitchens.response.ok || !kitchens.data) throw asApiError(kitchens.error, kitchens.response, t.loadFailed, locale);
      return [...stores, ...kitchens.data.items.map((item) => ({ ...item, branchName: null }))];
    },
  });
}

async function branchNameValue(branchId: string): Promise<unknown> {
  if (!branchId) return null;
  const profile = await browserApi.GET("/api/v1/branches/{branch_id}", {
    params: { path: { branch_id: branchId } },
  });
  if (!profile.response.ok || !profile.data) return null;
  return profile.data.name ?? null;
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
  const { locale } = useLocale();
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-ink-secondary">{t.warehouse}</span>
      <select className={control} value={value} onChange={(event) => onChange(event.target.value)}>
        {warehouses.map((warehouse) => (
          <option key={warehouse.id} value={warehouse.id}>
            {warehouseLabel(warehouse, locale, t)}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Forms opened from a link (?new=1, ?ingredient=) drop the query once closed, so a refresh or
 * Back doesn't open them again.
 */
export function useClearLink() {
  const router = useRouter();
  return () => {
    if (window.location.search) router.replace(window.location.pathname, { scroll: false });
  };
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
