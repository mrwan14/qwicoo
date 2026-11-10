"use client";

/**
 * Short alert tones. Browsers keep audio locked until the first tap or keypress.
 * `new`: an order or ticket arrived. `ready`: food is ready. `request`: a guest wants someone.
 * `payment`: money is waiting.
 */
export type Tone = "new" | "ready" | "request" | "payment";

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

type Note = { at: number; hz: number; length: number };

// Each tone has its own shape so staff can tell them apart without looking.
const TONES: Record<Tone, { wave: OscillatorType; notes: Note[] }> = {
  // Two rising notes: something new to do.
  new: { wave: "triangle", notes: [{ at: 0, hz: 660, length: 0.14 }, { at: 0.16, hz: 880, length: 0.2 }] },
  // A bright double ping: food is ready.
  ready: { wave: "sine", notes: [{ at: 0, hz: 1320, length: 0.12 }, { at: 0.17, hz: 1320, length: 0.16 }] },
  // Three quick knocks: a guest is waiting for someone.
  request: { wave: "square", notes: [{ at: 0, hz: 988, length: 0.08 }, { at: 0.13, hz: 988, length: 0.08 }, { at: 0.26, hz: 988, length: 0.1 }] },
  // A two-note chime falling into place: money is waiting.
  payment: { wave: "sine", notes: [{ at: 0, hz: 784, length: 0.16 }, { at: 0.18, hz: 1047, length: 0.3 }] },
};

// Square waves sound much louder at the same level, so they are played quieter.
const LEVEL: Record<OscillatorType, number> = { sine: 0.7, triangle: 0.7, square: 0.22, sawtooth: 0.3, custom: 0.5 };

/** Plays one alert tone. Returns false while audio is still locked. */
export function playTone(tone: Tone = "new"): boolean {
  const ctx = ensureContext();
  if (!ctx || !isAudioUnlocked()) return false;
  const { wave, notes } = TONES[tone];
  const peak = LEVEL[wave];
  for (const note of notes) {
    const start = ctx.currentTime + note.at;
    const end = start + note.length;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = wave;
    oscillator.frequency.value = note.hz;
    // A short fade in and out, so notes don't click on tablet speakers.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }
  return true;
}
