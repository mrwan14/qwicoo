"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  ClipboardList,
  ConciergeBell,
  LayoutGrid,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
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

import { ConfirmDialog } from "@/components/ops/confirm-dialog";
import { ConnectionBanner } from "@/components/ops/connection-banner";
import { BranchSwitcher, ScopeBadge } from "@/components/ops/scope-header";
import { useStaffSession } from "@/components/ops/staff-session";
import { roleLabel, type UserRole } from "@/lib/auth/roles";
import { endStaffSession } from "@/lib/auth/session-client";
import { isNavActive, navForUser, navKey, splitBottomNav, type NavItem } from "@/lib/nav";
import { useScope } from "@/stores/scope";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const SIDEBAR_STORAGE_KEY = "qwicoo-sidebar";

type SidebarLayout = "full" | "compact" | "auto";

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
  "brand-dashboard": Store,
  "branch-settings": Settings2,
};

function itemIcon(item: NavItem): LucideIcon {
  return ICONS[navKey(item)] ?? Store;
}

function NavLinks({
  items,
  pathname,
  layout = "full",
  onNavigate,
}: {
  items: readonly NavItem[];
  pathname: string;
  layout?: SidebarLayout;
  onNavigate?: () => void;
}) {
  const groups = ["Portfolio", "Brand ops", "Insight"] as const;
  const groupClass =
    layout === "compact" ? "hidden" : layout === "auto" ? "hidden lg:block" : "";
  const linkClass =
    layout === "compact"
      ? "justify-center"
      : layout === "auto"
        ? "justify-center lg:justify-start"
        : "";
  const labelClass =
    layout === "compact" ? "sr-only" : layout === "auto" ? "sr-only lg:not-sr-only" : "truncate";
  return (
    <nav aria-label="Staff" className="grid gap-4">
      {groups.map((group) => {
        const groupItems = items.filter((item) => item.group === group);
        if (groupItems.length === 0) return null;
        return (
          <div key={group} className="grid gap-1">
            <p className={`px-2 text-xs font-medium text-muted-foreground ${groupClass}`}>{group}</p>
            {groupItems.map((item) => {
              const Icon = itemIcon(item);
              const active = isNavActive(pathname, item.href);
              return (
                <Link
                  key={navKey(item)}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  title={item.label}
                  onClick={onNavigate}
                  className={`flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm ${
                    active ? "bg-secondary font-medium" : "hover:bg-muted"
                  } ${linkClass}`}
                >
                  <Icon aria-hidden className="size-4 shrink-0" />
                  <span className={`whitespace-nowrap ${labelClass}`}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

function useSidebarLayout() {
  const [collapsed, setCollapsed] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === "collapsed" || stored === "expanded") {
      setCollapsed(stored === "collapsed");
      return;
    }

    const media = window.matchMedia("(max-width: 1023px)");
    setCollapsed(media.matches);
    const onChange = () => {
      if (window.localStorage.getItem(SIDEBAR_STORAGE_KEY)) return;
      setCollapsed(media.matches);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    setCollapsed((current) => {
      const narrow = window.matchMedia("(max-width: 1023px)").matches;
      const next = !(current ?? narrow);
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "collapsed" : "expanded");
      return next;
    });
  }

  const layout: SidebarLayout = collapsed === null ? "auto" : collapsed ? "compact" : "full";
  return { layout, toggle };
}

function AdminSidebar({ items, pathname }: { items: readonly NavItem[]; pathname: string }) {
  const { layout, toggle } = useSidebarLayout();
  const expanded = layout === "full";
  const collapsed = layout === "compact";

  return (
    <aside
      className={`sticky top-0 flex h-dvh shrink-0 flex-col overflow-x-hidden border-e bg-card print:hidden transition-[width,padding,gap] duration-200 ease-out ${
        collapsed ? "w-16 gap-3 p-2" : expanded ? "w-60 gap-4 p-3" : "w-16 gap-3 p-2 lg:w-60 lg:gap-4 lg:p-3"
      }`}
    >
      <div
        className={`flex items-center ${
          collapsed ? "justify-center" : expanded ? "justify-between gap-1" : "justify-center lg:justify-between lg:gap-1"
        }`}
      >
        <div className={collapsed ? "hidden" : expanded ? "contents" : "hidden lg:contents"}>
          <span className="min-w-0 px-1 py-1">
            <ScopeBadge />
          </span>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded ? true : collapsed ? false : undefined}
          aria-label={collapsed ? "Expand sidebar" : expanded ? "Collapse sidebar" : "Toggle sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <PanelLeftClose
            aria-hidden
            className={`size-4 ${collapsed ? "hidden" : layout === "auto" ? "hidden lg:block" : ""}`}
          />
          <PanelLeftOpen
            aria-hidden
            className={`size-4 ${expanded ? "hidden" : layout === "auto" ? "lg:hidden" : ""}`}
          />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <NavLinks items={items} pathname={pathname} layout={layout} />
      </div>
    </aside>
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
          void endStaffSession();
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
  const activeBranchId = useScope((state) => state.branchId);
  const [moreOpen, setMoreOpen] = useState(false);
  if (!me) return null;

  const items = navForUser(me, activeBranchId);
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
        {variant === "admin" ? <AdminSidebar items={items} pathname={pathname} /> : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-12 items-center justify-between gap-3 border-b px-3 py-2 print:hidden">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {variant === "ops" ? (
                <>
                  <span className="sm:hidden">
                    <ScopeBadge compact />
                  </span>
                  <span className="hidden sm:inline-flex">
                    <ScopeBadge />
                  </span>
                </>
              ) : null}
              <BranchSwitcher />
              {variant === "ops" ? (
                <nav aria-label="Ops" className="hidden min-w-0 gap-1 overflow-x-auto sm:flex">
                  {opsTabs.map((item) => {
                    const active = isNavActive(pathname, item.href);
                    return (
                      <Link
                        key={navKey(item)}
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
          const Icon = itemIcon(item);
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={navKey(item)}
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
