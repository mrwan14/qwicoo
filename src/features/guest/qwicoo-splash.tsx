"use client";

import { useEffect, useState } from "react";

import { AnimatedLogo, usePrefersReducedMotion } from "@/components/brand/animated-logo";

const MAX_MS = 2500;
const KEY = "qwicoo-splash:";

/**
 * Brief Qwicoo splash over the QR landing. Children render underneath from the
 * start, so presence checks and menu data load while it plays. Once per table session.
 */
export function QwicooSplash({ sessionKey }: { sessionKey: string }) {
  const reduced = usePrefersReducedMotion();
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(KEY + sessionKey)) return;
      window.sessionStorage.setItem(KEY + sessionKey, "1");
    } catch {
      // Private mode: show it anyway.
    }
    setShow(true);
  }, [sessionKey]);

  useEffect(() => {
    if (!show) return;
    const timer = window.setTimeout(() => setLeaving(true), reduced ? 900 : MAX_MS);
    return () => window.clearTimeout(timer);
  }, [show, reduced]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setShow(false), 250);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  if (!show) return null;
  return (
    <button
      type="button"
      aria-label="Skip intro"
      onClick={() => setLeaving(true)}
      className={`fixed inset-0 z-50 grid place-items-center bg-background px-8 transition-opacity duration-200 ${leaving ? "opacity-0" : "opacity-100"}`}
    >
      {/* Play the last 2.5 s: the hand-off to the settled logo. */}
      <AnimatedLogo className="max-w-sm shadow-elev-1" startAt={3.7} onEnded={() => setLeaving(true)} />
      <span className="absolute bottom-8 text-xs text-muted-foreground">Tap to skip</span>
    </button>
  );
}
