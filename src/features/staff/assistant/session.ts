import { create } from "zustand";

import type { ChatMessage } from "@/components/assistant/message-list";

type AssistantSession = {
  messages: ChatMessage[];
  branchId: string | null;
  push: (message: ChatMessage) => void;
  setBranchId: (branchId: string | null) => void;
  clear: () => void;
};

export const useAssistantSession = create<AssistantSession>((set) => ({
  messages: [],
  branchId: null,
  push: (message) => set((state) => ({ messages: [...state.messages, message].slice(-20) })),
  setBranchId: (branchId) => set({ branchId }),
  clear: () => set({ messages: [], branchId: null }),
}));

export function clearAssistantSession() {
  useAssistantSession.getState().clear();
}

type AssistantLauncher = {
  open: boolean;
  /** A question to send as soon as the panel opens (from the Home "Ask Qwicoo" box). */
  prompt: string | null;
  launch: (prompt?: string) => void;
  setOpen: (open: boolean) => void;
  takePrompt: () => string | null;
};

/** Opens the one Ask Qwicoo panel from anywhere in the staff shell. */
export const useAssistantLauncher = create<AssistantLauncher>((set, get) => ({
  open: false,
  prompt: null,
  launch: (prompt) => set({ open: true, prompt: prompt?.trim() || null }),
  setOpen: (open) => set(open ? { open } : { open, prompt: null }),
  takePrompt: () => {
    const prompt = get().prompt;
    if (prompt) set({ prompt: null });
    return prompt;
  },
}));
