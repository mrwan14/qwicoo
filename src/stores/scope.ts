import { create } from "zustand";

import type { UserProfile } from "@/lib/auth/roles";
import {
  homeScopeOf,
  scopeBranches,
  scopeHome,
  workspaceProblem,
  type HomeScope,
  type ScopeBranch,
} from "@/lib/auth/scope";

const ACTIVE_BRANCH_PREFIX = "qwicoo-active-branch:";

/** Lets a screen with unsent work (the POS ticket) veto or clean up before a branch switch. */
export type SwitchGuard = {
  pendingItems: () => number;
  close: () => void;
};

type ScopeState = {
  userId: string | null;
  homeScope: HomeScope | null;
  home: string | null;
  brandId: string | null;
  brandName: string | null;
  brandLogoUrl: string | null;
  branches: ScopeBranch[];
  /** Sent as X-Branch-ID. Always one of `branches`, or an App Admin's focused branch. */
  branchId: string | null;
  /** No usable workspace, or the home screen itself was refused. */
  blocked: boolean;
  switchGuard: SwitchGuard | null;
  navigate: ((href: string) => void) | null;
  enter: (me: UserProfile) => void;
  setActiveBranch: (branchId: string) => void;
  focusPlatform: (focus: { brandId: string | null; branchId: string | null }) => void;
  block: () => void;
  setSwitchGuard: (guard: SwitchGuard | null) => void;
  setNavigate: (navigate: ((href: string) => void) | null) => void;
  reset: () => void;
};

const empty = {
  userId: null,
  homeScope: null,
  home: null,
  brandId: null,
  brandName: null,
  brandLogoUrl: null,
  branches: [],
  branchId: null,
  blocked: false,
  switchGuard: null,
};

function readStoredBranch(userId: string): string | null {
  try {
    return window.localStorage.getItem(`${ACTIVE_BRANCH_PREFIX}${userId}`);
  } catch {
    return null;
  }
}

function writeStoredBranch(userId: string, branchId: string) {
  try {
    window.localStorage.setItem(`${ACTIVE_BRANCH_PREFIX}${userId}`, branchId);
  } catch {
    // Private mode or full storage: the choice just won't survive a reload.
  }
}

export function clearStoredBranches() {
  try {
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(ACTIVE_BRANCH_PREFIX)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // Nothing stored.
  }
}

export const useScope = create<ScopeState>()((set, get) => ({
  ...empty,
  navigate: null,
  enter: (me) => {
    const homeScope = homeScopeOf(me);
    const branches = homeScope === "platform" ? [] : scopeBranches(me);
    const stored = readStoredBranch(me.id);
    const branchId =
      homeScope === "platform"
        ? null
        : (branches.find((branch) => branch.id === stored)?.id ?? branches[0]?.id ?? null);
    set({
      userId: me.id,
      homeScope,
      home: scopeHome(me),
      brandId: homeScope === "platform" ? null : (me.brand_id ?? null),
      brandName: me.brand_name ?? null,
      brandLogoUrl: me.brand_logo_url ?? null,
      branches,
      branchId,
      blocked: workspaceProblem(me) !== null,
      switchGuard: null,
    });
  },
  setActiveBranch: (branchId) => {
    const { userId, branches, homeScope } = get();
    if (!userId || homeScope === "platform") return;
    if (!branches.some((branch) => branch.id === branchId)) return;
    writeStoredBranch(userId, branchId);
    set({ branchId });
  },
  focusPlatform: ({ brandId, branchId }) => {
    if (get().homeScope !== "platform") return;
    set({ brandId, branchId });
  },
  block: () => set({ blocked: true }),
  setSwitchGuard: (switchGuard) => set({ switchGuard }),
  setNavigate: (navigate) => set({ navigate }),
  reset: () => set({ ...empty }),
}));
