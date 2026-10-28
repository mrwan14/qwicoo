"use client";

import { BarChart3, Building2, ClipboardList, Package, UtensilsCrossed, Wallet, CreditCard, type LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/ops/kit/empty-state";
import { LinkGroup, LinkRow } from "@/components/ops/kit/link-list";
import { PageHeader } from "@/components/ops/kit/page-header";
import { RoleGate } from "@/components/ops/screen";
import { useStaffSession } from "@/components/ops/staff-session";
import { canOpenInventoryPage } from "@/features/staff/inventory/access";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { navForUser } from "@/lib/nav";
import { useScope } from "@/stores/scope";

type ReportKey = keyof typeof reportsCopy.en.items;
type ReportGroup = keyof typeof reportsCopy.en.groups;

const REPORTS: readonly { key: ReportKey; group: ReportGroup; href: string; icon: LucideIcon; nav: string }[] = [
  { key: "overview", group: "sales", href: "/app/analytics", icon: BarChart3, nav: "/app/analytics" },
  { key: "branches", group: "sales", href: "/app/analytics/branches", icon: Building2, nav: "/app/analytics" },
  { key: "menu", group: "menu", href: "/app/analytics/menu", icon: UtensilsCrossed, nav: "/app/analytics" },
  { key: "stock", group: "stock", href: "/app/reports/stock", icon: Package, nav: "/app/stock" },
  { key: "attendance", group: "staff", href: "/app/attendance", icon: ClipboardList, nav: "/app/attendance" },
  { key: "till", group: "money", href: "/app/financials", icon: Wallet, nav: "/app/financials" },
  { key: "payments", group: "money", href: "/app/orders/payments", icon: CreditCard, nav: "/app/orders/payments" },
];

const GROUPS: readonly ReportGroup[] = ["sales", "menu", "stock", "staff", "money"];

export function ReportsHub() {
  const t = useStaffSection(reportsCopy);
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  if (!me) return null;
  const allowed = new Set(navForUser(me, branchId).map((item) => item.href));
  const reports = REPORTS.filter(
    (report) => allowed.has(report.nav) && (report.key !== "stock" || canOpenInventoryPage(me.role, "reports")),
  );

  return (
    <RoleGate href="/app/reports">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6">
        <PageHeader title={t.title} subtitle={t.subtitle} />
        {reports.length === 0 ? (
          <EmptyState icon={BarChart3} title={t.nothing} />
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            {GROUPS.map((group) => {
              const rows = reports.filter((report) => report.group === group);
              if (rows.length === 0) return null;
              return (
                <LinkGroup key={group} label={t.groups[group]}>
                  {rows.map((report) => (
                    <LinkRow
                      key={report.key}
                      href={report.href}
                      icon={report.icon}
                      title={t.items[report.key].title}
                      description={t.items[report.key].body}
                    />
                  ))}
                </LinkGroup>
              );
            })}
          </div>
        )}
      </div>
    </RoleGate>
  );
}
