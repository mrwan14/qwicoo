"use client";

import { useEffect, useRef } from "react";

import { AnswerBlock } from "@/components/assistant/answer-block";
import type { AssistantAnswerView } from "@/components/assistant/model";
import { AskQwicooMark } from "@/components/brand/ask-mark";

export type ChatMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; answer: AssistantAnswerView; receivedAt?: number };

/** Chat bubbles: the visitor on the end side in ink, Qwicoo on the start side with its mark. */
export function MessageList({
  messages,
  pending,
  typingLabel,
  youLabel,
  assistantLabel,
  sourcesLabel,
}: {
  messages: ChatMessage[];
  pending: boolean;
  typingLabel: string;
  youLabel: string;
  assistantLabel: string;
  sourcesLabel: string;
}) {
  const end = useRef<HTMLLIElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, pending]);

  return (
    <ol className="grid content-start gap-4">
      {messages.map((message) =>
        message.role === "user" ? (
          <li key={message.id} className="asst-rise ms-auto max-w-[85%] rounded-[18px] rounded-ee-[6px] bg-brand px-4 py-2.5 text-sm text-on-brand">
            <span className="sr-only">{youLabel}: </span>
            <p className="leading-6 whitespace-pre-wrap">{message.content}</p>
          </li>
        ) : (
          <li key={message.id} className="asst-rise flex items-start gap-2.5">
            <AskQwicooMark size={28} className="mt-0.5" />
            <div className="qw-chat-answer min-w-0 flex-1 rounded-[18px] rounded-ss-[6px] bg-[var(--chat-surface,#fff)] px-4 py-3 shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-qw-line">
              <span className="sr-only">{assistantLabel}: </span>
              <AnswerBlock answer={message.answer} sourcesLabel={sourcesLabel} />
            </div>
          </li>
        ),
      )}
      {pending ? (
        <li className="asst-rise flex items-center gap-2.5" role="status">
          <AskQwicooMark size={28} thinking />
          <span className="inline-flex items-center gap-1.5 rounded-[18px] rounded-ss-[6px] bg-[var(--chat-surface,#fff)] px-4 py-3.5 ring-1 ring-qw-line">
            <span className="inline-flex items-center gap-1" aria-hidden>
              <i className="asst-dot" />
              <i className="asst-dot" />
              <i className="asst-dot" />
            </span>
            <span className="sr-only">{typingLabel}</span>
          </span>
        </li>
      ) : null}
      <li ref={end} aria-hidden className="h-0" />
    </ol>
  );
}
