"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useGuestCopy } from "@/features/guest/shell";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  /** Visually hide the title (still announced). */
  titleHidden?: boolean;
  footer?: ReactNode;
  /** Restore focus to this element when the sheet closes. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

/**
 * Guest bottom sheet: dimmed backdrop, drag handle, swipe / Escape / close /
 * backdrop dismiss, focus trap via Base UI Sheet, full-height on small phones.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
  titleHidden = false,
  footer,
  returnFocusRef,
}: BottomSheetProps) {
  const { t } = useGuestCopy();
  const titleId = useId();
  const wasOpen = useRef(false);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (wasOpen.current && returnFocusRef?.current) {
      returnFocusRef.current.focus();
    }
    wasOpen.current = false;
  }, [open, returnFocusRef]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragStart.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragStart.current == null) return;
    const delta = Math.max(0, event.clientY - dragStart.current);
    setDragY(delta);
  }

  function onPointerUp() {
    if (dragStart.current == null) return;
    const shouldClose = dragY > 96;
    dragStart.current = null;
    setDragY(0);
    if (shouldClose) close();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-labelledby={titleId}
        className="guest-theme mx-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col gap-0 overflow-hidden rounded-t-[var(--guest-radius-sheet)] border-0 bg-[var(--guest-canvas)] p-0 shadow-[var(--guest-shadow)] sm:h-auto sm:max-h-[85dvh]"
        style={
          dragY
            ? {
                transform: `translateY(${dragY}px)`,
                transition: reducedMotion || dragStart.current != null ? "none" : undefined,
              }
            : undefined
        }
      >
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col items-center px-4 pb-2 pt-3 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="mb-3 h-1.5 w-12 rounded-full bg-[var(--guest-line)]" aria-hidden />
          <div className="flex w-full items-start justify-between gap-3">
            <SheetTitle
              id={titleId}
              className={titleHidden ? "sr-only" : "guest-display text-xl text-[var(--guest-ink)]"}
            >
              {title}
            </SheetTitle>
            <button
              type="button"
              className="guest-pill inline-flex size-11 shrink-0 items-center justify-center bg-white text-lg text-[var(--guest-ink)] shadow-[var(--guest-shadow-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--guest-orange)]"
              aria-label={t.close}
              onClick={close}
            >
              ×
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-[var(--guest-line)] bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
