"use client";

import { Ban, Building2, Clock, MessageCircle, TrendingUp, Utensils, Wallet } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { classifyAssistantError, presentAnswer, type AssistantFailure } from "@/components/assistant/model";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStaffSession } from "@/components/ops/staff-session";
import { cn } from "cn";
import { ChevronDown } from "lucide-react";
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
import { useAssistantLauncher, useAssistantSession } from "./session";
import { StaffChatPanel, type StaffStarter } from "./staff-chat-panel";

const STARTER_ICON: Record<StarterKey, ReactNode> = {
  today: <TrendingUp aria-hidden className="size-4" />,
  items: <Utensils aria-hidden className="size-4" />,
  cash: <Wallet aria-hidden className="size-4" />,
  cancelled: <Ban aria-hidden className="size-4" />,
  hours: <Clock aria-hidden className="size-4" />,
  topBranch: <Building2 aria-hidden className="size-4" />,
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

export function AskQwicoo({ autoFocus = false, className, onClose }: { autoFocus?: boolean; className?: string; onClose?: () => void }) {
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
  const starters: StaffStarter[] = me
    ? starterKeys(me.role).map((key) => ({ id: key, label: t.starters[key], icon: STARTER_ICON[key] }))
    : [];
  const firstName = me?.full_name.trim().split(/\s+/)[0] || null;
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

  // A question typed into the Home box is sent once, when the panel opens.
  useEffect(() => {
    const prompt = useAssistantLauncher.getState().takePrompt();
    if (prompt) void submit(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount
  }, []);

  function askAgain() {
    const lastUser = [...useAssistantSession.getState().messages].reverse().find((message) => message.role === "user");
    if (lastUser?.role === "user") void submit(lastUser.content);
  }

  const branchPicker = showPicker ? (
    <label className="relative inline-flex w-fit max-w-full items-center">
      <span className="sr-only">{t.branch}</span>
      <select
        className="max-w-[16rem] cursor-pointer appearance-none truncate rounded-full bg-transparent py-0.5 pe-5 text-[13px] text-ink-secondary outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
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
      <ChevronDown aria-hidden className="pointer-events-none absolute end-0 size-3.5 text-ink-secondary" />
    </label>
  ) : null;

  return (
    <div
      className={cn(
        "grid min-h-0",
        // On its own page the panel is a framed card; in the sheet it fills the sheet.
        onClose ? "h-full" : "h-[calc(100dvh-9rem)] overflow-hidden rounded-xl border border-border",
        className,
      )}
    >
      <StaffChatPanel
        scopeLabel={scopeName}
        firstName={firstName}
        messages={messages}
        pending={pending}
        failure={failure}
        starters={starters}
        autoFocus={autoFocus}
        branchPicker={branchPicker}
        onSend={(text) => void submit(text)}
        onRetry={() => void submit(null)}
        onAskAgain={askAgain}
        onNewChat={() => {
          useAssistantSession.setState({ messages: [] });
          setFailure(null);
        }}
        onClose={onClose}
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
  const open = useAssistantLauncher((state) => state.open);
  const setOpen = useAssistantLauncher((state) => state.setOpen);
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
  }, [me, setOpen]);

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
        className="inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-staff border border-border bg-canvas px-3 text-sm font-medium text-ink transition-colors hover:border-ink-secondary/50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
        aria-label={t.ask}
        onClick={() => setOpen(true)}
      >
        <MessageCircle aria-hidden className="size-4" />
        <span className="hidden xl:inline">{t.ask}</span>
        <kbd dir="ltr" className="ms-1 hidden text-[11px] font-normal text-ink-secondary xl:inline">{mac ? t.shortcut : t.shortcutCtrl}</kbd>
      </button>
      <SheetContent
        side={assistantSheetSide(mobile, dir)}
        showCloseButton={false}
        className="h-dvh w-full max-w-none gap-0 overflow-hidden rounded-none border-0 p-0 shadow-panel max-sm:h-[92dvh] max-sm:rounded-t-2xl sm:h-full sm:w-[85vw] sm:max-w-[85vw] lg:w-[56rem] lg:max-w-[min(56rem,85vw)] xl:w-[64rem] xl:max-w-[min(64rem,80vw)]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t.ask}</SheetTitle>
        </SheetHeader>
        {open ? (
          <AskQwicoo
            autoFocus
            onClose={() => {
              setOpen(false);
              requestAnimationFrame(() => button.current?.focus());
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
