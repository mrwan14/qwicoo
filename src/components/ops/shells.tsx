"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  ClipboardList,
  ConciergeBell,
  LayoutGrid,
  Monitor,
  QrCode,
  Receipt,
  Settings2,
  Shield,
  Store,
  Truck,
  UserPlus,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { BrandBranchSwitcher } from "@/components/ops/brand-branch-switcher";
import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { ConnectionBanner } from "@/components/ops/connection-banner";
import { useStaffSession } from "@/components/ops/staff-session";
import { roleLabel, type UserRole } from "@/lib/auth/roles";
import { isNavActive, navForRole, splitBottomNav, type NavItem } from "@/lib/nav";
import { useWorkspace } from "@/stores/workspace";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const ICONS: Record<string, LucideIcon> = {
  "/app/floor": LayoutGrid,
  "/app/floor/requests": ConciergeBell,
  "/app/pos": Receipt,
  "/app/kds": Monitor,
  "/app/kds/expo": ClipboardList,
  "/app/payments": Wallet,
  "/app/menu": UtensilsCrossed,
  "/app/qr": QrCode,
  "/app/brands": Store,
  "/app/staff": Users,
  "/app/invitations": UserPlus,
  "/app/team": UserPlus,
  "/app/features": Settings2,
  "/app/delivery": Truck,
  "/app/financials": Wallet,
  "/app/attendance": ClipboardList,
  "/app/analytics": BarChart3,
  "/app/audit": Shield,
};

function itemIcon(href: string): LucideIcon {
  return ICONS[href] ?? Store;
}

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  useWorkspace.getState().clear();
  window.location.assign("/");
}

function NavLinks({
  items,
  pathname,
  compact = false,
  onNavigate,
}: {
  items: readonly NavItem[];
  pathname: string;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const groups = ["Portfolio", "Brand ops", "Insight"] as const;
  return (
    <nav aria-label="Staff" className="grid gap-4">
      {groups.map((group) => {
        const groupItems = items.filter((item) => item.group === group);
        if (groupItems.length === 0) return null;
        return (
          <div key={group} className="grid gap-1">
            {compact ? null : (
              <p className="px-2 text-xs font-medium text-muted-foreground">{group}</p>
            )}
            {groupItems.map((item) => {
              const Icon = itemIcon(item.href);
              const active = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  title={item.label}
                  onClick={onNavigate}
                  className={`flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm ${
                    active ? "bg-secondary font-medium" : "hover:bg-muted"
                  } ${compact ? "justify-center" : ""}`}
                >
                  <Icon aria-hidden className="size-4 shrink-0" />
                  {compact ? <span className="sr-only">{item.label}</span> : item.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

function SignOutButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className ?? "min-h-11 rounded-lg px-3 text-sm hover:bg-muted"}
        onClick={() => setOpen(true)}
      >
        Sign out
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Sign out?"
        description="This clears your staff session on this browser."
        confirmLabel="Sign out"
        destructive
        pending={pending}
        onConfirm={() => {
          setPending(true);
          void signOut();
        }}
      />
    </>
  );
}

function ShellFrame({
  children,
  variant,
}: {
  children: ReactNode;
  variant: "admin" | "ops";
}) {
  const pathname = usePathname();
  const me = useStaffSession();
  const [moreOpen, setMoreOpen] = useState(false);
  if (!me) return null;

  const items = navForRole(me.role);
  const { primary, overflow } = splitBottomNav(me.role, items);
  const opsTabs = [...primary, ...overflow];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="print:hidden">
        <ConnectionBanner />
      </div>
      <div className="flex min-h-dvh">
        {variant === "admin" ? (
          <>
            <aside className="sticky top-0 flex h-dvh w-16 shrink-0 flex-col gap-3 border-e bg-card p-2 print:hidden lg:hidden">
              <NavLinks items={items} pathname={pathname} compact />
            </aside>
            <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-4 border-e bg-card p-3 print:hidden lg:flex">
              <p className="px-2 text-sm font-semibold">Qwicoo</p>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <NavLinks items={items} pathname={pathname} />
              </div>
            </aside>
          </>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-12 items-center justify-between gap-3 border-b px-3 py-2 print:hidden">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <BrandBranchSwitcher />
              {variant === "ops" ? (
                <nav aria-label="Ops" className="flex min-w-0 gap-1 overflow-x-auto">
                  {opsTabs.map((item) => {
                    const active = isNavActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm ${
                          active ? "bg-secondary font-semibold" : "hover:bg-muted"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <p className="hidden text-end text-sm sm:block">
                <span className="block font-medium">{me.full_name}</span>
                <span className="block text-xs text-muted-foreground">{roleLabel(me.role)}</span>
              </p>
              <SignOutButton />
            </div>
          </header>
          <div id="main" className="flex-1 px-4 py-4 pb-24 sm:pb-6">
            {children}
          </div>
        </div>
      </div>
      <nav
        aria-label="Primary"
        className={`fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] print:hidden sm:hidden ${variant === "admin" ? "hidden" : "flex"}`}
      >
        {primary.map((item) => {
          const Icon = itemIcon(item.href);
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs ${
                active ? "font-semibold" : ""
              }`}
            >
              <Icon aria-hidden className="size-5" />
              {item.label}
            </Link>
          );
        })}
        {overflow.length > 0 ? (
          <button
            type="button"
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs"
            onClick={() => setMoreOpen(true)}
          >
            More
          </button>
        ) : null}
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh]">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-6">
            {overflow.length === 0 ? (
              <p className="text-sm text-muted-foreground">No other modules for this role.</p>
            ) : (
              <NavLinks
                items={overflow}
                pathname={pathname}
                onNavigate={() => setMoreOpen(false)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  return <ShellFrame variant="admin">{children}</ShellFrame>;
}

export function OpsShell({ children }: { children: ReactNode }) {
  return <ShellFrame variant="ops">{children}</ShellFrame>;
}

const ADMIN_ROLES = new Set<UserRole>(["SUPER_ADMIN", "BRAND_ADMIN", "REGIONAL_MANAGER", "BRANCH_ADMIN"]);

export function RoleChrome({ children }: { children: ReactNode }) {
  const me = useStaffSession();
  if (!me) return null;
  if (ADMIN_ROLES.has(me.role)) return <AdminShell>{children}</AdminShell>;
  return <OpsShell>{children}</OpsShell>;
}
