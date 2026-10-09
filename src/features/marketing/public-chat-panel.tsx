"use client";

import { useEffect, useState } from "react";

import { ChatPanel } from "@/components/assistant/chat-panel";
import type { ChatMessage } from "@/components/assistant/message-list";
import { classifyAssistantError, presentAnswer, type AssistantChatResponse, type AssistantFailure } from "@/components/assistant/model";
import { landingCopy } from "@/features/marketing/copy";
import { publicAssistantInit, publicChatUrl } from "@/features/marketing/public-assistant";
import { assistantCopy } from "@/lib/i18n/staff/assistant";
import { useLocaleStore } from "@/lib/i18n/locale-store";
import type { LocaleCode } from "@/lib/i18n/locale-text";

export function PublicChatPanel({ locale, onClose }: { locale: LocaleCode; onClose: () => void }) {
  const copy = landingCopy[locale];
  const chrome = assistantCopy[locale];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<AssistantFailure | null>(null);
  const starters = Object.values(copy.assistant.starters);

  useEffect(() => {
    useLocaleStore.getState().setLocale(locale);
  }, [locale]);

  async function submit(text: string | null) {
    const history = text ? [...messages, { id: crypto.randomUUID(), role: "user" as const, content: text }] : messages;
    if (text) setMessages(history);
    const payload = history.slice(-10).map((message) => ({
      role: message.role,
      content: message.role === "user" ? message.content : message.answer.text || "…",
    }));
    if (payload.length === 0) return;
    setPending(true);
    setFailure(null);
    try {
      const response = await fetch(
        publicChatUrl(),
        publicAssistantInit(locale, { locale, messages: payload }),
      );
      const body = (await response.json().catch(() => null)) as (AssistantChatResponse & { code?: string; detail?: string }) | null;
      if (!response.ok || !body || typeof body.answer !== "string" || typeof body.refused !== "boolean" || !Array.isArray(body.sources)) {
        throw { status: response.status, code: body?.code ?? null, detail: typeof body?.detail === "string" ? body.detail : null };
      }
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", answer: presentAnswer(body) },
      ]);
    } catch (error) {
      setFailure(classifyAssistantError(error, locale, { disabled: chrome.disabled, limit: chrome.limit, network: chrome.network, outside: chrome.outside }));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-background shadow-elev-3">
      <div className="flex justify-end border-b px-2 py-1">
        <button type="button" className="min-h-11 px-3 text-sm" onClick={onClose}>
          {copy.assistant.close}
        </button>
      </div>
      <ChatPanel
        title={copy.assistant.launcher}
        messages={messages}
        pending={pending}
        failure={failure}
        starters={starters}
        disclaimer={copy.assistant.disclaimer}
        autoFocus
        className="min-h-0 h-full"
        onSend={(text) => void submit(text)}
        onRetry={() => void submit(null)}
        footer={
          <a
            href="#partner"
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary"
            onClick={() => {
              onClose();
              document.getElementById("partner")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            {copy.assistant.becomePartner}
          </a>
        }
      />
    </div>
  );
}
