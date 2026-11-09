"use client";

import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";

import { Badge } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { Card } from "@/components/ops/kit/card";
import { formatAmount } from "@/components/ops/kit/money";
import { PageHeader } from "@/components/ops/kit/page-header";
import { ErrorState, LoadingState } from "@/components/ops/states";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { formatCairoDateTime } from "@/lib/format/time";
import { fill } from "@/lib/i18n/dictionary";
import { formatCount } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/locale-store";
import { analyticsCopy } from "@/lib/i18n/staff/analytics";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { rangeLabel } from "./report-shell";
import { num } from "./z-reports";

type Line = { label: string; value: string; strong?: boolean; minus?: boolean };

function Lines({ lines }: { lines: readonly Line[] }) {
  return (
    <dl className="grid gap-2.5 text-sm">
      {lines.map((line) => (
        <div
          key={line.label}
          className={line.strong ? "flex items-center justify-between gap-3 border-t border-border pt-2.5 font-semibold" : "flex items-center justify-between gap-3"}
        >
          <dt className={line.strong ? "text-ink" : "text-ink-secondary"}>{line.label}</dt>
          <dd className="text-ink tabular-nums">{line.minus && line.value !== "—" ? `− ${line.value}` : line.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One end-of-day (Z) report, laid out to be read on screen and printed for the file:
 * sales down to net and tax, how it was paid, the cash count, channels and order counts.
 */
export function ZReportDetail({ reportId }: { reportId: string }) {
  const z = useStaffSection(analyticsCopy).z;
  const t = useStaffSection(reportsCopy);
  const { locale } = useLocale();
  const branchName = useScope((state) => state.branches.find((branch) => branch.id === state.branchId)?.name);
  const report = useQuery({
    queryKey: ["z", reportId],
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/financials/z-report/{report_id}", { params: { path: { report_id: reportId } } });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, z.failed);
      return result.data;
    },
  });
  if (report.isLoading) return <LoadingState label={z.loading} />;
  if (report.isError) return <ErrorState body={report.error.message} onRetry={() => void report.refetch()} />;
  const data = report.data;
  if (!data) return <ErrorState body={z.missing} onRetry={() => void report.refetch()} />;

  const money = (amount: string | number | null | undefined) => (amount == null ? "—" : formatAmount(amount, undefined, locale));
  const day = data.business_date.slice(0, 10);
  const cash = data.cash_reconciliation;
  const variance = num(cash?.cash_variance);
  const counted = cash?.declared_cash != null;
  const paid = num(data.payment_channels.cash) + num(data.payment_channels.card_pos) + num(data.payment_channels.online);
  const c = t.zDetail;

  return (
    <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-4 print:max-w-none print:gap-3">
      <PageHeader
        back={{ href: "/app/reports/till", label: z.back }}
        title={`${z.title} · ${data.report_number}`}
        subtitle={[rangeLabel(day, day, locale), branchName].filter(Boolean).join(" · ")}
        actions={
          <span className="print:hidden">
            <Button onClick={() => window.print()}>
              <Printer aria-hidden />
              {z.print}
            </Button>
          </span>
        }
      />
      <p className="text-[13px] text-ink-secondary">
        {z.period}: {formatCairoDateTime(data.period_start, locale)} – {formatCairoDateTime(data.period_end, locale)} · {fill(c.made, { when: formatCairoDateTime(data.created_at, locale) })}
      </p>
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-2">
        <Card title={c.sales} className="break-inside-avoid">
          <Lines
            lines={[
              { label: t.taxes.gross, value: money(data.gross_sales) },
              { label: t.taxes.discounts, value: money(data.total_discounts), minus: true },
              { label: t.taxes.refunds, value: money(data.total_refunds), minus: true },
              { label: t.taxes.net, value: money(data.net_sales), strong: true },
              { label: t.taxes.tax, value: money(data.total_tax) },
              { label: t.taxes.service, value: money(data.total_service_fees) },
              { label: t.taxes.delivery, value: money(data.delivery_fees) },
            ]}
          />
        </Card>
        <Card title={c.payments} className="break-inside-avoid">
          <Lines
            lines={[
              { label: z.cash, value: money(data.payment_channels.cash) },
              { label: z.card, value: money(data.payment_channels.card_pos) },
              { label: z.online, value: money(data.payment_channels.online) },
              { label: c.paidTotal, value: money(paid), strong: true },
            ]}
          />
        </Card>
        <Card
          title={c.cash}
          className="break-inside-avoid"
          action={counted ? <Badge tone={variance < 0 ? "danger" : variance > 0 ? "warning" : "success"}>{variance < 0 ? t.snapshot.short : variance > 0 ? t.snapshot.over : t.snapshot.matches}</Badge> : null}
        >
          {counted ? (
            <Lines
              lines={[
                { label: t.till.float, value: money(cash?.opening_balance) },
                { label: t.till.expected, value: money(num(cash?.declared_cash) - variance) },
                { label: t.till.counted, value: money(cash?.declared_cash) },
                { label: t.till.difference, value: money(variance), strong: true },
              ]}
            />
          ) : (
            <p className="text-sm text-ink-secondary">{c.noCount}</p>
          )}
        </Card>
        <Card title={c.channels} className="break-inside-avoid">
          <Lines
            lines={[
              { label: t.channels.cashier, value: money(data.order_sources.cashier_pos) },
              { label: t.channels.qr, value: money(data.order_sources.qr_customer) },
              { label: t.channels.app, value: money(data.order_sources.takeaway_app) },
            ]}
          />
        </Card>
        <Card title={c.orders} className="break-inside-avoid">
          <Lines
            lines={[
              { label: c.paid, value: formatCount(data.order_volumes.paid_orders, locale) },
              { label: t.discounts.cancelled, value: formatCount(data.order_volumes.cancelled_orders, locale) },
              { label: t.discounts.refundedOrders, value: formatCount(data.order_volumes.refunded_orders, locale) },
              { label: c.totalOrders, value: formatCount(data.order_volumes.total_orders, locale), strong: true },
            ]}
          />
        </Card>
      </div>
      <p className="max-w-2xl text-[13px] leading-6 text-ink-secondary">{z.codNote}</p>
    </div>
  );
}
