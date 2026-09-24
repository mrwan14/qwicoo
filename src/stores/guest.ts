import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { LocaleCode } from "@/lib/i18n/locale-text";

export type GuestSession = {
  sessionId: string;
  branchId: string;
  brandId: string | null;
  tableId: string | null;
  tableNumber: string | null;
  branchName: string | null;
};

type GuestState = {
  locale: LocaleCode;
  guestName: string;
  session: GuestSession | null;
  setLocale: (locale: LocaleCode) => void;
  setGuestName: (guestName: string) => void;
  setSession: (session: GuestSession | null) => void;
  clear: () => void;
};

export const useGuest = create<GuestState>()(
  persist(
    (set) => ({
      locale: "en",
      guestName: "",
      session: null,
      setLocale: (locale) => set({ locale }),
      setGuestName: (guestName) => set({ guestName }),
      setSession: (session) => set({ session }),
      clear: () => set({ session: null }),
    }),
    {
      name: "guest-session",
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
      partialize: (state) => ({
        locale: state.locale,
        guestName: state.guestName,
        session: state.session,
      }),
    },
  ),
);
