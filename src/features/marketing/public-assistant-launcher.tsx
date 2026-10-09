"use client";

import dynamic from "next/dynamic";
import { useEffect, useReducer, useRef, useState } from "react";

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

  function close() {
    dispatch("close");
    requestAnimationFrame(() => button.current?.focus());
  }

  useEffect(() => {
    const measure = () => {
      const width = window.innerWidth;
      const obstacles = ["[data-hero]", "[data-lead]"]
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

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-expanded={state.open}
        aria-label={t.launcher}
        className={`fixed z-40 inline-flex size-14 items-center justify-center bg-ink shadow-elev-2 ${parked ? "" : "end-4 bottom-4"} ${narrow && slot.hidden ? "invisible" : ""}`}
        style={parked ? { top: slot.top, insetInlineEnd: slot.inset } : undefined}
        onClick={() => dispatch(state.open ? "close" : "open")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/icon-192.png" alt="" className="size-8" />
      </button>
      {state.open ? (
        <button type="button" aria-label={t.close} className="fixed inset-0 z-50 bg-ink/45 max-[899px]:hidden" onClick={close} />
      ) : null}
      {state.mounted ? (
        <div
          className={
            state.open
              ? "fixed inset-0 z-[60] flex min-h-0 flex-col bg-canvas max-[899px]:h-dvh min-[900px]:inset-auto min-[900px]:end-4 min-[900px]:bottom-24 min-[900px]:h-[36rem] min-[900px]:w-96 min-[900px]:border min-[900px]:border-qw-line"
              : "hidden"
          }
        >
          <PublicChatPanel onClose={close} />
        </div>
      ) : null}
    </>
  );
}
