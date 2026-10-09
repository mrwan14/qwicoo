"use client";

import type { ReactNode } from "react";
import { cn } from "cn";

import "@/components/assistant/assistant.css";
import { Composer } from "@/components/assistant/composer";
import { MessageList, type ChatMessage } from "@/components/assistant/message-list";
import type { AssistantFailure } from "@/components/assistant/model";
import { assistantCopy } from "@/lib/i18n/staff/assistant";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export type StarterTile = {
  id: string;
  label: string;
  icon?: ReactNode;
  edge?: string;
};

export function ChatPanel({
  title,
  scopeLabel,
  emptyTitle,
  messages,
  pending,
  failure,
  starters,
  disclaimer,
  autoFocus,
  onSend,
  onRetry,
  onAskAgain,
  footer,
  className,
  headerExtra,
}: {
  title: string;
  scopeLabel?: string;
  emptyTitle?: string;
  messages: ChatMessage[];
  pending: boolean;
  failure: AssistantFailure | null;
  starters: readonly StarterTile[];
  disclaimer?: string;
  autoFocus?: boolean;
  onSend: (text: string) => void;
  onRetry?: () => void;
  onAskAgain?: () => void;
  footer?: ReactNode;
  className?: string;
  headerExtra?: ReactNode;
}) {
  const t = useStaffSection(assistantCopy);
  const latest = [...messages].reverse().find((message) => message.role === "assistant");
  const live = pending ? t.pendingStep : failure?.message ?? (latest?.role === "assistant" ? latest.answer.text : "");
  const empty = messages.length === 0 && !pending;

  return (
    <section className={cn("grid min-h-[70dvh] grid-rows-[auto_minmax(0,1fr)_auto] bg-white text-ink", className)} aria-label={title}>
      <header className="flex items-center justify-between gap-3 bg-ink px-4 py-3.5 text-canvas">
        <div className="min-w-0">
          <h2 className="asst-title text-canvas">{title}</h2>
          {scopeLabel ? <p className="mt-0.5 truncate text-xs text-[#cfc8bf]">{scopeLabel}</p> : null}
        </div>
        {headerExtra}
      </header>
      <div className="min-h-0 overflow-y-auto px-4 py-4">
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {live}
        </div>
        {empty ? (
          <div className="grid gap-4">
            {emptyTitle ? <h3 className="text-lg font-semibold text-ink">{emptyTitle}</h3> : null}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {starters.map((starter) => (
                <button
                  key={starter.id}
                  type="button"
                  className="flex min-h-11 items-start gap-2 border border-qw-line bg-canvas px-3 py-2.5 text-start text-[13px] font-medium text-ink hover:bg-white"
                  style={{ borderInlineStartWidth: 3, borderInlineStartColor: starter.edge ?? "var(--amber)" }}
                  onClick={() => onSend(starter.label)}
                >
                  {starter.icon ? <span className="mt-0.5 shrink-0 text-ink/70">{starter.icon}</span> : null}
                  <span>{starter.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <MessageList
            messages={messages}
            pending={pending}
            typingLabel={t.typing}
            pendingStep={t.pendingStep}
            youLabel={t.you}
            assistantLabel={t.qwicoo}
            sourcesLabel={t.sources}
            scopeLabel={scopeLabel}
            liveLabel={t.live}
            updatedTemplate={t.updated}
            askAgainLabel={t.askAgain}
            onAskAgain={onAskAgain}
          />
        )}
      </div>
      <div className="grid gap-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {failure ? (
          <div className="mx-4 mb-3 grid gap-2 border border-qw-line bg-canvas px-3 py-3 text-sm text-muted-foreground" role="status">
            <p>{failure.message}</p>
            {failure.kind === "network" && onRetry ? (
              <button type="button" className="inline-flex min-h-11 w-fit items-center border border-ink bg-white px-3 text-sm font-medium text-ink" onClick={onRetry}>
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
        {footer ? <div className="border-t border-qw-line px-4 py-2">{footer}</div> : null}
      </div>
    </section>
  );
}
