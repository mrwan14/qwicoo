"use client";

import { useEffect, useRef } from "react";

import { AnswerBlock } from "@/components/assistant/answer-block";
import type { AssistantAnswerView } from "@/components/assistant/model";

export type ChatMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; answer: AssistantAnswerView; receivedAt?: number };

export function MessageList({
  messages,
  pending,
  typingLabel,
  pendingStep,
  youLabel,
  assistantLabel,
  sourcesLabel,
  scopeLabel,
  liveLabel,
  updatedTemplate,
  askAgainLabel,
  onAskAgain,
}: {
  messages: ChatMessage[];
  pending: boolean;
  typingLabel: string;
  pendingStep?: string;
  youLabel: string;
  assistantLabel: string;
  sourcesLabel: string;
  scopeLabel?: string;
  liveLabel?: string;
  updatedTemplate?: string;
  askAgainLabel?: string;
  onAskAgain?: () => void;
}) {
  const end = useRef<HTMLLIElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, pending]);

  return (
    <ol className="grid content-start gap-3">
      {messages.map((message) =>
        message.role === "user" ? (
          <li key={message.id} className="asst-fade ms-auto max-w-[80%] border border-qw-line bg-canvas px-3.5 py-2.5 text-sm font-medium text-ink">
            <span className="sr-only">{youLabel}: </span>
            <p className="whitespace-pre-wrap leading-6">{message.content}</p>
          </li>
        ) : (
          <li key={message.id} className="me-auto w-full max-w-full">
            <span className="sr-only">{assistantLabel}: </span>
            <AnswerBlock
              answer={message.answer}
              sourcesLabel={sourcesLabel}
              receivedAt={message.receivedAt}
              scopeLabel={scopeLabel}
              liveLabel={liveLabel}
              updatedTemplate={updatedTemplate}
              askAgainLabel={askAgainLabel}
              onAskAgain={onAskAgain}
            />
          </li>
        ),
      )}
      {pending ? (
        <li className="asst-fade me-auto grid gap-2" role="status">
          <div className="asst-bar w-24" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1" aria-hidden>
              <i className="asst-dot" />
              <i className="asst-dot" />
              <i className="asst-dot" />
            </span>
            <span>{pendingStep ?? typingLabel}</span>
          </div>
        </li>
      ) : null}
      <li ref={end} aria-hidden className="h-0" />
    </ol>
  );
}
