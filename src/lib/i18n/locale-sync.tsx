"use client";

import { useEffect, useState } from "react";

import { useLocaleStore } from "@/lib/i18n/locale-store";
import type { LocaleCode } from "@/lib/i18n/locale-text";

function applyDocumentLocale(locale: LocaleCode) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
}

/** Keep `<html lang dir>` aligned with the persisted locale after hydration. */
export function LocaleSync() {
  const locale = useLocaleStore((state) => state.locale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void Promise.resolve(useLocaleStore.persist.rehydrate()).then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyDocumentLocale(locale);
  }, [locale, ready]);

  return null;
}

/** Landing `?lang=` wins for that visit and is remembered for the rest of the browser. */
export function RememberLocale({ locale }: { locale: LocaleCode }) {
  const setLocale = useLocaleStore((state) => state.setLocale);

  useEffect(() => {
    setLocale(locale);
    applyDocumentLocale(locale);
  }, [locale, setLocale]);

  return null;
}
