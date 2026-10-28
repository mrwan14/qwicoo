"use client";

import { useIsMutating } from "@tanstack/react-query";
import { cn } from "cn";
import { Check, ChevronDown, Store } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ops/kit/confirm-dialog";
import { Menu, MenuContent, MenuHeading, MenuItem, MenuTrigger } from "@/components/ops/kit/menu";
import { fill } from "@/lib/i18n/dictionary";
import { commonCopy } from "@/lib/i18n/staff/common";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { switchBranch } from "@/lib/auth/session-client";
import { useScope } from "@/stores/scope";

function useBranchChoice() {
  const t = useStaffSection(commonCopy);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState(0);

  function choose(branchId: string) {
    const items = useScope.getState().switchGuard?.pendingItems() ?? 0;
    if (items > 0) {
      setPendingItems(items);
      setPendingId(branchId);
      return;
    }
    void switchBranch(branchId);
  }

  const confirm = (
    <ConfirmDialog
      open={Boolean(pendingId)}
      onOpenChange={(open) => !open && setPendingId(null)}
      title={t.switchBranchTitle}
      body={fill(t.switchBranchBody, { count: pendingItems, items: pendingItems === 1 ? t.item : t.items })}
      confirmLabel={t.clearAndSwitch}
      onConfirm={() => {
        const target = pendingId;
        setPendingId(null);
        if (target) void switchBranch(target);
      }}
    />
  );

  return { choose, confirm };
}

/**
 * Only the caller's own branches. With one branch it shows the name without a menu;
 * `hideSingle` drops it entirely (the front-line bar already names the branch).
 */
export function BranchSwitcher({ hideSingle = false, className }: { hideSingle?: boolean; className?: string }) {
  const branches = useScope((state) => state.branches);
  const branchId = useScope((state) => state.branchId);
  const t = useStaffSection(commonCopy);
  const busy = useIsMutating() > 0;
  const { choose, confirm } = useBranchChoice();

  if (branches.length === 0 || (hideSingle && branches.length < 2)) return null;
  const current = branches.find((branch) => branch.id === branchId) ?? branches[0];
  const face = "flex h-[38px] max-w-56 items-center gap-2 rounded-staff border border-border bg-canvas px-3 text-sm font-medium text-ink";

  if (branches.length < 2) {
    return (
      <span className={cn(face, className)}>
        <Store aria-hidden className="size-4 shrink-0" />
        <span className="sr-only">{t.branch}: </span>
        <span className="truncate">{current.name}</span>
      </span>
    );
  }

  return (
    <>
      <Menu>
        <MenuTrigger
          disabled={busy}
          title={busy ? t.finishAction : undefined}
          aria-label={`${t.switchBranch}: ${current.name}`}
          className={cn(
            face,
            "outline-none hover:border-ink-secondary/50 focus-visible:border-focus disabled:cursor-not-allowed disabled:text-disabled",
            className,
          )}
        >
          <Store aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{current.name}</span>
          <ChevronDown aria-hidden className="size-3.5 shrink-0 text-ink-secondary" />
        </MenuTrigger>
        <MenuContent align="end">
          <MenuHeading>{t.switchBranch}</MenuHeading>
          {branches.map((branch) => {
            const active = branch.id === current.id;
            return (
              <MenuItem key={branch.id} aria-current={active ? "true" : undefined} onClick={() => !active && choose(branch.id)}>
                <span className={cn("min-w-0 flex-1 truncate", active && "font-semibold")}>{branch.name}</span>
                {active ? <Check aria-hidden className="text-ink!" /> : null}
              </MenuItem>
            );
          })}
        </MenuContent>
      </Menu>
      {confirm}
    </>
  );
}
