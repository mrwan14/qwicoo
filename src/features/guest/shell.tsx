"use client";

import { useEffect, type ReactNode } from "react";

import { guestCopy } from "@/features/guest/copy";
import { useGuest } from "@/stores/guest";

export function useGuestCopy() {
  const locale = useGuest((state) => state.locale);
  const setLocale = useGuest((state) => state.setLocale);
  const dir = locale === "ar" ? "rtl" : "ltr";
  return { t: guestCopy[locale], locale, dir, setLocale };
}

export function GuestShell({ children }: { children: ReactNode }) {
  const { t, locale, dir, setLocale } = useGuestCopy();

  useEffect(() => {
    void useGuest.persist.rehydrate();
  }, []);

  return (
    <div dir={dir} lang={locale} className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <header className="flex items-center justify-between gap-3 px-4 py-4">
        <p className="font-display text-2xl">Qwicoo</p>
        <button
          type="button"
          className="min-h-11 rounded-lg border px-3 text-sm"
          onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
        >
          {t.language}
        </button>
      </header>
      <div className="mx-auto w-full max-w-3xl px-4 py-4 pb-28">{children}</div>
    </div>
  );
}
