"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import type { ReactNode } from "react";

import { Button } from "@/components/ops/kit/button";
import { commonCopy } from "@/lib/i18n/staff/common";
import { kitCopy } from "@/lib/i18n/staff/kit";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

/** Only deletes ask for confirmation. Everything else saves straight away and shows a toast. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  body: ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  const t = useStaffSection(kitCopy);
  const common = useStaffSection(commonCopy);
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-scrim transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-staff border border-border bg-canvas p-6 text-ink shadow-dialog outline-none transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0">
          <AlertDialog.Title className="text-lg font-semibold text-ink">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-sm leading-normal text-ink-secondary">{body}</AlertDialog.Description>
          <div className="flex flex-wrap justify-end gap-2">
            <AlertDialog.Close disabled={pending} render={<Button variant="secondary" />}>
              {common.cancel}
            </AlertDialog.Close>
            <Button variant="danger" disabled={pending} onClick={onConfirm}>
              {pending ? t.deleting : (confirmLabel ?? t.delete)}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
