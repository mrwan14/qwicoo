"use client";

import dynamic from "next/dynamic";
import { useReducer, useRef } from "react";

import { landingCopy } from "@/features/marketing/copy";
import { launcherReducer } from "@/features/marketing/public-assistant";
import type { LocaleCode } from "@/lib/i18n/locale-text";

const PublicChatPanel = dynamic(() => import("@/features/marketing/public-chat-panel").then((mod) => mod.PublicChatPanel), {
  ssr: false,
});

export function PublicAssistantLauncher({ locale }: { locale: LocaleCode }) {
  const t = landingCopy[locale].assistant;
  const [state, dispatch] = useReducer(launcherReducer, { open: false, mounted: false });
  const button = useRef<HTMLButtonElement>(null);

  function close() {
    dispatch("close");
    requestAnimationFrame(() => button.current?.focus());
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        className="fixed end-4 bottom-4 z-40 inline-flex min-h-11 items-center bg-primary px-4 text-sm font-medium text-primary-foreground shadow-elev-2"
        onClick={() => dispatch("open")}
      >
        {t.launcher}
      </button>
      {state.mounted ? (
        <div className={state.open ? "fixed inset-0 z-50 sm:inset-auto sm:end-4 sm:bottom-20 sm:h-[36rem] sm:w-[24rem]" : "hidden"}>
          <PublicChatPanel locale={locale} onClose={close} />
        </div>
      ) : null}
    </>
  );
}
