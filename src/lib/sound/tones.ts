"use client";

/** Short staff alert tones. Browsers keep audio locked until the first tap or keypress. */
export type Tone = "new" | "ready";

let context: AudioContext | null = null;
let unlocked = false;
const listeners = new Set<() => void>();

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  return context;
}

export function isAudioUnlocked(): boolean {
  return unlocked || context?.state === "running";
}

/** Call from a user gesture. Resolves once the browser lets us play. */
export async function unlockAudio(): Promise<void> {
  const ctx = ensureContext();
  if (!ctx) return;
  try {
    if (ctx.state !== "running") await ctx.resume();
    unlocked = ctx.state === "running";
  } catch {
    unlocked = false;
  }
  if (unlocked) for (const listener of listeners) listener();
}

export function onAudioUnlocked(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `new`: the existing 880 Hz kitchen beep. `ready`: a short, higher double tone. */
export function playTone(tone: Tone = "new"): boolean {
  const ctx = ensureContext();
  if (!ctx || !isAudioUnlocked()) return false;
  const pulses = tone === "ready" ? [{ at: 0, hz: 1320 }, { at: 0.16, hz: 1320 }] : [{ at: 0, hz: 880 }];
  for (const pulse of pulses) {
    const oscillator = ctx.createOscillator();
    oscillator.frequency.value = pulse.hz;
    oscillator.connect(ctx.destination);
    oscillator.start(ctx.currentTime + pulse.at);
    oscillator.stop(ctx.currentTime + pulse.at + 0.12);
  }
  return true;
}
