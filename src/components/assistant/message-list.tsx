"use client";

import { AnswerBlock } from "@/components/assistant/answer-block";
import type { AssistantAnswerView } from "@/components/assistant/model";

export type ChatMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; answer: AssistantAnswerView };

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
  return (
    <ol className="grid content-start gap-3">
      {messages.map((message) =>
        message.role === "user" ? (
          <li key={message.id} className="ms-auto max-w-[85%] bg-primary px-3 py-2 text-sm text-primary-foreground">
            <span className="sr-only">{youLabel}: </span>
            <p className="whitespace-pre-wrap leading-6">{message.content}</p>
          </li>
        ) : (
          <li key={message.id} className="me-auto w-full max-w-full">
            <span className="sr-only">{assistantLabel}: </span>
            <AnswerBlock answer={message.answer} sourcesLabel={sourcesLabel} />
          </li>
        ),
      )}
      {pending ? (
        <li className="me-auto border border-border bg-muted px-3 py-2 text-sm text-muted-foreground" role="status">
          {typingLabel}
        </li>
      ) : null}
    </ol>
  );
}
