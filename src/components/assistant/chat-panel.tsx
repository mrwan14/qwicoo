"use client";

import type { ReactNode } from "react";

import { Composer } from "@/components/assistant/composer";
import { MessageList, type ChatMessage } from "@/components/assistant/message-list";
import type { AssistantFailure } from "@/components/assistant/model";
import { assistantCopy } from "@/lib/i18n/staff/assistant";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export function ChatPanel({
  title,
  messages,
  pending,
  failure,
  starters,
  disclaimer,
  autoFocus,
  onSend,
  onRetry,
  footer,
}: {
  title: string;
  messages: ChatMessage[];
  pending: boolean;
  failure: AssistantFailure | null;
  starters: readonly string[];
  disclaimer?: string;
  autoFocus?: boolean;
  onSend: (text: string) => void;
  onRetry?: () => void;
  footer?: ReactNode;
}) {
  const t = useStaffSection(assistantCopy);
  const latest = [...messages].reverse().find((message) => message.role === "assistant");
  const live = pending ? t.typing : failure?.message ?? (latest?.role === "assistant" ? latest.answer.text : "");

  return (
    <section className="grid min-h-[70dvh] grid-rows-[auto_minmax(0,1fr)_auto] bg-background" aria-label={title}>
      <header className="border-b px-3 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
      </header>
      <div className="min-h-0 overflow-y-auto px-3 py-3">
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {live}
        </div>
        {messages.length === 0 && !pending ? (
          <div className="grid gap-2">
            {starters.map((starter) => (
              <button
                key={starter}
                type="button"
                className="min-h-11 border border-border bg-card px-3 text-start text-sm hover:bg-muted"
                onClick={() => onSend(starter)}
              >
                {starter}
              </button>
            ))}
          </div>
        ) : (
          <MessageList
            messages={messages}
            pending={pending}
            typingLabel={t.typing}
            youLabel={t.you}
            assistantLabel={t.qwicoo}
            sourcesLabel={t.sources}
          />
        )}
      </div>
      <div className="grid gap-3 border-t px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {failure ? (
          <div className="grid gap-2 border border-border bg-muted px-3 py-3 text-sm text-muted-foreground" role="status">
            <p>{failure.message}</p>
            {failure.kind === "network" && onRetry ? (
              <button type="button" className="inline-flex min-h-11 w-fit items-center border border-border bg-background px-3 text-sm font-medium text-foreground" onClick={onRetry}>
                {t.retry}
              </button>
            ) : null}
          </div>
        ) : null}
        <Composer
          label={t.composerLabel}
          placeholder={t.placeholder}
          sendLabel={t.send}
          disclaimer={disclaimer}
          pending={pending}
          autoFocus={autoFocus}
          onSend={onSend}
        />
        {footer}
      </div>
    </section>
  );
}
