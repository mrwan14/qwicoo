"use client";

import { Eye, EyeOff } from "lucide-react";

/**
 * Eye button that sits inside the end of a password field. Place it in a `relative` wrapper and give
 * the input `pe-11` so typed text never runs under it.
 */
export function PasswordToggle({
  shown,
  onToggle,
  showLabel,
  hideLabel,
}: {
  shown: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  const Icon = shown ? EyeOff : Eye;
  return (
    <button
      type="button"
      aria-label={shown ? hideLabel : showLabel}
      aria-pressed={shown}
      title={shown ? hideLabel : showLabel}
      // Keep focus (and the mobile keyboard) on the field while toggling.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onToggle}
      className="absolute end-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-black/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
    >
      <Icon aria-hidden className="size-[18px]" />
    </button>
  );
}
