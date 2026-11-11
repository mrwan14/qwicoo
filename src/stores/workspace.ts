import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Device preferences only. Brand and branch scope live in `useScope`, from `/auth/me`. Language lives in `useLocale`. */
type WorkspaceState = {
  /** Alert and kitchen sound. Only meaningful once `soundChosen` is true; until then the role default applies. */
  soundEnabled: boolean;
  /** The person has set sound themselves on this device. */
  soundChosen: boolean;
  /** Super, brand and branch admins: opt in to staff order alerts. Off by default. */
  adminOrderAlerts: boolean;
  /** This device asked for web push notifications. */
  pushEnabled: boolean;
  /** The one-time "turn on notifications" suggestion was shown on this device. */
  pushPrompted: boolean;
  /** "My tables" per branch: table numbers this person covers on this device. Empty means all. */
  myTables: Record<string, string[]>;
  setPushEnabled: (on: boolean) => void;
  setPushPrompted: () => void;
  setMyTables: (branchId: string, tables: string[]) => void;
  setSoundEnabled: (soundEnabled: boolean) => void;
  setAdminOrderAlerts: (on: boolean) => void;
};

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set) => ({
      soundEnabled: true,
      soundChosen: false,
      adminOrderAlerts: false,
      pushEnabled: false,
      pushPrompted: false,
      myTables: {},
      setPushEnabled: (pushEnabled) => set({ pushEnabled }),
      setPushPrompted: () => set({ pushPrompted: true }),
      setMyTables: (branchId, tables) => set((state) => ({ myTables: { ...state.myTables, [branchId]: tables } })),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled, soundChosen: true }),
      setAdminOrderAlerts: (adminOrderAlerts) => set({ adminOrderAlerts }),
    }),
    {
      name: "food-workspace",
      version: 2,
      skipHydration: true,
      migrate: (persisted, version) => {
        const old = (persisted ?? {}) as Partial<WorkspaceState>;
        // v1 stored a kitchen sound choice: keep it, so anyone who turned sound off stays muted.
        const fromV1 = version < 2;
        return {
          soundEnabled: old.soundEnabled ?? (fromV1 ? false : true),
          soundChosen: fromV1 ? true : (old.soundChosen ?? false),
          adminOrderAlerts: old.adminOrderAlerts ?? false,
          pushEnabled: old.pushEnabled ?? false,
          pushPrompted: old.pushPrompted ?? false,
          myTables: old.myTables ?? {},
        } as WorkspaceState;
      },
      partialize: (state) => ({
        soundEnabled: state.soundEnabled,
        soundChosen: state.soundChosen,
        adminOrderAlerts: state.adminOrderAlerts,
        pushEnabled: state.pushEnabled,
        pushPrompted: state.pushPrompted,
        myTables: state.myTables,
      }),
    },
  ),
);
