"use client";

import { ChatPanel } from "@/components/assistant/chat-panel";
import { landingCopy } from "@/features/marketing/copy";
import { usePublicChatState } from "@/features/marketing/public-assistant-session";

export function PublicChatPanel({ onClose, showClose = true }: { onClose?: () => void; showClose?: boolean }) {
  const { locale, messages, pending, failure, submit } = usePublicChatState();
  const copy = landingCopy[locale];
  const starters = Object.values(copy.assistant.starters);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-canvas">
      {showClose && onClose ? (
        <div className="flex items-center justify-between border-b border-qw-line px-3 py-2">
          <p className="text-sm font-semibold">{copy.partner.askTitle}</p>
          <button type="button" className="min-h-11 px-3 text-sm" onClick={onClose}>
            {copy.assistant.close}
          </button>
        </div>
      ) : null}
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
        footer={
          <a href="#partner" className="inline-flex min-h-11 items-center text-sm font-medium text-ink" onClick={() => onClose?.()}>
            {copy.assistant.becomePartner}
          </a>
        }
      />
    </div>
  );
}
