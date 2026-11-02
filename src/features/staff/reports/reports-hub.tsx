"use client";

import { cn } from "cn";
import {
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
  Timer,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ops/kit/badge";
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

type Copy = (typeof reportsCopy)["en"];
type Group = keyof Copy["groups"];
type Ready = keyof Copy["items"];
type Soon = Exclude<keyof Copy["soon"], "badge">;

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
  { kind: "soon", key: "salesBy", group: "sales", icon: Layers },
  { kind: "ready", key: "menu", group: "menu", href: "/app/reports/menu", icon: UtensilsCrossed, nav: "/app/reports/sales" },
  { kind: "soon", key: "engineering", group: "menu", icon: Percent },
  { kind: "ready", key: "stock", group: "stock", href: "/app/reports/stock", icon: Package, nav: "/app/stock" },
  { kind: "soon", key: "stockFlow", group: "stock", icon: Repeat },
  { kind: "ready", key: "attendance", group: "staff", href: "/app/reports/attendance", icon: ClipboardList, nav: "/app/reports/attendance" },
  { kind: "soon", key: "shifts", group: "staff", icon: Timer },
  { kind: "ready", key: "till", group: "money", href: "/app/reports/till", icon: Wallet, nav: "/app/reports/till" },
  { kind: "ready", key: "payments", group: "money", href: "/app/reports/payments", icon: CreditCard, nav: "/app/reports/payments" },
  { kind: "soon", key: "taxes", group: "money", icon: Receipt },
  { kind: "soon", key: "speed", group: "service", icon: Gauge },
];

const GROUPS: readonly Group[] = ["sales", "menu", "stock", "staff", "money", "service"];

function ReportCard({ entry, t }: { entry: Entry; t: Copy }) {
  const Icon = entry.icon;
  const copy = entry.kind === "ready" ? t.items[entry.key] : t.soon[entry.key];
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-staff border border-border bg-subtle">
          <Icon aria-hidden className={cn("size-[18px]", entry.kind === "ready" ? "text-ink" : "text-disabled")} />
        </span>
        {entry.kind === "soon" ? <Badge>{t.soon.badge}</Badge> : <ChevronRight aria-hidden className="size-4 text-ink-secondary rtl:-scale-x-100" />}
      </span>
      <span className="grid gap-1">
        <span className={cn("text-sm font-semibold", entry.kind === "ready" ? "text-ink" : "text-ink-secondary")}>{copy.title}</span>
        <span className="text-[13px] leading-snug text-ink-secondary">{copy.body}</span>
      </span>
    </>
  );
  const card = "grid min-h-36 content-between gap-4 rounded-staff border p-4";
  if (entry.kind === "soon") {
    return (
      <div aria-disabled="true" className={cn(card, "border-dashed border-border bg-subtle")}>
        {body}
      </div>
    );
  }
  return (
    <Link
      href={entry.href}
      className={cn(card, "border-border bg-canvas transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus")}
    >
      {body}
    </Link>
  );
}

export function ReportsHub() {
  const t = useStaffSection(reportsCopy);
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  if (!me) return null;
  const allowed = new Set(navForUser(me, branchId).map((item) => item.href));
  const entries = ENTRIES.filter(
    (entry) => entry.kind === "soon" || (allowed.has(entry.nav) && (entry.key !== "stock" || canOpenInventoryPage(me.role, "reports"))),
  );
  const anyReady = entries.some((entry) => entry.kind === "ready");

  return (
    <RoleGate href="/app/reports">
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-6">
        <PageHeader title={t.title} subtitle={t.subtitle} />
        {!anyReady ? <EmptyState icon={BarChart3} title={t.nothing} /> : null}
        {GROUPS.map((group) => {
          const cards = entries.filter((entry) => entry.group === group);
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
      </div>
    </RoleGate>
  );
}
