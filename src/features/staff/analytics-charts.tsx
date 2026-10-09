"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { fill } from "@/lib/i18n/dictionary";
import { formatMoney } from "@/lib/format/money";
import { useLocale } from "@/lib/i18n/locale-store";
import { analyticsCopy } from "@/lib/i18n/staff/analytics";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

const TERRACOTTA = "var(--primary)";
const CASH = "#e39a62";
const DIGITAL = "#8c4a2f";
const SLICES = [TERRACOTTA, CASH, DIGITAL, "#d4a574", "#a66b45", "#f3ebe3"];

function useChartReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

function ChartFrame({ title, caption, children }: { title: string; caption: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 bg-card p-4" aria-label={title}>
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{caption}</p>
      </div>
      {children}
    </section>
  );
}

function EmptyPeriod() {
  const charts = useStaffSection(analyticsCopy).charts;
  return <p className="text-sm text-muted-foreground">{charts.empty}</p>;
}

function axisTick(value: string): string {
  return value.length > 22 ? `${value.slice(0, 21)}…` : value;
}

function Tip({ children }: { children: ReactNode }) {
  return <div className="grid gap-0.5 rounded-lg bg-card px-3 py-2 text-sm text-card-foreground shadow-elev-1">{children}</div>;
}

export type ItemChartRow = {
  id: string;
  label: string;
  quantity: number;
  revenue: string;
};

export function ItemsBarChart({ title, caption, rows }: { title: string; caption: string; rows: ItemChartRow[] }) {
  const ready = useChartReady();
  const charts = useStaffSection(analyticsCopy).charts;
  const { locale } = useLocale();
  const margin = locale === "ar" ? { top: 4, right: 4, left: 12, bottom: 4 } : { top: 4, right: 12, left: 4, bottom: 4 };
  if (rows.length === 0) return <ChartFrame title={title} caption={caption}><EmptyPeriod /></ChartFrame>;
  return (
    <ChartFrame title={title} caption={caption}>
      <div className="w-full" style={{ height: Math.max(220, rows.length * 44) }}>
        {ready ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={margin}>
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <YAxis orientation={locale === "ar" ? "right" : "left"} type="category" dataKey="label" width={132} tickFormatter={axisTick} tick={{ fill: "var(--foreground)", fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: "var(--secondary)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as ItemChartRow;
                  return (
                    <Tip>
                      <p className="font-medium">{row.label}</p>
                      <p>{fill(charts.sold, { count: row.quantity })}</p>
                      <p>{formatMoney(row.revenue, undefined, locale)}</p>
                    </Tip>
                  );
                }}
              />
              <Bar dataKey="quantity" name={charts.soldName} fill={TERRACOTTA} radius={[0, 6, 6, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        ) : null}
      </div>
    </ChartFrame>
  );
}

export type CategoryChartRow = {
  id: string;
  label: string;
  revenue: string;
  share: number;
  shareLabel: string;
};

export function CategoryDonut({ rows }: { rows: CategoryChartRow[] }) {
  const ready = useChartReady();
  const charts = useStaffSection(analyticsCopy).charts;
  const { locale } = useLocale();
  const slices = rows.filter((row) => row.share > 0);
  return (
    <ChartFrame title={charts.categories} caption={charts.categoriesCaption}>
      {slices.length === 0 ? <EmptyPeriod /> : (
        <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)]">
          <div className="h-64 w-full">
            {ready ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="share" nameKey="label" innerRadius="58%" outerRadius="82%" paddingAngle={2} stroke="var(--card)">
                    {slices.map((row, index) => (
                      <Cell key={row.id} fill={SLICES[index % SLICES.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as CategoryChartRow;
                      return (
                        <Tip>
                          <p className="font-medium">{row.label}</p>
                          <p>{formatMoney(row.revenue, undefined, locale)}</p>
                          <p>{fill(charts.ofSales, { share: row.shareLabel })}</p>
                        </Tip>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : null}
          </div>
          <ul className="grid gap-2 text-sm">
            {slices.map((row, index) => (
              <li key={row.id} className="flex items-start gap-2">
                <span className="mt-1 size-3 shrink-0 rounded-full" style={{ background: SLICES[index % SLICES.length] }} aria-hidden="true" />
                <span>
                  <span className="font-medium">{row.label}</span>
                  <span className="block tabular-nums text-muted-foreground">{formatMoney(row.revenue, undefined, locale)} · {row.shareLabel}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartFrame>
  );
}

export type BranchChartRow = {
  id: string;
  label: string;
  gmv: number;
  cash: number;
  digital: number;
  gmvText: string;
  cashText: string;
  digitalText: string;
  orders: number;
};

export function BranchesBarChart({ rows }: { rows: BranchChartRow[] }) {
  const ready = useChartReady();
  const charts = useStaffSection(analyticsCopy).charts;
  const { locale } = useLocale();
  const plotted = locale === "ar" ? [...rows].reverse() : rows;
  const margin = locale === "ar" ? { top: 8, right: 0, left: 8, bottom: 8 } : { top: 8, right: 8, left: 0, bottom: 8 };
  return (
    <ChartFrame title={charts.branches} caption={charts.branchesCaption}>
      {rows.length === 0 ? <EmptyPeriod /> : (
        <div className="h-80 w-full">
          {ready ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={plotted} margin={margin}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickFormatter={axisTick} interval={0} tick={{ fill: "var(--foreground)", fontSize: 12 }} />
                <YAxis orientation={locale === "ar" ? "right" : "left"} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: "var(--secondary)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as BranchChartRow;
                    return (
                      <Tip>
                        <p className="font-medium">{row.label}</p>
                        <p>{fill(charts.gross, { amount: row.gmvText })}</p>
                        <p>{fill(charts.cash, { amount: row.cashText })}</p>
                        <p>{fill(charts.digital, { amount: row.digitalText })}</p>
                        <p>{fill(charts.paidOrders, { count: row.orders })}</p>
                      </Tip>
                    );
                  }}
                />
                <Bar dataKey="gmv" name={charts.grossName} fill={TERRACOTTA} radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="cash" name={charts.cashName} fill={CASH} radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="digital" name={charts.digitalName} fill={DIGITAL} radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      )}
    </ChartFrame>
  );
}
