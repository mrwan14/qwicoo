"use client";

import { ArrowUp, ChevronRight, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import "@/components/assistant/assistant.css";
import "./staff-chat.css";
import { AnswerBlock } from "@/components/assistant/answer-block";
import { AskQwicooMark } from "@/components/brand/ask-mark";
import type { ChatMessage } from "@/components/assistant/message-list";
import type { AssistantFailure } from "@/components/assistant/model";
import { assistantCopy } from "@/lib/i18n/staff/assistant";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

const MAX_CHARS = 4000;

export type StaffStarter = { id: string; label: string; icon: ReactNode };

/** The staff "Ask Qwicoo" panel: calm header, suggestions, chat bubbles and a rounded composer. */
export function StaffChatPanel({
  scopeLabel,
  firstName,
  messages,
  pending,
  failure,
  starters,
  autoFocus,
  branchPicker,
  onSend,
  onRetry,
  onAskAgain,
  onNewChat,
  onClose,
}: {
  scopeLabel: string;
  firstName: string | null;
  messages: ChatMessage[];
  pending: boolean;
  failure: AssistantFailure | null;
  starters: readonly StaffStarter[];
  autoFocus?: boolean;
  branchPicker?: ReactNode;
  onSend: (text: string) => void;
  onRetry: () => void;
  onAskAgain: () => void;
  onNewChat: () => void;
  onClose?: () => void;
}) {
  const t = useStaffSection(assistantCopy);
  const end = useRef<HTMLDivElement>(null);
  const empty = messages.length === 0 && !pending;
  const latest = [...messages].reverse().find((message) => message.role === "assistant");
  const live = pending ? t.typing : failure?.message ?? (latest?.role === "assistant" ? latest.answer.text : "");

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, pending]);

  return (
    <section aria-label={t.ask} className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] bg-canvas text-ink">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <AskQwicooMark size={36} thinking={pending} />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h2 className="text-base leading-tight font-semibold">{t.ask}</h2>
          {branchPicker ?? <p className="truncate text-[13px] text-ink-secondary">{scopeLabel}</p>}
        </div>
        {!empty ? (
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
            onClick={onNewChat}
          >
            <RotateCcw aria-hidden className="size-3.5" />
            {t.newChat}
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            aria-label={t.close}
            className="inline-flex size-9 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
            onClick={onClose}
          >
            <X aria-hidden className="size-[18px]" />
          </button>
        ) : null}
      </header>

      <div className="min-h-0 overflow-y-auto px-5 py-5">
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {live}
        </div>
        {empty ? (
          <div className="grid gap-6 pt-2">
            <div className="grid gap-1.5">
              <h3 className="text-xl leading-snug font-semibold">
                {firstName ? t.greeting.replace("{name}", firstName) : t.greetingNoName}
              </h3>
              <p className="text-sm text-ink-secondary">{t.emptyBody.replace("{branch}", scopeLabel)}</p>
            </div>
            <div className="grid gap-2">
              <p className="text-xs font-medium text-ink-secondary">{t.tryAsking}</p>
              <ul className="grid gap-2">
                {starters.map((starter) => (
                  <li key={starter.id}>
                    <button
                      type="button"
                      className="group flex w-full items-center gap-3 rounded-xl border border-border bg-canvas px-3.5 py-3 text-start text-sm text-ink transition-colors hover:border-ink-secondary/40 hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
                      onClick={() => onSend(starter.label)}
                    >
                      <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-ink-secondary group-hover:bg-canvas">
                        {starter.icon}
                      </span>
                      <span className="min-w-0 flex-1">{starter.label}</span>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-disabled rtl:rotate-180" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <ol className="grid content-start gap-4">
            {messages.map((message) =>
              message.role === "user" ? (
                <li key={message.id} className="asst-fade ms-auto max-w-[85%] rounded-2xl rounded-ee-md bg-brand px-4 py-2.5 text-sm text-on-brand">
                  <span className="sr-only">{t.you}: </span>
                  <p className="leading-6 whitespace-pre-wrap">{message.content}</p>
                </li>
              ) : (
                <li key={message.id} className="flex items-start gap-2.5">
                  <AskQwicooMark size={28} className="mt-0.5" />
                  <div className="staff-answer min-w-0 flex-1 rounded-2xl rounded-ss-md bg-subtle px-4 py-3">
                    <span className="sr-only">{t.qwicoo}: </span>
                    <AnswerBlock
                      answer={message.answer}
                      sourcesLabel={t.sources}
                      receivedAt={message.receivedAt}
                      scopeLabel={scopeLabel}
                      liveLabel={t.live}
                      updatedTemplate={t.updated}
                      askAgainLabel={t.askAgain}
                      onAskAgain={onAskAgain}
                    />
                  </div>
                </li>
              ),
            )}
            {pending ? (
              <li className="asst-fade flex items-center gap-2.5" role="status">
                <AskQwicooMark size={28} thinking />
                <span className="inline-flex items-center gap-2 rounded-2xl rounded-ss-md bg-subtle px-4 py-3 text-sm text-ink-secondary">
                  <span className="inline-flex items-center gap-1" aria-hidden>
                    <i className="staff-dot" />
                    <i className="staff-dot" />
                    <i className="staff-dot" />
                  </span>
                  <span className="sr-only">{t.typing}</span>
                </span>
              </li>
            ) : null}
          </ol>
        )}
        <div ref={end} aria-hidden />
      </div>

      <div className="grid gap-3 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {failure ? (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-subtle px-3.5 py-2.5 text-sm text-ink-secondary">
            <p>{failure.message}</p>
            {failure.kind === "network" ? (
              <button type="button" className="rounded-full px-3 py-1 text-[13px] font-medium text-ink underline-offset-4 hover:underline" onClick={onRetry}>
                {t.retry}
              </button>
            ) : null}
          </div>
        ) : null}
        <Composer placeholder={t.askAbout.replace("{branch}", scopeLabel)} pending={pending} autoFocus={autoFocus} onSend={onSend} />
      </div>
    </section>
  );
}

function Composer({
  placeholder,
  pending,
  autoFocus,
  onSend,
}: {
  placeholder: string;
  pending: boolean;
  autoFocus?: boolean;
  onSend: (text: string) => void;
}) {
  const t = useStaffSection(assistantCopy);
  const field = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    if (autoFocus) field.current?.focus();
  }, [autoFocus]);

  // Grow with the question, up to about five lines.
  useEffect(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 132)}px`;
  }, [text]);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <form
      className="flex items-end gap-2 rounded-2xl border border-border bg-canvas p-1.5 ps-4 transition-colors focus-within:border-ink-secondary/60"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="min-w-0 flex-1">
        <span className="sr-only">{t.composerLabel}</span>
        <textarea
          ref={field}
          rows={1}
          name="question"
          maxLength={MAX_CHARS}
          placeholder={placeholder}
          value={text}
          disabled={pending}
          className="block max-h-[132px] w-full resize-none bg-transparent py-2 text-sm leading-6 text-ink outline-none placeholder:text-disabled disabled:opacity-60"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
        />
      </label>
      <button
        type="submit"
        aria-label={t.send}
        disabled={pending || text.trim().length === 0}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand transition-colors hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:bg-border disabled:text-disabled"
      >
        <ArrowUp aria-hidden className="size-4" />
      </button>
    </form>
  );
}
