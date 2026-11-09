"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lets a controlled Base UI dialog animate in and out even when the caller mounts it already
 * open (`{selected ? <Panel open … /> : null}`) and unmounts it on close.
 *
 * Base UI skips the enter transition for a popup that is open on its first render, and an
 * unmount cuts the exit transition. So the popup opens one frame after mount, and a close the
 * user asks for (Escape, scrim, close button) plays out before the caller's `onOpenChange(false)`.
 * Uncontrolled dialogs (`open` undefined) pass straight through.
 */
export function useSmoothOpen<Details>({
  open,
  onOpenChange,
  onOpenChangeComplete,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean, details: Details) => void;
  onOpenChangeComplete?: (open: boolean) => void;
}) {
  const [ready, setReady] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeDetails = useRef<Details | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // The caller closed it itself, so nothing is left to defer.
  if (!open && closing) setClosing(false);

  if (open === undefined) return { onOpenChange, onOpenChangeComplete };

  return {
    open: ready && open && !closing,
    onOpenChange(next: boolean, details: Details) {
      if (next) {
        onOpenChange?.(true, details);
        return;
      }
      closeDetails.current = details;
      setClosing(true);
    },
    onOpenChangeComplete(next: boolean) {
      if (!next && closing) {
        setClosing(false);
        onOpenChange?.(false, closeDetails.current as Details);
      }
      onOpenChangeComplete?.(next);
    },
  };
}
