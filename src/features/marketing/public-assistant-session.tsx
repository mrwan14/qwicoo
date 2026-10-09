"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import type { ChatMessage } from "@/components/assistant/message-list";
import { classifyAssistantError, presentAnswer, type AssistantChatResponse, type AssistantFailure } from "@/components/assistant/model";
import { publicAssistantInit, publicChatUrl } from "@/features/marketing/public-assistant";
import { assistantCopy } from "@/lib/i18n/staff/assistant";
import { useLocaleStore } from "@/lib/i18n/locale-store";
import type { LocaleCode } from "@/lib/i18n/locale-text";

type PublicChat = {
  locale: LocaleCode;
  messages: ChatMessage[];
  pending: boolean;
  failure: AssistantFailure | null;
  submit: (text: string | null) => Promise<void>;
};

const PublicChatContext = createContext<PublicChat | null>(null);

export function PublicAssistantProvider({ locale, children }: { locale: LocaleCode; children: ReactNode }) {
  const value = usePublicChat(locale);
  return <PublicChatContext.Provider value={value}>{children}</PublicChatContext.Provider>;
}

export function usePublicChatState(): PublicChat {
  const value = useContext(PublicChatContext);
  if (!value) throw new Error("Ask Qwicoo is outside its provider");
  return value;
}

function usePublicChat(locale: LocaleCode): PublicChat {
  const chrome = assistantCopy[locale];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<AssistantFailure | null>(null);

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
      const response = await fetch(publicChatUrl(), publicAssistantInit(locale, { locale, messages: payload }));
      const body = (await response.json().catch(() => null)) as (AssistantChatResponse & { code?: string; detail?: string }) | null;
      if (!response.ok || !body || typeof body.answer !== "string" || typeof body.refused !== "boolean" || !Array.isArray(body.sources)) {
        throw { status: response.status, code: body?.code ?? null, detail: typeof body?.detail === "string" ? body.detail : null };
      }
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", answer: presentAnswer(body) }]);
    } catch (error) {
      setFailure(
        classifyAssistantError(error, locale, {
          disabled: chrome.disabled,
          limit: chrome.limit,
          network: chrome.network,
          outside: chrome.outside,
        }),
      );
    } finally {
      setPending(false);
    }
  }

  return { locale, messages, pending, failure, submit };
}
