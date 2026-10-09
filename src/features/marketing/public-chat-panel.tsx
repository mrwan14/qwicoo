"use client";

import { MessageCircle } from "lucide-react";

import { ChatPanel, type StarterTile } from "@/components/assistant/chat-panel";
import { landingCopy } from "@/features/marketing/copy";
import { usePublicChatState } from "@/features/marketing/public-assistant-session";

const EDGES = ["var(--amber)", "var(--orange)", "var(--sage)", "var(--amber)"];

export function PublicChatPanel({ onClose, showClose = true }: { onClose?: () => void; showClose?: boolean }) {
  const { locale, messages, pending, failure, submit } = usePublicChatState();
  const copy = landingCopy[locale];
  const starters: StarterTile[] = Object.entries(copy.assistant.starters).map(([id, label], index) => ({
    id,
    label,
    icon: <MessageCircle aria-hidden className="size-4" />,
    edge: EDGES[index % EDGES.length],
  }));

  return (
    <ChatPanel
      title={copy.partner.askTitle}
      messages={messages}
      pending={pending}
      failure={failure}
      starters={starters}
      disclaimer={copy.assistant.disclaimer}
      autoFocus={showClose}
      className="min-h-0 h-full"
      onSend={(text) => void submit(text)}
      onRetry={() => void submit(null)}
      headerExtra={
        showClose && onClose ? (
          <button type="button" className="min-h-9 px-2 text-sm text-canvas" onClick={onClose}>
            {copy.assistant.close}
          </button>
        ) : null
      }
      footer={
        <a href="#partner" className="inline-flex min-h-11 items-center text-sm font-medium text-ink" onClick={() => onClose?.()}>
          {copy.assistant.becomePartner}
        </a>
      }
    />
  );
}
