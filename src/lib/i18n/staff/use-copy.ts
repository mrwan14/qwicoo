"use client";

import { useLocale } from "@/lib/i18n/locale-store";
import type { LocaleCode } from "@/lib/i18n/locale-text";

export function useStaffSection<T>(copy: Record<LocaleCode, T>): T {
  const { locale } = useLocale();
  return copy[locale];
}
