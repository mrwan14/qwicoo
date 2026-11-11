import { ApiError, asApiError } from "@/lib/api/error";
import { currentLocale } from "@/lib/i18n/locale-store";
import type { LocaleCode } from "@/lib/i18n/locale-text";
import { useScope } from "@/stores/scope";

export * from "./import-rows";

function scopeHeaders(): Headers {
  const headers = new Headers({ "accept-language": currentLocale() });
  const { brandId, branchId } = useScope.getState();
  if (brandId) headers.set("x-brand-id", brandId);
  if (branchId) headers.set("x-branch-id", branchId);
  return headers;
}

/** Sends an Excel or CSV file to preview-file or commit-file. */
export async function sendImportFile<T>(
  kind: "preview-file" | "commit-file",
  input: { brandId: string; file: File; warehouseId?: string | null },
  failed: string,
  locale: LocaleCode,
): Promise<T> {
  const body = new FormData();
  body.set("file", input.file, input.file.name);
  if (input.warehouseId) body.set("warehouse_id", input.warehouseId);
  const response = await fetch(`/api/v1/inventory/imports/${kind}?brand_id=${encodeURIComponent(input.brandId)}`, {
    method: "POST",
    body,
    headers: scopeHeaders(),
    credentials: "include",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw asApiError(payload, response, failed, locale);
  return payload as T;
}

/** Downloads a file the API builds (template or export) under the API's file name. */
export async function downloadFromApi(path: string, query: Record<string, string>, fallbackName: string, failed: string, locale: LocaleCode) {
  const search = new URLSearchParams(query).toString();
  const response = await fetch(`/api/v1${path}?${search}`, { headers: scopeHeaders(), credentials: "include" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw asApiError(payload, response, failed, locale);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** The API's error code, when there is one (CSV_HEADER_MISSING, FILE_UNREADABLE, ...). */
export function importErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  return error.code ?? (/^[A-Z_]+$/.test(error.message) ? error.message : null);
}
