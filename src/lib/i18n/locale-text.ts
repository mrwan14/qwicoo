export type LocaleCode = "en" | "ar";

export function pickLocale(value: unknown, locale: LocaleCode = "en"): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (!value || typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  const preferred = record[locale];
  const alternate = locale === "en" ? record.ar : record.en;
  const chosen = preferred ?? alternate ?? record.en ?? record.ar;
  return typeof chosen === "string" ? chosen : "";
}
