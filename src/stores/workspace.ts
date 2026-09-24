import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { LocaleCode } from "@/lib/i18n/locale-text";

type WorkspaceState = {
  brandId: string | null;
  branchId: string | null;
  locale: LocaleCode;
  soundEnabled: boolean;
  setBrandId: (brandId: string | null) => void;
  setBranchId: (branchId: string | null) => void;
  setLocale: (locale: LocaleCode) => void;
  setSoundEnabled: (soundEnabled: boolean) => void;
  clear: () => void;
};

const initial = {
  brandId: null,
  branchId: null,
  locale: "en" as const,
  soundEnabled: false,
};

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set) => ({
      ...initial,
      setBrandId: (brandId) => set({ brandId }),
      setBranchId: (branchId) => set({ branchId }),
      setLocale: (locale) => set({ locale }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      clear: () => set(initial),
    }),
    {
      name: "food-workspace",
      skipHydration: true,
      partialize: (state) => ({
        brandId: state.brandId,
        branchId: state.branchId,
        locale: state.locale,
        soundEnabled: state.soundEnabled,
      }),
    },
  ),
);
