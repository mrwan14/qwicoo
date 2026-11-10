"use client";

import { RotateCcw, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";

import "@/components/assistant/assistant.css";
import { AskQwicooMark } from "@/components/brand/ask-mark";
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

/**
 * The public Ask Qwicoo chat: branded header, a greeting with popular questions, chat bubbles,
 * follow-up chips after each answer, and a rounded composer. Root carries `qw-chat` so the landing
 * page's corner rules leave its own rounding alone.
 */
export function ChatPanel({
  title,
  subtitle,
  greeting,
  greetingBody,
  tryAsking,
  moreLabel,
  messages,
  pending,
  failure,
  starters,
  disclaimer,
  autoFocus,
  onSend,
  onRetry,
  onNewChat,
  newChatLabel,
  onClose,
  closeLabel,
  afterAnswers,
  footer,
  className,
}: {
  title: string;
  subtitle?: string;
  greeting?: string;
  greetingBody?: string;
  tryAsking?: string;
  moreLabel?: string;
  messages: ChatMessage[];
  pending: boolean;
  failure: AssistantFailure | null;
  starters: readonly StarterTile[];
  disclaimer?: string;
  autoFocus?: boolean;
  onSend: (text: string) => void;
  onRetry?: () => void;
  onNewChat?: () => void;
  newChatLabel?: string;
  onClose?: () => void;
  closeLabel?: string;
  /** Shown under the conversation once there is at least one answer, e.g. a demo invitation. */
  afterAnswers?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const t = useStaffSection(assistantCopy);
  const latest = [...messages].reverse().find((message) => message.role === "assistant");
  const live = pending ? t.typing : failure?.message ?? (latest?.role === "assistant" ? latest.answer.text : "");
  const empty = messages.length === 0 && !pending;
  // Follow-ups: the popular questions the visitor has not asked yet.
  const asked = new Set(messages.filter((message) => message.role === "user").map((message) => message.content));
  const followUps = starters.filter((starter) => !asked.has(starter.label)).slice(0, 3);

  return (
    <section
      className={cn("qw-chat grid min-h-[70dvh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[var(--chat-surface,#fff)] text-ink", className)}
      aria-label={title}
    >
      <header className="flex items-center gap-3 border-b border-qw-line bg-[var(--chat-surface,#fff)] px-4 py-3">
        <span className="relative inline-flex">
          <AskQwicooMark size={36} thinking={pending} />
          <span aria-hidden className="absolute -end-0.5 -bottom-0.5 size-3 rounded-full border-2 border-white bg-sage" />
        </span>
        <div className="grid min-w-0 flex-1">
          <h2 className="truncate text-[15px] leading-tight font-semibold text-ink">{title}</h2>
          {subtitle ? <p className="truncate text-xs text-quiet">{subtitle}</p> : null}
        </div>
        {!empty && onNewChat && newChatLabel ? (
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-quiet transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            onClick={onNewChat}
            disabled={pending}
          >
            <RotateCcw aria-hidden className="size-3.5" />
            <span className="max-[380px]:sr-only">{newChatLabel}</span>
          </button>
        ) : null}
        {onClose && closeLabel ? (
          <button
            type="button"
            aria-label={closeLabel}
            className="inline-flex size-9 items-center justify-center rounded-full text-quiet transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
            onClick={onClose}
          >
            <X aria-hidden className="size-[18px]" />
          </button>
        ) : null}
      </header>

      <div className="min-h-0 overflow-y-auto bg-[linear-gradient(to_bottom,var(--canvas),white_160px)] px-4 py-5">
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {live}
        </div>
        {empty ? (
          <div className="asst-fade grid gap-5">
            <div className="flex items-start gap-2.5">
              <AskQwicooMark size={28} className="mt-0.5" />
              <div className="grid gap-1 rounded-[18px] rounded-ss-[6px] bg-[var(--chat-surface,#fff)] px-4 py-3 shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-qw-line">
                {greeting ? <p className="text-[15px] leading-snug font-semibold text-ink">{greeting}</p> : null}
                {greetingBody ? <p className="text-sm leading-6 text-quiet">{greetingBody}</p> : null}
              </div>
            </div>
            <div className="grid gap-2">
              {tryAsking ? <p className="px-1 text-xs font-medium text-quiet">{tryAsking}</p> : null}
              <ul className="grid gap-2">
                {starters.map((starter, index) => (
                  <li key={starter.id} className="asst-rise" style={{ animationDelay: `${index * 45}ms` }}>
                    <StarterButton starter={starter} onSend={onSend} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <MessageList
              messages={messages}
              pending={pending}
              typingLabel={t.typing}
              youLabel={t.you}
              assistantLabel={t.qwicoo}
              sourcesLabel={t.sources}
            />
            {!pending && latest ? (
              <>
                {afterAnswers}
                {followUps.length > 0 ? (
                  <div className="asst-fade grid gap-1.5 ps-[38px]">
                    {moreLabel ? <p className="text-xs font-medium text-quiet">{moreLabel}</p> : null}
                    <div className="flex flex-wrap gap-1.5">
                      {followUps.map((starter) => (
                        <button
                          key={starter.id}
                          type="button"
                          className="rounded-full border border-qw-line bg-[var(--chat-surface,#fff)] px-3 py-1.5 text-start text-[13px] text-ink transition-colors hover:border-ink/30 hover:bg-canvas focus-visible:outline-2 focus-visible:outline-ring"
                          onClick={() => onSend(starter.label)}
                        >
                          {starter.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        )}
      </div>

      <div className="grid gap-2 border-t border-qw-line bg-[var(--chat-surface,#fff)] px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {failure ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-canvas px-3.5 py-2.5 text-sm text-quiet" role="status">
            <p>{failure.message}</p>
            {failure.kind === "network" && onRetry ? (
              <button type="button" className="rounded-full px-3 py-1 text-[13px] font-semibold text-ink underline-offset-4 hover:underline" onClick={onRetry}>
                {t.retry}
              </button>
            ) : null}
          </div>
        ) : null}
        <Composer label={t.composerLabel} placeholder={t.placeholder} sendLabel={t.send} disclaimer={disclaimer} pending={pending} autoFocus={autoFocus} onSend={onSend} />
        {footer ? <div className="px-1">{footer}</div> : null}
      </div>
    </section>
  );
}

function StarterButton({ starter, onSend }: { starter: StarterTile; onSend: (text: string) => void }) {
  return (
    <button
      type="button"
      className="group flex w-full items-center gap-3 rounded-[18px] border border-qw-line bg-[var(--chat-surface,#fff)] px-3 py-2.5 text-start text-sm text-ink transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-ink/25 hover:shadow-[0_4px_14px_rgb(0_0_0/0.06)] focus-visible:outline-2 focus-visible:outline-ring"
      onClick={() => onSend(starter.label)}
    >
      <span
        aria-hidden
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-[12px] text-ink"
        style={{ background: `color-mix(in srgb, ${starter.edge ?? "var(--amber)"} 18%, white)` }}
      >
        {starter.icon}
      </span>
      <span className="min-w-0 flex-1 leading-snug">{starter.label}</span>
      <span aria-hidden className="text-quiet transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5">
        →
      </span>
    </button>
  );
}
