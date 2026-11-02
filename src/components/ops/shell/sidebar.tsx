"use client";

import { cn } from "cn";
import {
  BookOpen,
  ChartColumn,
  House,
  Inbox,
  Package,
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

function SidebarLink({
  entry,
  active,
  badge,
  onNavigate,
}: {
  entry: SidebarEntry;
  active: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const t = useStaffSection(shellCopy);
  const common = useStaffSection(commonCopy);
  const Icon = ICONS[entry.key];
  return (
    <Link
      href={entry.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-staff border px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
        active
          ? "border-border bg-canvas font-semibold text-ink"
          : "border-transparent text-ink-secondary hover:bg-canvas hover:text-ink",
      )}
    >
      <Icon aria-hidden className={cn("size-[18px] shrink-0", active ? "text-ink" : "text-ink-secondary")} />
      <span className="min-w-0 flex-1 truncate">{t.sidebar[entry.key]}</span>
      {badge ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs leading-5 font-semibold text-on-ink">
          <span aria-hidden>{badge > 99 ? "99+" : badge}</span>
          <span className="sr-only">{`${badge} ${common.toConfirm}`}</span>
        </span>
      ) : null}
    </Link>
  );
}

export function SidebarContent({
  entries,
  activeKey,
  badges = {},
  onNavigate,
  headerEnd,
  beforeNav,
}: {
  entries: readonly SidebarEntry[];
  activeKey: SidebarKey | null;
  badges?: Partial<Record<SidebarKey, number>>;
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
  const link = (entry: SidebarEntry) => (
    <SidebarLink
      key={entry.key}
      entry={entry}
      active={entry.key === activeKey}
      badge={badges[entry.key]}
      onNavigate={onNavigate}
    />
  );
  return (
    <div className="flex min-h-full flex-col gap-1 p-4">
      <div className="flex items-center gap-2.5 px-1 pt-1 pb-5">
        <BrandMark name={identity.name} logoUrl={identity.logoUrl} />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate text-sm font-semibold text-ink">{identity.name}</span>
          <span className="truncate text-xs text-ink-secondary">{identity.place}</span>
        </div>
        {headerEnd}
      </div>
      {beforeNav}
      <nav aria-label={t.mainNav} className="flex flex-1 flex-col gap-1">
        {top.map(link)}
        <span aria-hidden className="flex-1" />
        {bottom.map(link)}
      </nav>
    </div>
  );
}
