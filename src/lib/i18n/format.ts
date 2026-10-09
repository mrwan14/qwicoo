import type { LocaleCode } from "@/lib/i18n/locale-text";

const NUMBERING = "latn" as const;

function moneyLocale(locale: string): string {
  if (locale === "ar" || locale.startsWith("ar")) return "ar-EG";
  return locale || "en";
}

function timeLocale(locale: string): string {
  if (locale === "ar" || locale.startsWith("ar")) return "ar-EG";
  if (locale === "en") return "en-GB";
  return locale || "en-GB";
}

/** Display an API decimal string. Do not use this for arithmetic. Digits stay Western in both languages. */
export function formatMoney(amount: string, currency?: string | null, locale: LocaleCode | string = "en"): string {
  const code = currency?.trim() || "EGP";
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  try {
    return new Intl.NumberFormat(moneyLocale(locale), {
      style: "currency",
      currency: code,
      currencyDisplay: "code",
      numberingSystem: NUMBERING,
    }).format(value);
  } catch {
    return `${amount} ${code}`;
  }
}

/** Show an API timestamp in Africa/Cairo. Do not use this for arithmetic. */
export function formatCairoDateTime(value: string | null | undefined, locale: LocaleCode | string = "en-GB"): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(timeLocale(locale), {
    timeZone: "Africa/Cairo",
    dateStyle: "medium",
    timeStyle: "short",
    numberingSystem: NUMBERING,
  }).format(date);
}

export function formatCount(value: number, locale: LocaleCode | string = "en"): string {
  return new Intl.NumberFormat(moneyLocale(locale), {
    numberingSystem: NUMBERING,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Order and pickup numbers: Western digits, no thousands separators. */
export function formatCode(value: string | number, locale: LocaleCode | string = "en"): string {
  const text = String(value);
  if (!/^\d+$/.test(text)) return text;
  return new Intl.NumberFormat(moneyLocale(locale), {
    numberingSystem: NUMBERING,
    useGrouping: false,
  }).format(Number(text));
}
