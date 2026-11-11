"use client";

import { useEffect, useRef } from "react";

import { playTone, unlockAudio } from "@/lib/sound/tones";

const READY = new Set(["READY"]);

/**
 * Tells the guest their order is ready while the order page is open: a chime, a vibration, and
 * the tab title, so a guest looking at another tab or app sees it too. The first status seen is a
 * baseline, so reopening the page on a ready order doesn't alert again.
 */
export function useOrderReadyAlert(status: string | null | undefined, message: string) {
  const previous = useRef<string | null>(null);
  const originalTitle = useRef<string | null>(null);

  // Sound needs one tap first; the guest taps to order, so this is normally already done.
  useEffect(() => {
    const unlock = () => void unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!status) return;
    const before = previous.current;
    previous.current = status;
    if (before === null || READY.has(before) || !READY.has(status)) return;

    playTone("ready");
    navigator.vibrate?.([200, 100, 200, 100, 300]);
    if (originalTitle.current === null) originalTitle.current = document.title;
    document.title = `✅ ${message}`;
  }, [status, message]);

  // Put the normal title back a few seconds after the guest returns to the page, and on leaving it.
  useEffect(() => {
    let timer: number | undefined;
    const restore = () => {
      if (originalTitle.current === null) return;
      document.title = originalTitle.current;
      originalTitle.current = null;
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible" || originalTitle.current === null) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(restore, 5000);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(timer);
      restore();
    };
  }, []);
}
