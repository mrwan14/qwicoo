"use client";

import { useEffect, useRef, useState } from "react";

const MAX_CHARS = 4000;
const WARN_AT = 3500;

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
  const field = useRef<HTMLInputElement>(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (autoFocus) field.current?.focus();
  }, [autoFocus]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending || trimmed.length > MAX_CHARS) return;
    onSend(trimmed);
    if (field.current) field.current.value = "";
    setLength(0);
  }

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit(field.current?.value ?? "");
      }}
    >
      <label className="grid gap-1">
        <span className="sr-only">{label}</span>
        <div className="flex border-t-2 border-ink">
          <input
            ref={field}
            name="question"
            type="text"
            maxLength={MAX_CHARS}
            placeholder={placeholder}
            disabled={pending}
            className="min-h-12 min-w-0 flex-1 border-0 bg-white px-4 py-3 text-sm outline-none disabled:opacity-60"
            onChange={(event) => setLength(event.currentTarget.value.length)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit(event.currentTarget.value);
              }
            }}
          />
          <button
            type="submit"
            disabled={pending || length === 0}
            className="inline-flex min-h-12 shrink-0 items-center bg-sage px-5 text-sm font-bold text-white disabled:opacity-50"
          >
            {sendLabel}
          </button>
        </div>
      </label>
      {length >= WARN_AT ? (
        <p className="text-xs tabular-nums text-muted-foreground" dir="ltr">
          {length} / {MAX_CHARS}
        </p>
      ) : null}
      {disclaimer ? <p className="text-xs leading-5 text-muted-foreground">{disclaimer}</p> : null}
    </form>
  );
}
