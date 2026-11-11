"use client";

import { X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useReducer, useRef, useState } from "react";

import { AskQwicooMark } from "@/components/brand/ask-mark";

import { OPEN_ASSISTANT_EVENT } from "@/features/marketing/contact";
import { landingCopy } from "@/features/marketing/copy";
import { launcherReducer, placeLauncher, type Box } from "@/features/marketing/public-assistant";
import type { LocaleCode } from "@/lib/i18n/locale-text";

const PublicChatPanel = dynamic(() => import("@/features/marketing/public-chat-panel").then((mod) => mod.PublicChatPanel), {
  ssr: false,
});

export function PublicAssistantLauncher({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale].assistant;
  const [state, dispatch] = useReducer(launcherReducer, { open: false, mounted: false });
  const button = useRef<HTMLButtonElement>(null);
  const [narrow, setNarrow] = useState(false);
  const [slot, setSlot] = useState<{ hidden: boolean; top: number; inset: number }>({ hidden: false, top: 0, inset: 16 });
  const [nudge, setNudge] = useState(false);

  // A one-time hint, eight seconds in, unless the visitor has opened the chat or seen the hint this visit.
  useEffect(() => {
    const key = "qw-ask-nudge";
    try {
      if (window.sessionStorage.getItem(key)) return;
    } catch {
      return;
    }
    const timer = window.setTimeout(() => {
      setNudge(true);
      try {
        window.sessionStorage.setItem(key, "1");
      } catch {
        // Private mode: the hint may show again next visit, which is fine.
      }
    }, 8000);
    return () => window.clearTimeout(timer);
  }, []);

  // The hero's "Ask Qwicoo" button opens this panel without a direct reference to it.
  useEffect(() => {
    const open = () => {
      setNudge(false);
      dispatch("open");
    };
    window.addEventListener(OPEN_ASSISTANT_EVENT, open);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, open);
  }, []);

  function close() {
    dispatch("close");
    requestAnimationFrame(() => button.current?.focus());
  }

  useEffect(() => {
    const measure = () => {
      const width = window.innerWidth;
      const obstacles = [".qw-landing > header", "[data-hero]", "[data-lead]"]
        .map((selector) => document.querySelector(selector)?.getBoundingClientRect())
        .filter((rect): rect is DOMRect => Boolean(rect))
        .map((rect): Box => ({ top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom }));
      const placed = placeLauncher({ width, height: window.innerHeight }, obstacles);
      setNarrow(width < 900);
      setSlot(placed.hidden ? { hidden: true, top: 0, inset: 16 } : placed);
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (!state.open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      dispatch("close");
      requestAnimationFrame(() => button.current?.focus());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.open]);

  const parked = narrow && !slot.hidden;
  const showNudge = nudge && !state.open && !narrow;

  return (
    <>
      <div
        className={`qw-chat fixed grid justify-items-end gap-2 ${state.open ? "z-[55]" : "z-40"} ${parked ? "" : "end-4 bottom-4"} ${narrow && slot.hidden ? "invisible" : ""}`}
        style={parked ? { top: slot.top, insetInlineEnd: slot.inset } : undefined}
      >
        {showNudge ? (
          <div role="status" className="asst-rise flex max-w-[260px] items-start gap-2 rounded-[18px] rounded-ee-[6px] bg-white py-2.5 ps-3.5 pe-2 text-[13px] leading-snug text-ink shadow-[0_8px_24px_rgb(0_0_0/0.14)] ring-1 ring-qw-line">
            <button type="button" className="text-start" onClick={() => { setNudge(false); dispatch("open"); }}>
              {t.nudge}
            </button>
            <button type="button" aria-label={t.nudgeDismiss} className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-quiet hover:bg-canvas hover:text-ink" onClick={() => setNudge(false)}>
              <X aria-hidden className="size-3.5" />
            </button>
          </div>
        ) : null}
        <button
          ref={button}
          type="button"
          aria-expanded={state.open}
          aria-label={t.launcher}
          className="group inline-flex h-14 items-center gap-2.5 rounded-full bg-ink ps-2.5 pe-2.5 text-[15px] font-semibold text-canvas shadow-[0_10px_30px_rgb(0_0_0/0.22)] ring-1 ring-white/15 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring min-[900px]:pe-5"
          onClick={() => {
            setNudge(false);
            dispatch(state.open ? "close" : "open");
          }}
        >
          {state.open ? (
            <span className="inline-flex size-9 items-center justify-center">
              <X aria-hidden className="size-5" />
            </span>
          ) : (
            <AskQwicooMark size={38} tone="light" className="transition-transform group-hover:rotate-[-6deg]" />
          )}
          <span className="hidden min-[900px]:inline">{t.launcherShort}</span>
        </button>
      </div>
      {state.open ? (
        <button type="button" aria-label={t.close} className="fixed inset-0 z-50 bg-ink/15 max-[899px]:hidden" onClick={close} />
      ) : null}
      {state.mounted ? (
        <div
          className={
            state.open
              ? "qw-chat qw-chat-pop fixed inset-0 z-[60] flex min-h-0 flex-col overflow-hidden bg-white max-[899px]:h-dvh min-[900px]:inset-auto min-[900px]:end-4 min-[900px]:bottom-24 min-[900px]:h-[min(40rem,calc(100dvh-8rem))] min-[900px]:w-[25rem] min-[900px]:rounded-[24px] min-[900px]:shadow-[0_24px_60px_rgb(0_0_0/0.22)] min-[900px]:ring-1 min-[900px]:ring-qw-line"
              : "hidden"
          }
        >
          <PublicChatPanel onClose={close} />
        </div>
      ) : null}
    </>
  );
}
