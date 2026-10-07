"use client";

/**
 * Data the till needs offline (menu with prices and modifiers, tables, branch offline settings and
 * pricing rules). Each fetcher keeps an IndexedDB copy and answers from it when the API is unreachable.
 */
import { useQuery } from "@tanstack/react-query";

import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { offlineKeys, withOfflineCopy } from "@/lib/offline/cache";

export type MenuTree = components["schemas"]["MenuTreeResponse"];
export type BranchTable = components["schemas"]["TableDetailResponse"];
export type OfflineConfig = components["schemas"]["BranchOfflineConfig"];

export const offlineQueryKeys = {
  menu: (branchId: string | null) => ["pos-menu", branchId] as const,
  tables: (branchId: string | null) => ["branch-tables", branchId] as const,
  config: (branchId: string | null) => ["offline-config", branchId] as const,
};

export function fetchMenu(branchId: string): Promise<MenuTree> {
  return withOfflineCopy(offlineKeys.menu(branchId), async () => {
    const result = await browserApi.GET("/api/v1/menu/tree", { params: { query: { branch_id: branchId } } });
    if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Menu failed");
    return result.data;
  });
}

export function fetchTables(branchId: string): Promise<BranchTable[]> {
  return withOfflineCopy(offlineKeys.tables(branchId), async () => {
    const result = await browserApi.GET("/api/v1/branches/{branch_id}/tables", { params: { path: { branch_id: branchId } } });
    if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Tables failed");
    return [...result.data].sort((a, b) => a.table_number.localeCompare(b.table_number, undefined, { numeric: true }));
  });
}

export function fetchOfflineConfig(branchId: string): Promise<OfflineConfig> {
  return withOfflineCopy(offlineKeys.branchConfig(branchId), async () => {
    const result = await browserApi.GET("/api/v1/branches/{branch_id}/offline-config", { params: { path: { branch_id: branchId } } });
    if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, "Offline settings failed");
    return result.data;
  });
}

export function useOfflineConfig(branchId: string | null) {
  return useQuery({
    queryKey: offlineQueryKeys.config(branchId),
    enabled: Boolean(branchId),
    staleTime: 5 * 60_000,
    queryFn: () => fetchOfflineConfig(branchId ?? ""),
  });
}
