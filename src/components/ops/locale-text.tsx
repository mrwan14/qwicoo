import { pickLocale, type LocaleCode } from "@/lib/i18n/locale-text";

export function LocaleText({
  value,
  locale = "en",
}: {
  value: unknown;
  locale?: LocaleCode;
}) {
  return <>{pickLocale(value, locale)}</>;
}
