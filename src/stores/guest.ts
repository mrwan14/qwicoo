import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { GuestBranding } from "@/lib/guest/branding";
import type { LocaleCode } from "@/lib/i18n/locale-text";

export type GuestSession = {
  sessionId: string;
  /** Per-diner id from the guest JWT (shared table cart attribution). */
  guestId: string | null;
  branchId: string;
  brandId: string | null;
  tableId: string | null;
  tableNumber: string | null;
  branchName: string | null;
  /** True when this guest proved presence (geofence or PIN). */
  presenceVerified?: boolean;
};

type GuestState = {
  locale: LocaleCode;
  guestName: string;
  session: GuestSession | null;
  branding: GuestBranding | null;
  /** QR token from /t/{token}, kept so a dropped session can rejoin. */
  tableToken: string | null;
  /** Order that already asked for cash collection, so pay buttons stay hidden. */
  cashRequestedOrderId: string | null;
  setLocale: (locale: LocaleCode) => void;
  setGuestName: (guestName: string) => void;
  setSession: (session: GuestSession | null) => void;
  setBranding: (branding: GuestBranding | null) => void;
  setTableToken: (tableToken: string | null) => void;
  setCashRequestedOrderId: (orderId: string | null) => void;
  clear: () => void;
};

export const useGuest = create<GuestState>()(
  persist(
    (set) => ({
      locale: "en",
      guestName: "",
      session: null,
      branding: null,
      tableToken: null,
      cashRequestedOrderId: null,
      setLocale: (locale) => set({ locale }),
      setGuestName: (guestName) => set({ guestName }),
      setSession: (session) => set({ session }),
      setBranding: (branding) => set({ branding }),
      setTableToken: (tableToken) => set({ tableToken }),
      setCashRequestedOrderId: (cashRequestedOrderId) => set({ cashRequestedOrderId }),
      clear: () => set({ session: null, branding: null, tableToken: null, cashRequestedOrderId: null }),
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
        tableToken: state.tableToken,
        cashRequestedOrderId: state.cashRequestedOrderId,
      }),
    },
  ),
);
