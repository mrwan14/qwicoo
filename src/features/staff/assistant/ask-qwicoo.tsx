"use client";

import { MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ChatPanel } from "@/components/assistant/chat-panel";
import { classifyAssistantError, presentAnswer, type AssistantFailure } from "@/components/assistant/model";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStaffSession } from "@/components/ops/staff-session";
import { browserApi } from "@/lib/api/browser";
import { canAskQwicoo } from "@/lib/auth/roles";
import { scopeBranches } from "@/lib/auth/scope";
import { useLocale } from "@/lib/i18n/locale-store";
import { assistantCopy } from "@/lib/i18n/staff/assistant";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { assistantSheetSide, selectAssistantBranch, starterKeys, type AssistantBranch } from "./access";
import { useAssistantSession } from "./session";

function failureBody(status: number, error: unknown) {
  const record = error && typeof error === "object" ? (error as { code?: unknown; detail?: unknown }) : {};
  return {
    status,
    code: typeof record.code === "string" ? record.code : null,
    detail: typeof record.detail === "string" ? record.detail : null,
  };
}

function useMobileSheet(): boolean {
  const [mobile, setMobile] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const apply = () => setMobile(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  return mobile;
}

export function AskQwicoo({ autoFocus = false, className }: { autoFocus?: boolean; className?: string }) {
  const t = useStaffSection(assistantCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const scopeList = useScope((state) => state.branches);
  const activeBranchId = useScope((state) => state.branchId);
  const messages = useAssistantSession((state) => state.messages);
  const storedBranch = useAssistantSession((state) => state.branchId);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<AssistantFailure | null>(null);
  const sending = useRef(false);

  const accessible: AssistantBranch[] = scopeList.length > 0 ? scopeList : me ? scopeBranches(me) : [];
  const branchId = selectAssistantBranch(accessible, storedBranch ?? activeBranchId);
  const starters = me ? starterKeys(me.role).map((key) => t.starters[key]) : [];

  async function submit(text: string | null) {
    if (sending.current) return;
    const current = useAssistantSession.getState().messages;
    const history = text ? [...current, { id: crypto.randomUUID(), role: "user" as const, content: text }] : current;
    if (text) useAssistantSession.getState().push(history[history.length - 1]);
    const payload = history.slice(-20).map((message) => ({
      role: message.role,
      content: message.role === "user" ? message.content : message.answer.text || "…",
    }));
    if (payload.length === 0 || payload.some((message) => message.content.trim().length === 0)) return;
    sending.current = true;
    setPending(true);
    setFailure(null);
    try {
      const result = await browserApi.POST("/api/v1/assistant/chat", {
        body: { messages: payload, locale, branch_id: branchId },
      });
      if (!result.response.ok || !result.data) throw failureBody(result.response.status, result.error);
      useAssistantSession.getState().push({
        id: crypto.randomUUID(),
        role: "assistant",
        answer: presentAnswer(result.data),
      });
    } catch (error) {
      setFailure(classifyAssistantError(error, locale, { disabled: t.disabled, limit: t.limit, network: t.network, outside: t.outside }));
    } finally {
      sending.current = false;
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-0 gap-3">
      {accessible.length > 1 ? (
        <label className="grid max-w-xs gap-1 px-3 pt-3 text-sm">
          {t.branch}
          <select
            className="h-11 border border-input bg-background px-3 text-sm"
            value={branchId ?? ""}
            onChange={(event) => {
              const next = selectAssistantBranch(accessible, event.target.value);
              if (next === branchId) return;
              useAssistantSession.setState({ branchId: next, messages: [] });
              setFailure(null);
            }}
          >
            {accessible.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <ChatPanel
        title={t.ask}
        messages={messages}
        pending={pending}
        failure={failure}
        starters={starters}
        autoFocus={autoFocus}
        className={className}
        onSend={(text) => void submit(text)}
        onRetry={() => void submit(null)}
      />
    </div>
  );
}

export function AskQwicooButton() {
  const t = useStaffSection(assistantCopy);
  const me = useStaffSession();
  const { dir } = useLocale();
  const mobile = useMobileSheet();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  if (!me || !canAskQwicoo(me.role)) return null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) requestAnimationFrame(() => button.current?.focus());
      }}
    >
      <button
        ref={button}
        type="button"
        className="inline-flex min-h-11 items-center gap-1.5 border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
        onClick={() => setOpen(true)}
      >
        <MessageCircle aria-hidden className="size-4" />
        <span className="hidden md:inline">{t.ask}</span>
        <span className="sr-only md:hidden">{t.ask}</span>
      </button>
      <SheetContent
        side={assistantSheetSide(mobile, dir)}
        className="h-dvh w-full max-w-none gap-0 p-0 sm:h-full sm:w-[32rem] sm:max-w-[32rem]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t.ask}</SheetTitle>
        </SheetHeader>
        {open ? <AskQwicoo autoFocus className="min-h-0 h-full" /> : null}
      </SheetContent>
    </Sheet>
  );
}
