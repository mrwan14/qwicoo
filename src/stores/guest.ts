import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { GuestBranding } from "@/lib/guest/branding";
import type { LocaleCode } from "@/lib/i18n/locale-text";

export type GuestSession = {
  sessionId: string;
  branchId: string;
  brandId: string | null;
  tableId: string | null;
  tableNumber: string | null;
  branchName: string | null;
  /** False when the guest joined without a location or PIN match; staff confirm their orders. */
  presenceVerified?: boolean;
};

type GuestState = {
  locale: LocaleCode;
  guestName: string;
  session: GuestSession | null;
  branding: GuestBranding | null;
  setLocale: (locale: LocaleCode) => void;
  setGuestName: (guestName: string) => void;
  setSession: (session: GuestSession | null) => void;
  setBranding: (branding: GuestBranding | null) => void;
  clear: () => void;
};

export const useGuest = create<GuestState>()(
  persist(
    (set) => ({
      locale: "en",
      guestName: "",
      session: null,
      branding: null,
      setLocale: (locale) => set({ locale }),
      setGuestName: (guestName) => set({ guestName }),
      setSession: (session) => set({ session }),
      setBranding: (branding) => set({ branding }),
      clear: () => set({ session: null, branding: null }),
    }),
    {
      name: "guest-session",
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
      partialize: (state) => ({
        locale: state.locale,
        guestName: state.guestName,
        session: state.session,
        branding: state.branding,
      }),
    },
  ),
);
