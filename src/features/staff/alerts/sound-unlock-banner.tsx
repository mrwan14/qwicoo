"use client";

import { VolumeX } from "lucide-react";
import { useEffect, useState } from "react";

import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { isAudioUnlocked, onAudioUnlocked, playTone, unlockAudio } from "@/lib/sound/tones";

import { useAlertPreferences } from "./preferences";

/**
 * Browsers block sound after every reload until someone taps. A kitchen tablet that reloaded
 * overnight would stay silent, so while alerts have sound on and audio is still locked, this bar
 * stays on screen. Any tap anywhere unlocks audio and hides it.
 */
export function SoundUnlockBanner() {
  const t = useStaffSection(commonCopy);
  const { soundOn } = useAlertPreferences();
  const [unlocked, setUnlocked] = useState(true);

  useEffect(() => {
    setUnlocked(isAudioUnlocked());
    return onAudioUnlocked(() => setUnlocked(true));
  }, []);

  if (!soundOn || unlocked) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <button
        type="button"
        // Phones get a small pill (it otherwise covers a sixth of the screen); wider screens the full bar.
        className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-ink py-2 ps-3 pe-4 text-start text-on-ink shadow-dialog focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:gap-3 sm:py-2.5 sm:ps-4 sm:pe-5"
        // pointerdown, not click: the app-wide unlock on pointerdown hides this bar before a click would land.
        onPointerDown={() => void unlockAudio().then(() => playTone("new"))}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") void unlockAudio().then(() => playTone("new"));
        }}
      >
        <VolumeX aria-hidden className="size-4 shrink-0 sm:size-5" />
        <span className="text-[13px] font-semibold sm:hidden">{t.soundLockedShort}</span>
        <span className="hidden min-w-0 sm:grid">
          <span className="text-sm font-semibold">{t.soundLocked}</span>
          <span className="text-xs opacity-75">{t.soundLockedBody}</span>
        </span>
        <span className="ms-2 hidden shrink-0 rounded-full bg-on-ink px-3 py-1 text-[13px] font-semibold text-ink sm:inline">{t.enable}</span>
      </button>
    </div>
  );
}
