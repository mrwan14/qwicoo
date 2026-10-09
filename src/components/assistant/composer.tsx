"use client";

import { useEffect, useRef } from "react";

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

  useEffect(() => {
    if (autoFocus) field.current?.focus();
  }, [autoFocus]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    onSend(trimmed);
    if (field.current) field.current.value = "";
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
        <textarea
          ref={field}
          name="question"
          rows={2}
          placeholder={placeholder}
          disabled={pending}
          className="min-h-11 w-full resize-y border border-input bg-background px-3 py-2 text-sm leading-6"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit(event.currentTarget.value);
            }
          }}
        />
      </label>
      {disclaimer ? <p className="text-xs leading-5 text-muted-foreground">{disclaimer}</p> : null}
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {sendLabel}
        </button>
      </div>
    </form>
  );
}
