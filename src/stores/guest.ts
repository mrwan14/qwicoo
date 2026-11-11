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
  /** Guest-safe Paymob flag. Absent until the API says the brand accepts online payments. */
  onlinePayments?: { paymob: true };
};

type GuestState = {
  locale: LocaleCode;
  guestName: string;
  session: GuestSession | null;
  branding: GuestBranding | null;
  /** QR token from /t/{token}, kept so a dropped session can rejoin. */
  tableToken: string | null;
  /** What the QR says before the guest joins: the menu is browsable, ordering waits for presence. */
  tablePreview: { branchId: string; tableNumber: string; branchName: string; orderingPaused?: boolean } | null;
  /** True once the guest (or their phone language) picked a language, so we stop guessing. */
  localeChosen: boolean;
  /** Order that already asked for cash collection, so pay buttons stay hidden. */
  cashRequestedOrderId: string | null;
  /** The visit that just closed (paid, staff, idle): the thank-you screen shows its receipt. */
  endedVisit: { sessionId: string; tableNumber: string | null } | null;
  setLocale: (locale: LocaleCode) => void;
  setGuestName: (guestName: string) => void;
  setSession: (session: GuestSession | null) => void;
  setBranding: (branding: GuestBranding | null) => void;
  setTableToken: (tableToken: string | null) => void;
  setTablePreview: (tablePreview: GuestState["tablePreview"]) => void;
  setCashRequestedOrderId: (orderId: string | null) => void;
  setEndedVisit: (endedVisit: GuestState["endedVisit"]) => void;
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
      tablePreview: null,
      localeChosen: false,
      cashRequestedOrderId: null,
      endedVisit: null,
      setLocale: (locale) => set({ locale, localeChosen: true }),
      setGuestName: (guestName) => set({ guestName }),
      setSession: (session) => set({ session }),
      setBranding: (branding) => set({ branding }),
      setTableToken: (tableToken) => set({ tableToken }),
      setTablePreview: (tablePreview) => set({ tablePreview }),
      setCashRequestedOrderId: (cashRequestedOrderId) => set({ cashRequestedOrderId }),
      setEndedVisit: (endedVisit) => set({ endedVisit }),
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
        tablePreview: state.tablePreview,
        localeChosen: state.localeChosen,
        cashRequestedOrderId: state.cashRequestedOrderId,
        endedVisit: state.endedVisit,
      }),
    },
  ),
);
