"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu as MenuIcon, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { BranchSwitcher } from "@/components/ops/scope-header";
import { FrontlineBar } from "@/components/ops/shell/frontline-bar";
import { GlobalSearch } from "@/components/ops/shell/global-search";
import { SidebarContent } from "@/components/ops/shell/sidebar";
import { UserMenu } from "@/components/ops/shell/user-menu";
import { useStaffSession } from "@/components/ops/staff-session";
import { AlertControls } from "@/features/staff/alerts/alert-controls";
import { AskQwicooButton } from "@/features/staff/assistant/ask-qwicoo";
import { StaffConnectionBanner } from "@/features/staff/offline/staff-connection-banner";
import { usePendingConfirmationCount } from "@/hooks/use-floor-live";
import { commonCopy } from "@/lib/i18n/staff/common";
import { kitCopy } from "@/lib/i18n/staff/kit";
import { shellCopy } from "@/lib/i18n/staff/shell";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import {
  activeSidebarKey,
  frontlineScreens,
  isFrontlineRole,
  navForUser,
  sidebarForUser,
  type NavItem,
  type SidebarEntry,
  type SidebarKey,
} from "@/lib/nav";
import { useScope } from "@/stores/scope";

function SkipLink() {
  const t = useStaffSection(commonCopy);
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded-staff focus:bg-ink focus:px-3 focus:py-2 focus:text-on-ink"
    >
      {t.skip}
    </a>
  );
}

function ConnectionBanner({ items }: { items: readonly NavItem[] }) {
  return (
    <div className="print:hidden">
      <StaffConnectionBanner canSellOffline={items.some((item) => item.href === "/app/pos")} />
    </div>
  );
}

/** Below `lg` the sidebar opens as a drawer from the reading start (left in English, right in Arabic). */
function NavDrawer({
  open,
  onOpenChange,
  entries,
  items,
  activeKey,
  badges,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: readonly SidebarEntry[];
  items: readonly NavItem[];
  activeKey: SidebarKey | null;
  badges: Partial<Record<SidebarKey, number>>;
}) {
  const t = useStaffSection(shellCopy);
  const kit = useStaffSection(kitCopy);
  const close = () => onOpenChange(false);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-scrim backdrop-blur-[2px] transition-opacity duration-300 ease-out data-ending-style:duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 lg:hidden" />
        <Dialog.Popup
          aria-label={t.mainNav}
          className="fixed inset-y-0 start-0 z-50 flex w-[280px] max-w-[85vw] flex-col overflow-y-auto border-e border-border bg-subtle shadow-panel outline-none will-change-transform transition-transform duration-[380ms] ease-drawer data-ending-style:duration-[240ms] data-ending-style:ease-in data-ending-style:-translate-x-full data-starting-style:-translate-x-full rtl:data-ending-style:translate-x-full rtl:data-starting-style:translate-x-full lg:hidden"
        >
          <SidebarContent
            entries={entries}
            activeKey={activeKey}
            badges={badges}
            onNavigate={close}
            headerEnd={
              <Dialog.Close
                aria-label={kit.close}
                className="-me-2 inline-flex size-10 shrink-0 items-center justify-center rounded-staff text-ink-secondary hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
              >
                <X aria-hidden className="size-4" />
              </Dialog.Close>
            }
            beforeNav={<GlobalSearch items={items} entries={entries} onNavigate={close} className="mb-3" />}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AdminShell({ children }: { children: ReactNode }) {
  const t = useStaffSection(shellCopy);
  const pathname = usePathname();
  const me = useStaffSession();
  const activeBranchId = useScope((state) => state.branchId);
  const pending = usePendingConfirmationCount();
  const [navOpen, setNavOpen] = useState(false);
  if (!me) return null;

  const items = navForUser(me, activeBranchId);
  const entries = sidebarForUser(me, activeBranchId);
  const activeKey = activeSidebarKey(pathname, entries, items);
  const badges: Partial<Record<SidebarKey, number>> = pending ? { orders: pending } : {};

  return (
    <div className="flex min-h-dvh bg-canvas text-ink">
      <SkipLink />
      <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 overflow-y-auto border-e border-border bg-subtle print:hidden lg:block">
        <SidebarContent entries={entries} activeKey={activeKey} badges={badges} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <ConnectionBanner items={items} />
        <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-border bg-subtle px-4 print:hidden sm:px-6">
          <button
            type="button"
            aria-label={t.openNav}
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
            className="-ms-1.5 inline-flex size-10 shrink-0 items-center justify-center rounded-staff text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-focus lg:hidden"
          >
            <MenuIcon aria-hidden className="size-5" />
          </button>
          <GlobalSearch items={items} entries={entries} className="hidden w-[340px] min-w-0 shrink md:block" />
          <div className="ms-auto flex min-w-0 items-center gap-2 sm:gap-4">
            <AskQwicooButton />
            <BranchSwitcher className="min-w-0" />
            <div className="flex items-center text-ink">
              <AlertControls />
            </div>
            <UserMenu />
          </div>
        </header>
        <main id="main" className="grid flex-1 grid-cols-1 content-start px-4 py-5 sm:p-6">
          {children}
        </main>
      </div>
      <NavDrawer
        open={navOpen}
        onOpenChange={setNavOpen}
        entries={entries}
        items={items}
        activeKey={activeKey}
        badges={badges}
      />
    </div>
  );
}

function FrontlineShell({ children }: { children: ReactNode }) {
  const me = useStaffSession();
  const activeBranchId = useScope((state) => state.branchId);
  const pending = usePendingConfirmationCount();
  if (!me) return null;

  const items = navForUser(me, activeBranchId);
  const screens = frontlineScreens(me, activeBranchId);
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <SkipLink />
      <ConnectionBanner items={items} />
      <FrontlineBar screens={screens} badges={pending ? { "/app/floor": pending } : {}} />
      <main id="main" className="grid flex-1 grid-cols-1 content-start p-4 md:p-5">
        {children}
      </main>
    </div>
  );
}

/** Admins get the sidebar shell; cashier, waiter, kitchen and runner get the slim front-line bar. */
export function RoleChrome({ children }: { children: ReactNode }) {
  const me = useStaffSession();
  if (!me) return null;
  return isFrontlineRole(me.role) ? <FrontlineShell>{children}</FrontlineShell> : <AdminShell>{children}</AdminShell>;
}
