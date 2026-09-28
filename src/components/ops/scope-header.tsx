"use client";

import { useIsMutating } from "@tanstack/react-query";
import { Check, ChevronDown, Store } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { Logo } from "@/components/ops/logo";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { initials } from "@/lib/auth/scope";
import { switchBranch } from "@/lib/auth/session-client";
import { mediaUrl } from "@/lib/media";
import { useScope } from "@/stores/scope";

/** Brand identity for brand and branch scope; Qwicoo platform branding for App Admin. */
export function ScopeBadge({ compact = false }: { compact?: boolean }) {
  const homeScope = useScope((state) => state.homeScope);
  const brandName = useScope((state) => state.brandName);
  const brandLogoUrl = useScope((state) => state.brandLogoUrl);
  const [logoFailed, setLogoFailed] = useState(false);

  if (homeScope === "platform" || !homeScope) {
    return (
      <Logo
        className="min-w-0"
        markClassName="size-6 shrink-0 text-primary"
        wordClassName={compact ? "sr-only" : "truncate text-base"}
      />
    );
  }

  const name = brandName ?? "Your brand";
  const logo = brandLogoUrl && !logoFailed ? mediaUrl(brandLogoUrl) : null;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-xs font-semibold text-primary">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={name} className="size-full object-contain" onError={() => setLogoFailed(true)} />
        ) : (
          <span aria-hidden>{initials(name)}</span>
        )}
      </span>
      <span className={compact ? "sr-only" : "truncate font-display text-base font-semibold"}>{name}</span>
    </span>
  );
}

function useBranchChoice() {
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
      title="Switch branch?"
      description={`The open ticket has ${pendingItems} ${pendingItems === 1 ? "item" : "items"}. Switching clears it so nothing is sent to the wrong branch.`}
      confirmLabel="Clear ticket and switch"
      destructive
      onConfirm={() => {
        const target = pendingId;
        setPendingId(null);
        if (target) void switchBranch(target);
      }}
    />
  );

  return { choose, confirm };
}

/** Only the caller's own branches. Hidden when there is nothing to switch between. */
export function BranchSwitcher() {
  const branches = useScope((state) => state.branches);
  const branchId = useScope((state) => state.branchId);
  const busy = useIsMutating() > 0;
  const [sheetOpen, setSheetOpen] = useState(false);
  const { choose, confirm } = useBranchChoice();

  if (branches.length < 2) return null;
  const current = branches.find((branch) => branch.id === branchId) ?? branches[0];

  return (
    <>
      <label className="hidden min-w-0 items-center gap-2 text-sm lg:flex">
        <Store aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">Branch</span>
        <select
          className="h-10 max-w-56 rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-60"
          value={current.id}
          disabled={busy}
          title={busy ? "Finish the current action before switching branch" : undefined}
          onChange={(event) => choose(event.target.value)}
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </label>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger
          disabled={busy}
          className="inline-flex h-10 max-w-[11rem] items-center gap-1.5 rounded-lg border px-3 text-sm disabled:opacity-60 lg:hidden"
        >
          <Store aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{current.name}</span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[80dvh]">
          <SheetHeader>
            <SheetTitle>Switch branch</SheetTitle>
          </SheetHeader>
          <ul className="grid gap-1 px-4 pb-6">
            {branches.map((branch) => {
              const active = branch.id === current.id;
              return (
                <li key={branch.id}>
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-start text-sm ${active ? "bg-secondary font-medium" : "hover:bg-muted"}`}
                    onClick={() => {
                      setSheetOpen(false);
                      choose(branch.id);
                    }}
                  >
                    {branch.name}
                    {active ? <Check aria-hidden className="size-4 text-primary" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
      {confirm}
    </>
  );
}
