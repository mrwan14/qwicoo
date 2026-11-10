"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import type { Middleware } from "openapi-fetch";

import type { MenuItemFlags } from "@/features/staff/menu-permissions";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { presignedUploadUrl } from "@/lib/media";
import type { menuCopy } from "@/lib/i18n/staff/menu";
import { useScope } from "@/stores/scope";

export const STATIONS = ["HOT_KITCHEN", "COLD_KITCHEN", "BEVERAGE", "DESSERT"] as const;
export type Station = (typeof STATIONS)[number];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

export type MenuItem = components["schemas"]["MenuItemResponse"] & {
  scope?: components["schemas"]["MenuItemScope"] | null;
  brand_id?: string | null;
};
export type MenuText = (typeof menuCopy)["en"];

const BRAND_CATALOG_KEY = "qwicoo-brand-catalog-items";

export function readKnownBrandCatalogIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(BRAND_CATALOG_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function rememberBrandCatalogId(id: string) {
  if (typeof window === "undefined") return;
  const next = readKnownBrandCatalogIds();
  next.add(id);
  window.sessionStorage.setItem(BRAND_CATALOG_KEY, JSON.stringify([...next]));
}

export function flagsForItem(item: MenuItem, knownBrandIds: Set<string>): MenuItemFlags {
  const brandCatalog =
    knownBrandIds.has(item.id) ||
    (typeof item.brand_id === "string" && item.brand_id.length > 0) ||
    item.scope === "ALL_BRANCHES";
  return { scope: item.scope, brandCatalog };
}

export function names(en: string, ar: string) {
  return { en, ar };
}

export async function uploadMenuImage(
  file: File,
  folder: "items" | "general",
  errors: Pick<MenuText, "imageBadType" | "imageTooBig" | "imageUpload">,
): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error(errors.imageBadType);
  if (file.size > 5 * 1024 * 1024) throw new Error(errors.imageTooBig);
  const body: components["schemas"]["PresignedUrlRequest"] = {
    filename: file.name || "image.png",
    content_type: file.type,
    folder,
  };
  const signed = await browserApi.POST("/api/v1/media/presigned-url", { body });
  if (!signed.response.ok || !signed.data) throw asApiError(signed.error, signed.response, errors.imageUpload);
  const uploaded = await fetch(presignedUploadUrl(signed.data.upload_url), {
    method: "PUT",
    body: file,
    headers: { "content-type": file.type },
  });
  if (!uploaded.ok) throw new Error(errors.imageUpload);
  return signed.data.public_url;
}

export function stationCode(name: string): string | null {
  const code = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 50);
  return /^[A-Z0-9_]{2,50}$/.test(code) ? code : null;
}

/** Sends one call as another of the caller's branches (the header otherwise follows the active branch). */
export function asBranch(branchId: string): Middleware {
  return {
    onRequest({ request }) {
      request.headers.set("x-branch-id", branchId);
      return request;
    },
  };
}

async function fetchTree(branchId: string, failed: string) {
  const result = await browserApi.GET("/api/v1/menu/tree", {
    params: { query: { branch_id: branchId } },
    middleware: [asBranch(branchId)],
  });
  if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, failed);
  return result.data;
}

export function useMenuTree(failed: string) {
  const branchId = useScope((state) => state.branchId);
  return useQuery({
    queryKey: ["menu-tree", branchId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/menu/tree", { params: { query: { branch_id: branchId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, failed);
      return result.data;
    },
  });
}

/** The menu as each of the caller's branches sees it: that branch's price and availability. */
export function useBranchTrees(enabled: boolean, failed: string) {
  const branches = useScope((state) => state.branches);
  return useQueries({
    queries: branches.map((branch) => ({
      queryKey: ["menu-tree", branch.id],
      enabled,
      queryFn: () => fetchTree(branch.id, failed),
    })),
  });
}

export function findItem(tree: components["schemas"]["MenuTreeResponse"] | undefined, itemId: string): MenuItem | null {
  for (const category of tree?.categories ?? []) {
    const item = (category.items ?? []).find((entry) => entry.id === itemId);
    if (item) return item as MenuItem;
  }
  return null;
}

/** Brand menus (on and off), with is_live worked out in the current branch's local time. */
export function useBrandMenus(failed: string, enabled = true) {
  const brandId = useScope((state) => state.brandId);
  const branchId = useScope((state) => state.branchId);
  return useQuery({
    queryKey: ["menus", brandId, branchId, "all"],
    enabled: enabled && Boolean(brandId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/menus", { params: { query: { active_only: false, branch_id: branchId ?? undefined } } });
      if (result.response.status === 404) return [];
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, failed);
      return result.data;
    },
  });
}
