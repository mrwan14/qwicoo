/** fetch for staff endpoints the generated schema does not list yet: scope headers, locale, friendly errors. */
import { asApiError } from "@/lib/api/error";
import { endStaffSession } from "@/lib/auth/session-client";
import { currentLocale } from "@/lib/i18n/locale-store";
import { useScope } from "@/stores/scope";

export async function staffJson<T>(path: string, init: RequestInit, fallback: string): Promise<T> {
  const { brandId, branchId } = useScope.getState();
  const locale = currentLocale();
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  headers.set("accept-language", locale);
  if (brandId && !headers.has("x-brand-id")) headers.set("x-brand-id", brandId);
  // A report can ask about a branch other than the one in the top bar.
  if (branchId && !headers.has("x-branch-id")) headers.set("x-branch-id", branchId);
  const response = await fetch(path, { ...init, headers, credentials: "include", cache: "no-store" });
  if (response.status === 401) void endStaffSession();
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw asApiError(payload, response, fallback, locale);
  return payload as T;
}

export function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
