import type { LocaleCode } from "@/lib/i18n/locale-text";

/**
 * `?lang=` wins. Without it the page opens in Arabic, unless the browser's
 * first preferred language is English.
 */
export function pickLandingLocale(lang: string | string[] | undefined, acceptLanguage: string | null): LocaleCode {
  const candidate = Array.isArray(lang) ? lang[0] : lang;
  if (candidate === "ar" || candidate === "en") return candidate;
  const first = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("en") ? "en" : "ar";
}
