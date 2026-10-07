/**
 * Whether the staff app can reach the Qwicoo API right now. Fed by the browser's online/offline
 * events, every API response (via the browserApi middleware), and the health check.
 */
import { create } from "zustand";

type NetworkState = {
  online: boolean;
  /** Last time an API call succeeded (ms). */
  lastOkAt: number | null;
  markOnline: () => void;
  markOffline: () => void;
};

export const useNetwork = create<NetworkState>((set, get) => ({
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  lastOkAt: null,
  markOnline: () => {
    if (!get().online || get().lastOkAt === null) set({ online: true, lastOkAt: Date.now() });
    else set({ lastOkAt: Date.now() });
  },
  markOffline: () => {
    if (get().online) set({ online: false });
  },
}));

export function isOnline(): boolean {
  return useNetwork.getState().online;
}

/** True when a fetch failed because the API (or the network) is unreachable, not because it said no. */
export function isUnreachable(error: unknown, status?: number): boolean {
  if (status === 502 || status === 503 || status === 504) return true;
  if (error instanceof TypeError) return true;
  if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) return true;
  return false;
}

let listening = false;

export function listenForNetworkChanges(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("offline", () => useNetwork.getState().markOffline());
  window.addEventListener("online", () => {
    // The browser thinks it's back; confirm with a cheap health check before flipping.
    void fetch("/api/health/ready", { cache: "no-store" })
      .then((response) => (response.ok ? useNetwork.getState().markOnline() : undefined))
      .catch(() => undefined);
  });
}
