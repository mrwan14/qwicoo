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
