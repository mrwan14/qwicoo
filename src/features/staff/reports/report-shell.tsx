"use client";

import { Download } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ops/kit/button";
import { Card } from "@/components/ops/kit/card";
import { PageHeader } from "@/components/ops/kit/page-header";
import { NestedHeaders } from "@/components/ops/page-header";
import { fill } from "@/lib/i18n/dictionary";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export type ReportGroup = keyof (typeof reportsCopy)["en"]["groups"];

/** "Sunday 26 October" or "20 – 26 October" for the report subtitle. */
export function rangeLabel(from: string, to: string, locale: string): string {
  const format = (value: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { ...options, timeZone: "UTC", numberingSystem: "latn" }).format(new Date(`${value}T00:00:00Z`));
  if (from === to) return format(from, { weekday: "long", day: "numeric", month: "long" });
  return `${format(from, { day: "numeric", month: "short" })} – ${format(to, { day: "numeric", month: "short" })}`;
}

/**
 * The report page from the Till / Z frame: back to Reports, title and Export, the filter bar,
 * up to four KPIs, one chart and one table. Scheduled exports come back here once the API sends them.
 */
export function ReportShell({
  group,
  title,
  subtitle,
  filters,
  kpis,
  chartTitle,
  chart,
  table,
  onExport,
  canExport = true,
  children,
}: {
  group: ReportGroup;
  title: string;
  subtitle?: ReactNode;
  filters?: ReactNode;
  kpis?: ReactNode;
  chartTitle?: ReactNode;
  chart?: ReactNode;
  table?: ReactNode;
  onExport?: () => void;
  canExport?: boolean;
  children?: ReactNode;
}) {
  const t = useStaffSection(reportsCopy);
  return (
    <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-4">
      <PageHeader
        back={{ href: "/app/reports", label: fill(t.backTo, { group: t.groups[group] }) }}
        title={title}
        subtitle={subtitle}
        actions={
          onExport ? (
            <Button onClick={onExport} disabled={!canExport}>
              <Download aria-hidden />
              {t.exportCsv}
            </Button>
          ) : null
        }
      />
      {filters}
      {kpis ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{kpis}</div> : null}
      {chart || table ? (
        <div className={chart && table ? "grid grid-cols-1 items-start gap-3 lg:grid-cols-[380px_minmax(0,1fr)]" : "grid grid-cols-1 gap-3"}>
          {chart ? <Card title={chartTitle}>{chart}</Card> : null}
          {table ? <div className="min-w-0">{table}</div> : null}
        </div>
      ) : null}
      {children ? <NestedHeaders>{children}</NestedHeaders> : null}
    </div>
  );
}
