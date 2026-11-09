"use client";

import { cn } from "cn";
import {
  BookOpen,
  ChartColumn,
  House,
  Inbox,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  ShieldCheck,
  Store,
  ToggleRight,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { commonCopy } from "@/lib/i18n/staff/common";
import { shellCopy } from "@/lib/i18n/staff/shell";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { initials } from "@/lib/auth/scope";
import { mediaUrl } from "@/lib/media";
import type { SidebarEntry, SidebarKey } from "@/lib/nav";
import { useScope } from "@/stores/scope";

const ICONS: Record<SidebarKey, LucideIcon> = {
  home: House,
  orders: Receipt,
  menu: BookOpen,
  stock: Package,
  reports: ChartColumn,
  settings: Settings,
  brands: Store,
  people: Users,
  features: ToggleRight,
  leads: Inbox,
  delivery: Truck,
  audit: ShieldCheck,
};

/** Ink square with the brand's first letter, or its logo when one is uploaded. */
export function BrandMark({ name, logoUrl, size = "md" }: { name: string; logoUrl?: string | null; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  const logo = logoUrl && !failed ? mediaUrl(logoUrl) : null;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-staff bg-ink font-title font-semibold text-on-ink",
        size === "sm" ? "size-7 text-base" : "size-8 text-lg",
        logo && "border border-border bg-canvas",
      )}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="size-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden>{initials(name).slice(0, 1)}</span>
      )}
    </span>
  );
}

/** Brand and branch for brand and branch scope; Qwicoo / Platform for App Admin. */
export function useScopeIdentity() {
  const t = useStaffSection(shellCopy);
  const common = useStaffSection(commonCopy);
  const homeScope = useScope((state) => state.homeScope);
  const brandName = useScope((state) => state.brandName);
  const brandLogoUrl = useScope((state) => state.brandLogoUrl);
  const branchName = useScope((state) => state.branches.find((branch) => branch.id === state.branchId)?.name ?? null);
  if (homeScope === "platform" || !homeScope) return { name: "Qwicoo", place: t.platform, logoUrl: null, branchName: null };
  return {
    name: brandName ?? common.yourBrand,
    place: branchName ?? common.brand,
    logoUrl: brandLogoUrl,
    branchName,
  };
}

export type SidebarSubLink = { href: string; label: string; active: boolean };

function SidebarLink({
  entry,
  active,
  badge,
  collapsed,
  onNavigate,
}: {
  entry: SidebarEntry;
  active: boolean;
  badge?: number;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const t = useStaffSection(shellCopy);
  const common = useStaffSection(commonCopy);
  const Icon = ICONS[entry.key];
  const label = t.sidebar[entry.key];
  return (
    <Link
      href={entry.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={cn(
        "relative flex min-h-9 items-center gap-3 rounded-staff px-2.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
        collapsed && "justify-center px-0",
        active ? "bg-ink font-semibold text-on-ink shadow-card" : "text-ink-secondary hover:bg-well hover:text-ink",
      )}
    >
      <Icon aria-hidden className="size-[18px] shrink-0" />
      {collapsed ? null : <span className="min-w-0 flex-1 truncate">{label}</span>}
      {badge ? (
        <span
          className={cn(
            "inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs leading-5 font-semibold text-on-ink",
            collapsed && "absolute -end-1 -top-1 min-w-4 px-1 text-[10px] leading-4",
          )}
        >
          <span aria-hidden>{badge > 99 ? "99+" : badge}</span>
          <span className="sr-only">{`${badge} ${common.toConfirm}`}</span>
        </span>
      ) : null}
    </Link>
  );
}

/** The pages of the section you are in, indented under it on a thin rule. */
function SubNav({ links, onNavigate }: { links: readonly SidebarSubLink[]; onNavigate?: () => void }) {
  return (
    <ul className="ms-[19px] mt-0.5 mb-1 grid gap-px border-s border-border ps-2.5">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            aria-current={link.active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "relative flex min-h-8 items-center rounded-staff px-2.5 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
              link.active
                ? "bg-well font-semibold text-ink before:absolute before:-start-[11px] before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-ink"
                : "text-ink-secondary hover:bg-well hover:text-ink",
            )}
          >
            <span className="truncate">{link.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SidebarContent({
  entries,
  activeKey,
  badges = {},
  subnav = {},
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
  headerEnd,
  beforeNav,
}: {
  entries: readonly SidebarEntry[];
  activeKey: SidebarKey | null;
  badges?: Partial<Record<SidebarKey, number>>;
  /** Pages listed under the active entry. */
  subnav?: Partial<Record<SidebarKey, readonly SidebarSubLink[]>>;
  /** Icons only, with the label as a tooltip. */
  collapsed?: boolean;
  /** Shows the collapse button at the bottom when given. */
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  /** Beside the brand, e.g. the drawer's close button. */
  headerEnd?: ReactNode;
  /** Between the brand and the links, e.g. search in the phone drawer. */
  beforeNav?: ReactNode;
}) {
  const t = useStaffSection(shellCopy);
  const identity = useScopeIdentity();
  const top = entries.filter((entry) => !entry.bottom);
  const bottom = entries.filter((entry) => entry.bottom);
  const link = (entry: SidebarEntry) => {
    const active = entry.key === activeKey;
    const children = active && !collapsed ? subnav[entry.key] : undefined;
    return (
      <div key={entry.key} className="grid">
        <SidebarLink entry={entry} active={active} badge={badges[entry.key]} collapsed={collapsed} onNavigate={onNavigate} />
        {children?.length ? <SubNav links={children} onNavigate={onNavigate} /> : null}
      </div>
    );
  };
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <div className={cn("flex min-h-full flex-col gap-0.5 py-3", collapsed ? "px-2" : "px-3")}>
      <div className={cn("flex items-center gap-2.5 pt-1 pb-4", collapsed ? "justify-center" : "px-1")}>
        <BrandMark name={identity.name} logoUrl={identity.logoUrl} />
        {collapsed ? null : (
          <div className="grid min-w-0 flex-1 gap-0.5">
            <span className="truncate text-sm font-semibold text-ink">{identity.name}</span>
            <span className="truncate text-xs text-ink-secondary">{identity.place}</span>
          </div>
        )}
        {headerEnd}
      </div>
      {beforeNav}
      <nav aria-label={t.mainNav} className="flex flex-1 flex-col gap-0.5">
        {top.map(link)}
        <span aria-hidden className="flex-1" />
        {bottom.length || onToggleCollapsed ? <span aria-hidden className="my-2 border-t border-border" /> : null}
        {bottom.map(link)}
        {onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? t.expandNav : t.collapseNav}
            title={`${collapsed ? t.expandNav : t.collapseNav} ( [ )`}
            className={cn(
              "flex min-h-9 items-center gap-3 rounded-staff px-2.5 py-2 text-sm text-ink-secondary transition-colors hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
              collapsed && "justify-center px-0",
            )}
          >
            <ToggleIcon aria-hidden className="size-[18px] shrink-0 rtl:-scale-x-100" />
            {collapsed ? null : <span className="min-w-0 flex-1 truncate text-start">{t.collapseNav}</span>}
          </button>
        ) : null}
      </nav>
    </div>
  );
}
