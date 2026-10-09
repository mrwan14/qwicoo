"use client";

import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale, type LocaleCode } from "@/lib/i18n/locale-text";

export function LocaleText({
  value,
  locale,
}: {
  value: unknown;
  locale?: LocaleCode;
}) {
  const current = useLocale().locale;
  return <>{pickLocale(value, locale ?? current)}</>;
}
