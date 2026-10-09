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
  setPushEnabled: (on: boolean) => void;
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
      setPushEnabled: (pushEnabled) => set({ pushEnabled }),
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
        } as WorkspaceState;
      },
      partialize: (state) => ({
        soundEnabled: state.soundEnabled,
        soundChosen: state.soundChosen,
        adminOrderAlerts: state.adminOrderAlerts,
        pushEnabled: state.pushEnabled,
      }),
    },
  ),
);
