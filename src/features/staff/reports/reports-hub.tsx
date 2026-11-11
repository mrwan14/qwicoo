"use client";

import {
  BadgePercent,
  BarChart3,
  Building2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Gauge,
  Layers,
  Package,
  Percent,
  Receipt,
  Repeat,
  Smartphone,
  Star,
  Timer,
  UserX,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/ops/kit/empty-state";
import { Panel } from "@/components/ops/kit/panel";
import { PageHeader } from "@/components/ops/kit/page-header";
import { RoleGate } from "@/components/ops/screen";
import { useStaffSession } from "@/components/ops/staff-session";
import { canOpenInventoryPage } from "@/features/staff/inventory/access";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import type { UserProfile } from "@/lib/auth/roles";
import { navForUser } from "@/lib/nav";
import { useScope } from "@/stores/scope";

import { HubSnapshot } from "./hub-snapshot";

type Copy = (typeof reportsCopy)["en"];
type Group = keyof Copy["groups"];
type Ready = keyof Copy["items"];
type Soon = Exclude<keyof Copy["soon"], "badge" | "onTheWay" | "onTheWayHint">;

type Entry =
  | { kind: "ready"; key: Ready; group: Group; href: string; icon: LucideIcon; nav: string }
  | { kind: "soon"; key: Soon; group: Group; icon: LucideIcon };

/**
 * Existing reports open; the ones the API cannot feed yet are listed as Coming soon,
 * without numbers. Each live report shows only when the role could already open it.
 */
const ENTRIES: readonly Entry[] = [
  { kind: "ready", key: "overview", group: "sales", href: "/app/reports/sales", icon: BarChart3, nav: "/app/reports/sales" },
  { kind: "ready", key: "branches", group: "sales", href: "/app/reports/branches", icon: Building2, nav: "/app/reports/sales" },
  { kind: "ready", key: "channels", group: "sales", href: "/app/reports/channels", icon: Smartphone, nav: "/app/reports/till" },
  { kind: "soon", key: "salesBy", group: "sales", icon: Layers },
  { kind: "ready", key: "menu", group: "menu", href: "/app/reports/menu", icon: UtensilsCrossed, nav: "/app/reports/sales" },
  { kind: "soon", key: "engineering", group: "menu", icon: Percent },
  { kind: "ready", key: "stock", group: "stock", href: "/app/reports/stock", icon: Package, nav: "/app/stock" },
  { kind: "soon", key: "stockFlow", group: "stock", icon: Repeat },
  { kind: "ready", key: "attendance", group: "staff", href: "/app/reports/attendance", icon: ClipboardList, nav: "/app/reports/attendance" },
  { kind: "soon", key: "shifts", group: "staff", icon: Timer },
  { kind: "ready", key: "till", group: "money", href: "/app/reports/till", icon: Wallet, nav: "/app/reports/till" },
  { kind: "ready", key: "payments", group: "money", href: "/app/reports/payments", icon: CreditCard, nav: "/app/reports/payments" },
  { kind: "ready", key: "taxes", group: "money", href: "/app/reports/taxes", icon: Receipt, nav: "/app/reports/till" },
  { kind: "ready", key: "discounts", group: "money", href: "/app/reports/discounts", icon: BadgePercent, nav: "/app/reports/till" },
  { kind: "ready", key: "walkouts", group: "money", href: "/app/reports/walkouts", icon: UserX, nav: "/app/reports/sales" },
  { kind: "ready", key: "reviews", group: "guests", href: "/app/reports/reviews", icon: Star, nav: "/app/reports/sales" },
  { kind: "ready", key: "speed", group: "service", href: "/app/reports/speed", icon: Gauge, nav: "/app/reports/sales" },
];

/**
 * The panels flow down into columns, so this order also balances them: Sales and Menu share the
 * first column, Payments & taxes (the longest) takes the middle, Stock and Staff the last.
 */
const GROUPS: readonly Group[] = ["sales", "menu", "money", "guests", "stock", "staff", "service"];

const GROUP_ICONS: Record<Group, LucideIcon> = {
  sales: BarChart3,
  money: Wallet,
  menu: UtensilsCrossed,
  stock: Package,
  staff: ClipboardList,
  service: Gauge,
  guests: Star,
};

function ReportRow({ entry, t }: { entry: Extract<Entry, { kind: "ready" }>; t: Copy }) {
  const Icon = entry.icon;
  const copy = t.items[entry.key];
  return (
    <li>
      <Link
        href={entry.href}
        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-staff bg-well text-ink transition-colors group-hover:bg-brand group-hover:text-on-brand group-focus-visible:bg-ink group-focus-visible:text-on-ink">
          <Icon aria-hidden className="size-[18px]" />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="text-sm font-semibold text-ink">{copy.title}</span>
          <span className="text-[13px] leading-snug text-ink-secondary">{copy.body}</span>
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-secondary transition-transform group-hover:translate-x-0.5 group-hover:text-ink rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
      </Link>
    </li>
  );
}

/** One group of reports as a single panel, with a row per report. */
function GroupPanel({ group, entries, t }: { group: Group; entries: readonly Extract<Entry, { kind: "ready" }>[]; t: Copy }) {
  return (
    <Panel
      className="mb-4 break-inside-avoid"
      title={t.groups[group]}
      icon={GROUP_ICONS[group]}
    >
      <ul className="divide-y divide-border">
        {entries.map((entry) => (
          <ReportRow key={entry.key} entry={entry} t={t} />
        ))}
      </ul>
    </Panel>
  );
}

type ReadyEntry = Extract<Entry, { kind: "ready" }>;

/**
 * The reports this person can open, in hub order. Shared by the hub and the sidebar, so both
 * always list the same reports.
 */
export function readyReports(me: UserProfile, branchId: string | null, branchCount: number): ReadyEntry[] {
  const allowed = new Set(navForUser(me, branchId).map((item) => item.href));
  const order = new Map(GROUPS.map((group, index) => [group, index]));
  return ENTRIES.filter((entry): entry is ReadyEntry => {
    if (entry.kind !== "ready" || !allowed.has(entry.nav)) return false;
    if (entry.key === "stock") return canOpenInventoryPage(me.role, "reports");
    // Comparing branches needs more than one; a Branch Admin would get a one-row table.
    if (entry.key === "branches") return branchCount > 1 || me.role === "SUPER_ADMIN";
    return true;
  }).sort((left, right) => (order.get(left.group) ?? 0) - (order.get(right.group) ?? 0));
}

export function ReportsHub() {
  const t = useStaffSection(reportsCopy);
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  const branchCount = useScope((state) => state.branches.length);
  if (!me) return null;
  const allowed = new Set(navForUser(me, branchId).map((item) => item.href));
  const ready = readyReports(me, branchId, branchCount);
  const soon = ENTRIES.filter((entry): entry is Extract<Entry, { kind: "soon" }> => entry.kind === "soon");

  return (
    <RoleGate href="/app/reports">
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-5">
        <PageHeader title={t.title} subtitle={t.subtitle} />
        <HubSnapshot
          sales={allowed.has("/app/reports/sales")}
          till={allowed.has("/app/reports/till")}
          stock={canOpenInventoryPage(me.role, "reports")}
          branchId={branchId}
        />
        {ready.length === 0 ? (
          <EmptyState icon={BarChart3} title={t.nothing} />
        ) : (
          <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
            {GROUPS.map((group) => {
              const rows = ready.filter((entry) => entry.group === group);
              return rows.length > 0 ? <GroupPanel key={group} group={group} entries={rows} t={t} /> : null;
            })}
          </div>
        )}
        {soon.length > 0 ? (
          // Reports still being built sit in one quiet line, so they don't crowd the ones that work.
          <section className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-staff border border-dashed border-border px-4 py-3">
            <span className="text-xs font-semibold tracking-wide text-ink-secondary uppercase">{t.soon.onTheWay}</span>
            <ul className="flex flex-wrap gap-1.5">
              {soon.map((entry) => {
                const Icon = entry.icon;
                return (
                  <li key={entry.key} title={t.soon[entry.key].body} className="inline-flex items-center gap-1.5 rounded-staff bg-well px-2 py-1 text-xs text-ink-secondary">
                    <Icon aria-hidden className="size-3.5" />
                    {t.soon[entry.key].title}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </RoleGate>
  );
}
