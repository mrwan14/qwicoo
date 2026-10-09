"use client";

import { useLocale } from "@/lib/i18n/locale-store";

export function LocaleSwitch({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const next = locale === "ar" ? "en" : "ar";
  const label = locale === "ar" ? "English" : "العربية";
  const aria = locale === "ar" ? "Switch to English" : "التبديل إلى العربية";

  return (
    <button
      type="button"
      className={className ?? "min-h-11 rounded-lg px-3 text-sm hover:bg-muted"}
      aria-label={aria}
      onClick={() => setLocale(next)}
    >
      {label}
    </button>
  );
}
