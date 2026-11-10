"use client";

import { ArrowUp } from "lucide-react";
import { useState } from "react";

import { AskQwicooMark } from "@/components/brand/ask-mark";
import { Card } from "@/components/ops/kit/card";
import { useStaffSession } from "@/components/ops/staff-session";
import { starterKeys } from "@/features/staff/assistant/access";
import { useAssistantLauncher } from "@/features/staff/assistant/session";
import { canAskQwicoo } from "@/lib/auth/roles";
import { assistantCopy } from "@/lib/i18n/staff/assistant";
import { homeCopy } from "@/lib/i18n/staff/home";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

/** Two starter questions and a box. Sending opens the Ask Qwicoo panel with the question already asked. */
export function AskBox({ className }: { className?: string }) {
  const t = useStaffSection(homeCopy).ask;
  const assistant = useStaffSection(assistantCopy);
  const me = useStaffSession();
  const launch = useAssistantLauncher((state) => state.launch);
  const [text, setText] = useState("");
  if (!me || !canAskQwicoo(me.role)) return null;
  const starters = starterKeys(me.role).slice(0, 2);

  return (
    <Card
      className={className}
      title={
        <span className="inline-flex items-center gap-2">
          <AskQwicooMark size={22} />
          {t.title}
        </span>
      }
    >
      <div className="grid gap-2">
        {starters.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => launch(assistant.starters[key])}
            className="rounded-staff border border-border bg-subtle px-3 py-2.5 text-start text-[13px] text-ink transition-colors hover:border-ink-secondary/50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
          >
            {assistant.starters[key]}
          </button>
        ))}
      </div>
      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim()) return;
          launch(text);
          setText("");
        }}
      >
        <input
          aria-label={t.title}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t.placeholder}
          className="h-[42px] w-full rounded-staff border border-border bg-canvas ps-3 pe-11 text-sm text-ink outline-none placeholder:text-disabled hover:border-ink-secondary/50 focus-visible:border-focus"
        />
        <button
          type="submit"
          aria-label={t.send}
          disabled={!text.trim()}
          className="absolute end-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-staff bg-brand text-on-brand disabled:bg-disabled"
        >
          <ArrowUp aria-hidden className="size-4" />
        </button>
      </form>
    </Card>
  );
}
