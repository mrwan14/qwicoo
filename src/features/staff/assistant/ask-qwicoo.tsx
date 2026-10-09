"use client";

import { Ban, Building2, Clock, MessageCircle, TrendingUp, Utensils, Wallet } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ChatPanel, type StarterTile } from "@/components/assistant/chat-panel";
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

import {
  assistantChatBody,
  assistantSheetSide,
  isBrandLevelRole,
  resolveAssistantBranchId,
  starterKeys,
  type AssistantBranch,
  type StarterKey,
} from "./access";
import { useAssistantSession } from "./session";

const STARTER_ICON: Record<StarterKey, ReactNode> = {
  today: <TrendingUp aria-hidden className="size-4" />,
  items: <Utensils aria-hidden className="size-4" />,
  cash: <Wallet aria-hidden className="size-4" />,
  cancelled: <Ban aria-hidden className="size-4" />,
  hours: <Clock aria-hidden className="size-4" />,
  topBranch: <Building2 aria-hidden className="size-4" />,
};

const STARTER_EDGE: Record<StarterKey, string> = {
  today: "var(--orange)",
  items: "var(--amber)",
  cash: "var(--sage)",
  cancelled: "var(--orange)",
  hours: "var(--amber)",
  topBranch: "var(--sage)",
};

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

function useMacShortcut(): boolean {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform) || navigator.userAgent.includes("Mac"));
  }, []);
  return mac;
}

function focusedInField(): boolean {
  const target = document.activeElement;
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
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
  const brandLevel = me ? isBrandLevelRole(me.role) : false;
  const branchId = me ? resolveAssistantBranchId(me.role, accessible, storedBranch, activeBranchId) : null;
  const scopeName =
    branchId == null && brandLevel
      ? t.allBranches
      : (accessible.find((branch) => branch.id === branchId)?.name ?? t.branch);
  const starters: StarterTile[] = me
    ? starterKeys(me.role).map((key) => ({
        id: key,
        label: t.starters[key],
        icon: STARTER_ICON[key],
        edge: STARTER_EDGE[key],
      }))
    : [];
  const emptyTitle = t.emptyTitle.replace("{branch}", scopeName);
  const showPicker = brandLevel ? accessible.length > 0 : accessible.length > 1;

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
        body: assistantChatBody(payload, locale, branchId),
      });
      if (!result.response.ok || !result.data) throw failureBody(result.response.status, result.error);
      useAssistantSession.getState().push({
        id: crypto.randomUUID(),
        role: "assistant",
        answer: presentAnswer(result.data),
        receivedAt: Date.now(),
      });
    } catch (error) {
      setFailure(classifyAssistantError(error, locale, { disabled: t.disabled, limit: t.limit, network: t.network, outside: t.outside }));
    } finally {
      sending.current = false;
      setPending(false);
    }
  }

  function askAgain() {
    const lastUser = [...useAssistantSession.getState().messages].reverse().find((message) => message.role === "user");
    if (lastUser?.role === "user") void submit(lastUser.content);
  }

  return (
    <div className="grid min-h-0">
      <ChatPanel
        title={t.ask}
        scopeLabel={scopeName}
        emptyTitle={emptyTitle}
        messages={messages}
        pending={pending}
        failure={failure}
        starters={starters}
        autoFocus={autoFocus}
        className={className}
        onSend={(text) => void submit(text)}
        onRetry={() => void submit(null)}
        onAskAgain={askAgain}
        headerExtra={
          showPicker ? (
            <label className="grid gap-0.5 text-xs text-[#cfc8bf]">
              <span className="sr-only">{t.branch}</span>
              <select
                className="h-9 max-w-[11rem] border border-[#5a534c] bg-ink px-2 text-sm text-canvas"
                value={branchId ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  const next = raw === "" ? null : raw;
                  if (next === branchId) return;
                  if (next && !accessible.some((branch) => branch.id === next)) return;
                  useAssistantSession.setState({ branchId: next, messages: [] });
                  setFailure(null);
                }}
              >
                {brandLevel ? <option value="">{t.allBranches}</option> : null}
                {accessible.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null
        }
      />
    </div>
  );
}

export function AskQwicooButton() {
  const t = useStaffSection(assistantCopy);
  const me = useStaffSession();
  const { dir } = useLocale();
  const mobile = useMobileSheet();
  const mac = useMacShortcut();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!me || !canAskQwicoo(me.role)) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      if (focusedInField()) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [me]);

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
        className="inline-flex min-h-11 items-center gap-1.5 border-e-[3px] border-e-[var(--orange)] bg-ink px-3 text-sm font-medium text-canvas"
        onClick={() => setOpen(true)}
      >
        <MessageCircle aria-hidden className="size-4" />
        <span>{t.ask}</span>
        <kbd className="ms-1 hidden text-[11px] font-normal text-[#cfc8bf] md:inline">{mac ? t.shortcut : t.shortcutCtrl}</kbd>
      </button>
      <SheetContent
        side={assistantSheetSide(mobile, dir)}
        className="h-dvh w-full max-w-none gap-0 rounded-none p-0 sm:h-full sm:w-[32rem] sm:max-w-[32rem]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t.ask}</SheetTitle>
        </SheetHeader>
        {open ? <AskQwicoo autoFocus className="min-h-0 h-full" /> : null}
      </SheetContent>
    </Sheet>
  );
}
