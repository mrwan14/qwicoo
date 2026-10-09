import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { LocaleCode } from "@/lib/i18n/locale-text";

type LocaleState = {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
};

const STORAGE_KEY = "qwicoo-locale";

function parseLocale(value: unknown): LocaleCode | null {
  return value === "ar" || value === "en" ? value : null;
}

function localeFromPersistBlob(raw: string | null): LocaleCode | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: { locale?: unknown } };
    return parseLocale(parsed.state?.locale);
  } catch {
    return null;
  }
}

/** Copy a language chosen before this store existed. Runs at import, before other stores rewrite their blobs. */
function seedFromLegacy(): void {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(STORAGE_KEY)) return;
  const legacy =
    localeFromPersistBlob(window.localStorage.getItem("food-workspace")) ??
    localeFromPersistBlob(window.sessionStorage.getItem("guest-session"));
  if (!legacy) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { locale: legacy }, version: 0 }));
}

seedFromLegacy();

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "en",
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ locale: state.locale }),
    },
  ),
);

export function currentLocale(): LocaleCode {
  return useLocaleStore.getState().locale;
}

export function useLocale() {
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const dir = locale === "ar" ? "rtl" : "ltr";
  return { locale, setLocale, dir } as const;
}
