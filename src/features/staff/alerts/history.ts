"use client";

import { create } from "zustand";

import type { AlertKind } from "./diff";

export const HISTORY_CAP = 50;

export type AlertEntry = {
  id: string;
  kind: AlertKind;
  title: string;
  /** Screen that handles it. */
  href: string;
  at: number;
};

type AlertHistory = {
  entries: AlertEntry[];
  /** Alerts that came in since the panel was last opened. */
  unread: number;
  /** A bell panel is open (reported by the bell), so new alerts count as seen. */
  panelOpen: boolean;
  /** Bumped by a toast's "View". The bell that is on screen opens itself (headers render one per layout). */
  openRequest: number;
  add: (entries: Omit<AlertEntry, "id">[]) => void;
  setPanelOpen: (open: boolean) => void;
  requestOpen: () => void;
  clear: () => void;
};

let seq = 0;

/** This tab's recent alerts, newest first. Kept in memory: a reload starts empty. */
export const useAlertHistory = create<AlertHistory>()((set) => ({
  entries: [],
  unread: 0,
  panelOpen: false,
  openRequest: 0,
  add: (incoming) =>
    set((state) => {
      if (incoming.length === 0) return state;
      const fresh = incoming.map((entry) => ({ ...entry, id: `${entry.at}-${(seq += 1)}` })).reverse();
      return {
        entries: [...fresh, ...state.entries].slice(0, HISTORY_CAP),
        unread: state.panelOpen ? 0 : Math.min(state.unread + incoming.length, 99),
      };
    }),
  setPanelOpen: (panelOpen) => set((state) => ({ panelOpen, unread: panelOpen ? 0 : state.unread })),
  requestOpen: () => set((state) => ({ openRequest: state.openRequest + 1 })),
  clear: () => set({ entries: [], unread: 0 }),
}));
