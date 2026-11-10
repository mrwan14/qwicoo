"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const MAX_CHARS = 4000;
const WARN_AT = 3500;

/** Rounded composer: grows with the question (about five lines), Enter sends, Shift+Enter adds a line. */
export function Composer({
  label,
  placeholder,
  sendLabel,
  disclaimer,
  pending,
  autoFocus,
  onSend,
}: {
  label: string;
  placeholder: string;
  sendLabel: string;
  disclaimer?: string;
  pending: boolean;
  autoFocus?: boolean;
  onSend: (text: string) => void;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    if (autoFocus) field.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 132)}px`;
  }, [text]);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || pending || trimmed.length > MAX_CHARS) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <form
      className="grid gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex items-end gap-2 rounded-[24px] border border-qw-line bg-canvas p-1.5 ps-4 transition-colors focus-within:border-ink/40 focus-within:bg-[var(--chat-surface,#fff)]">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{label}</span>
          <textarea
            ref={field}
            rows={1}
            name="question"
            maxLength={MAX_CHARS}
            placeholder={placeholder}
            value={text}
            disabled={pending}
            className="block max-h-[132px] w-full resize-none border-0 bg-transparent py-2 text-sm leading-6 text-ink outline-none placeholder:text-quiet disabled:opacity-60"
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
          aria-label={sendLabel}
          disabled={pending || text.trim().length === 0}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--orange)] text-white transition-[background-color,transform] hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:scale-100 disabled:bg-qw-line disabled:text-quiet"
        >
          <ArrowUp aria-hidden className="size-4" />
        </button>
      </div>
      {text.length >= WARN_AT ? (
        <p className="px-2 text-xs tabular-nums text-quiet" dir="ltr">
          {text.length} / {MAX_CHARS}
        </p>
      ) : null}
      {disclaimer ? <p className="px-2 text-[11px] leading-4 text-quiet">{disclaimer}</p> : null}
    </form>
  );
}
