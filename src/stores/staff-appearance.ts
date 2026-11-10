"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type StaffAppearance = "light" | "dark" | "system";

/** Each person's own choice, kept on this device: a kitchen screen can be dark while the office stays light. */
export const useStaffAppearance = create<{ mode: StaffAppearance; setMode: (mode: StaffAppearance) => void }>()(
  persist(
    (set) => ({
      mode: "light",
      setMode: (mode) => set({ mode }),
    }),
    { name: "qwicoo-staff-appearance", storage: createJSONStorage(() => localStorage) },
  ),
);

/** True when the dashboard should draw dark, following the device for "Match device". */
export function useStaffDark(): boolean {
  const mode = useStaffAppearance((state) => state.mode);
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return mode === "dark" || (mode === "system" && systemDark);
}
