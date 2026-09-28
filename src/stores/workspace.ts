import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { LocaleCode } from "@/lib/i18n/locale-text";

/** Device preferences only. Brand and branch scope live in `useScope`, from `/auth/me`. */
type WorkspaceState = {
  locale: LocaleCode;
  soundEnabled: boolean;
  setLocale: (locale: LocaleCode) => void;
  setSoundEnabled: (soundEnabled: boolean) => void;
};

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set) => ({
      locale: "en",
      soundEnabled: false,
      setLocale: (locale) => set({ locale }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
    }),
    {
      name: "food-workspace",
      version: 1,
      skipHydration: true,
      migrate: (persisted) => {
        const old = (persisted ?? {}) as Partial<WorkspaceState>;
        return { locale: old.locale ?? "en", soundEnabled: old.soundEnabled ?? false } as WorkspaceState;
      },
      partialize: (state) => ({
        locale: state.locale,
        soundEnabled: state.soundEnabled,
      }),
    },
  ),
);
