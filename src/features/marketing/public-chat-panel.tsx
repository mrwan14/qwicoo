"use client";

import { BadgePercent, Handshake, Languages, QrCode, Rocket, Store } from "lucide-react";
import type { ReactNode } from "react";

import { ChatPanel, type StarterTile } from "@/components/assistant/chat-panel";
import { landingCopy } from "@/features/marketing/copy";
import { usePublicChatState } from "@/features/marketing/public-assistant-session";

type StarterKey = keyof (typeof landingCopy)["en"]["assistant"]["starters"];

const STARTER_LOOK: Record<StarterKey, { icon: ReactNode; edge: string }> = {
  capabilities: { icon: <Store aria-hidden className="size-4" />, edge: "var(--orange)" },
  pricing: { icon: <BadgePercent aria-hidden className="size-4" />, edge: "var(--sage)" },
  qr: { icon: <QrCode aria-hidden className="size-4" />, edge: "var(--amber)" },
  arabic: { icon: <Languages aria-hidden className="size-4" />, edge: "var(--sage)" },
  start: { icon: <Rocket aria-hidden className="size-4" />, edge: "var(--orange)" },
  partner: { icon: <Handshake aria-hidden className="size-4" />, edge: "var(--amber)" },
};

export function PublicChatPanel({ onClose, showClose = true }: { onClose?: () => void; showClose?: boolean }) {
  const { locale, messages, pending, failure, submit, reset } = usePublicChatState();
  const copy = landingCopy[locale];
  const t = copy.assistant;
  const starters: StarterTile[] = (Object.keys(t.starters) as StarterKey[]).map((id) => ({
    id,
    label: t.starters[id],
    ...STARTER_LOOK[id],
  }));
  const answers = messages.filter((message) => message.role === "assistant").length;

  return (
    <ChatPanel
      title={t.launcherShort}
      subtitle={t.status}
      greeting={t.greeting}
      greetingBody={t.greetingBody}
      tryAsking={t.tryAsking}
      moreLabel={t.moreQuestions}
      messages={messages}
      pending={pending}
      failure={failure}
      starters={starters}
      disclaimer={t.disclaimer}
      autoFocus={showClose}
      className="h-full min-h-0"
      onSend={(text) => void submit(text)}
      onRetry={() => void submit(null)}
      onNewChat={reset}
      newChatLabel={t.newChat}
      onClose={showClose ? onClose : undefined}
      closeLabel={t.close}
      afterAnswers={
        // After the second answer, offer the next step without interrupting the first exchange.
        answers >= 2 ? (
          <a
            href="#partner"
            onClick={() => onClose?.()}
            className="asst-rise ms-[38px] flex items-center justify-between gap-3 rounded-[18px] bg-[var(--orange)] px-4 py-3 text-white transition-transform hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="grid gap-0.5">
              <span className="text-sm font-semibold">{t.demoTitle}</span>
              <span className="text-xs text-white/85">{t.demoBody}</span>
            </span>
            <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink">{t.becomePartner}</span>
          </a>
        ) : null
      }
    />
  );
}
