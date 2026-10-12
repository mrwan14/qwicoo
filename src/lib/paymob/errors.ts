import { ApiError, asApiError } from "@/lib/api/error";
import { fill } from "@/lib/i18n/dictionary";
import type { LocaleCode } from "@/lib/i18n/locale-text";

const CURRENCY = {
  en: "Paymob is set to {gateway}, but this branch uses {branch}.",
  ar: "Paymob مضبوط على {gateway}، بينما هذا الفرع يستخدم {branch}.",
} as const;

export function currencyMismatch(error: unknown): { gateway: string; branch: string } | null {
  if (!error || typeof error !== "object" || !("detail" in error)) return null;
  const detail = error.detail;
  if (!detail || typeof detail !== "object" || !("code" in detail)) return null;
  if (detail.code !== "PAYMOB_CURRENCY_MISMATCH") return null;
  if (!("gateway_currency" in detail) || !("branch_currency" in detail)) return null;
  if (typeof detail.gateway_currency !== "string" || typeof detail.branch_currency !== "string") return null;
  return { gateway: detail.gateway_currency, branch: detail.branch_currency };
}

export function paymobError(error: unknown, response: Response, fallback: string, locale: LocaleCode): ApiError {
  const mismatch = currencyMismatch(error);
  if (mismatch) {
    return new ApiError(response.status, fill(CURRENCY[locale], mismatch), "PAYMOB_CURRENCY_MISMATCH");
  }
  return asApiError(error, response, fallback, locale);
}
