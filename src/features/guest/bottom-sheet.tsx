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
import { guestEase, guestPrefersReducedMotion, gsap, useGSAP } from "@/features/guest/motion";
import { useGuestCopy } from "@/features/guest/shell";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Visually hide the title (still announced). */
  titleHidden?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  /** Restore focus to this element when the sheet closes. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

/**
 * Mobile guest bottom sheet — sticky CTA footer, drag handle, blurred dim,
 * swipe / Escape / backdrop / close. Focus trapped by Base UI Sheet.
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
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useGSAP(
    () => {
      if (!open || guestPrefersReducedMotion()) return;
      gsap.fromTo(
        panelRef.current,
        { y: 28, opacity: 0.85 },
        { y: 0, opacity: 1, duration: 0.38, ease: guestEase },
      );
    },
    { dependencies: [open] },
  );

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (wasOpen.current && returnFocusRef?.current) {
      returnFocusRef.current.focus();
    }
    wasOpen.current = false;
    setDragY(0);
  }, [open, returnFocusRef]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragStart.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragStart.current == null) return;
    setDragY(Math.max(0, event.clientY - dragStart.current));
  }

  function onPointerUp() {
    if (dragStart.current == null) return;
    const shouldClose = dragY > 80;
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
        className="guest-theme guest-sheet guest-phone mx-auto flex h-[min(92dvh,100%)] max-h-[92dvh] w-full flex-col gap-0 overflow-hidden border-0 p-0 data-[side=bottom]:inset-x-0"
        style={
          dragY
            ? {
                transform: `translateY(${dragY}px)`,
                transition: reducedMotion || dragStart.current != null ? "none" : undefined,
              }
            : undefined
        }
      >
        <div ref={panelRef} className="flex min-h-0 flex-1 flex-col">
          <div
            className="flex shrink-0 cursor-grab touch-none flex-col items-center px-4 pb-2 pt-2.5 active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className="guest-sheet-handle mb-3" aria-hidden />
            <div className="flex w-full items-center justify-between gap-3">
              <SheetTitle
                id={titleId}
                className={titleHidden ? "sr-only" : "guest-display min-w-0 flex-1 truncate text-[var(--guest-ink)]"}
              >
                {title}
              </SheetTitle>
              <button
                type="button"
                className="guest-icon-btn guest-motion shrink-0 text-xl leading-none"
                aria-label={t.close}
                onClick={close}
              >
                ×
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 [-webkit-overflow-scrolling:touch]">
            {children}
          </div>
          {footer ? <div className="guest-sheet-footer shrink-0">{footer}</div> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
