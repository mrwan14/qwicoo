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
  Timer,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { SectionLabel } from "@/components/ops/kit/card";
import { EmptyState } from "@/components/ops/kit/empty-state";
import { PageHeader } from "@/components/ops/kit/page-header";
import { RoleGate } from "@/components/ops/screen";
import { useStaffSession } from "@/components/ops/staff-session";
import { canOpenInventoryPage } from "@/features/staff/inventory/access";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
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
  { kind: "soon", key: "speed", group: "service", icon: Gauge },
];

const GROUPS: readonly Group[] = ["sales", "menu", "stock", "staff", "money", "service"];

function ReportCard({ entry, t }: { entry: Extract<Entry, { kind: "ready" }>; t: Copy }) {
  const Icon = entry.icon;
  const copy = t.items[entry.key];
  return (
    <Link
      href={entry.href}
      className="grid min-h-36 content-between gap-4 rounded-staff border border-border bg-canvas p-4 transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-staff border border-border bg-subtle">
          <Icon aria-hidden className="size-[18px] text-ink" />
        </span>
        <ChevronRight aria-hidden className="size-4 text-ink-secondary rtl:-scale-x-100" />
      </span>
      <span className="grid gap-1">
        <span className="text-sm font-semibold text-ink">{copy.title}</span>
        <span className="text-[13px] leading-snug text-ink-secondary">{copy.body}</span>
      </span>
    </Link>
  );
}

export function ReportsHub() {
  const t = useStaffSection(reportsCopy);
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  const branchCount = useScope((state) => state.branches.length);
  if (!me) return null;
  const allowed = new Set(navForUser(me, branchId).map((item) => item.href));
  const entries = ENTRIES.filter((entry) => {
    if (entry.kind === "soon") return true;
    if (!allowed.has(entry.nav)) return false;
    if (entry.key === "stock") return canOpenInventoryPage(me.role, "reports");
    // Comparing branches needs more than one; a Branch Admin would get a one-row table.
    if (entry.key === "branches") return branchCount > 1 || me.role === "SUPER_ADMIN";
    return true;
  });
  const ready = entries.filter((entry): entry is Extract<Entry, { kind: "ready" }> => entry.kind === "ready");
  const soon = entries.filter((entry): entry is Extract<Entry, { kind: "soon" }> => entry.kind === "soon");
  const anyReady = ready.length > 0;

  return (
    <RoleGate href="/app/reports">
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-6">
        <PageHeader title={t.title} subtitle={t.subtitle} />
        <HubSnapshot
          sales={allowed.has("/app/reports/sales")}
          till={allowed.has("/app/reports/till")}
          stock={canOpenInventoryPage(me.role, "reports")}
          branchId={branchId}
        />
        {!anyReady ? <EmptyState icon={BarChart3} title={t.nothing} /> : null}
        {GROUPS.map((group) => {
          const cards = ready.filter((entry) => entry.group === group);
          if (cards.length === 0) return null;
          return (
            <section key={group} className="grid gap-2.5">
              <SectionLabel>{t.groups[group]}</SectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map((entry) => (
                  <ReportCard key={entry.key} entry={entry} t={t} />
                ))}
              </div>
            </section>
          );
        })}
        {soon.length > 0 ? (
          // Reports still being built sit in one quiet line, so they don't crowd the ones that work.
          <section className="grid gap-2.5">
            <SectionLabel>{t.soon.onTheWay}</SectionLabel>
            <div className="grid gap-3 rounded-staff border border-dashed border-border bg-subtle p-4">
              <p className="text-[13px] text-ink-secondary">{t.soon.onTheWayHint}</p>
              <ul className="flex flex-wrap gap-2">
                {soon.map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <li key={entry.key} title={t.soon[entry.key].body} className="inline-flex items-center gap-1.5 rounded-staff border border-border bg-canvas px-2.5 py-1 text-[13px] text-ink-secondary">
                      <Icon aria-hidden className="size-3.5 text-disabled" />
                      {t.soon[entry.key].title}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ) : null}
      </div>
    </RoleGate>
  );
}
