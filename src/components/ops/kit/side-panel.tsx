"use client";

import { Dialog } from "@base-ui/react/dialog";
import { cn } from "cn";
import { ChevronDown, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { useSmoothOpen } from "@/components/ui/use-smooth-open";
import { kitCopy } from "@/lib/i18n/staff/kit";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

/** Add, edit and detail views slide in from the end side (left in Arabic) over a dimmed scrim. */
export function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  meta,
  footer,
  size = "md",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Badges under the title, e.g. order status. */
  meta?: ReactNode;
  footer?: ReactNode;
  /** 420px, or 480px for longer forms like Add item. */
  size?: "md" | "lg";
  children: ReactNode;
}) {
  const t = useStaffSection(kitCopy);
  const smooth = useSmoothOpen({ open, onOpenChange });
  return (
    <Dialog.Root {...smooth}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-scrim backdrop-blur-[2px] transition-opacity duration-300 ease-out data-ending-style:opacity-0 data-ending-style:duration-200 data-starting-style:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 end-0 z-50 flex w-full flex-col border-s border-border bg-canvas text-ink shadow-panel outline-none will-change-transform transition-transform duration-[420ms] ease-drawer data-ending-style:duration-[260ms] data-ending-style:ease-in data-ending-style:translate-x-full data-starting-style:translate-x-full rtl:data-ending-style:-translate-x-full rtl:data-starting-style:-translate-x-full",
            size === "lg" ? "sm:max-w-[480px]" : "sm:max-w-[420px]",
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="grid min-w-0 gap-1.5">
              <Dialog.Title className="text-lg leading-snug font-semibold text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-ink-secondary">{description}</Dialog.Description>
              ) : null}
              {meta ? <div className="flex flex-wrap gap-1.5">{meta}</div> : null}
            </div>
            <Dialog.Close
              aria-label={t.close}
              className="-me-2 inline-flex size-10 shrink-0 items-center justify-center rounded-staff text-ink hover:bg-subtle focus-visible:outline-2 focus-visible:outline-focus"
            >
              <X aria-hidden className="size-5" />
            </Dialog.Close>
          </header>
          <div className="grid flex-1 content-start gap-5 overflow-y-auto overscroll-contain p-5">{children}</div>
          {footer ? (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4">{footer}</footer>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A titled block inside a panel ("Choices", "Per branch"), separated by a rule. */
export function PanelSection({
  title,
  hint,
  action,
  children,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="grid gap-2.5 border-t border-border pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {hint ? <p className="text-xs text-ink-secondary">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Rarely used fields stay folded away so the panel opens short. */
export function MoreOptions({
  summary,
  label,
  defaultOpen = false,
  children,
}: {
  /** What's inside, e.g. "Description, station, prep time". */
  summary?: ReactNode;
  label?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const t = useStaffSection(kitCopy);
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="border-t border-border pt-3.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 rounded-staff text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="grid gap-0.5">
          <span className="text-sm font-semibold text-ink">{label ?? t.moreOptions}</span>
          {summary ? <span className="text-xs text-ink-secondary">{summary}</span> : null}
        </span>
        <ChevronDown aria-hidden className={cn("size-[18px] shrink-0 text-ink transition-transform", open && "rotate-180")} />
      </button>
      <div id={id} hidden={!open} className="mt-4 grid gap-4">
        {children}
      </div>
    </section>
  );
}
