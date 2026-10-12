"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useLocale } from "@/lib/i18n/locale-store";

function useChartReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

export function InventoryBarChart({
  title,
  caption,
  rows,
}: {
  title: string;
  caption: string;
  rows: { label: string; value: number }[];
}) {
  const ready = useChartReady();
  const { locale } = useLocale();
  const margin = locale === "ar" ? { top: 4, right: 4, left: 12, bottom: 4 } : { top: 4, right: 12, left: 4, bottom: 4 };
  return (
    <section className="grid gap-3 bg-card p-4" aria-label={title}>
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{caption}</p>
      </div>
      {rows.length === 0 || !ready ? <p className="text-sm text-muted-foreground">{caption}</p> : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={rows} margin={margin}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} angle={locale === "ar" ? 20 : -20} height={70} />
            <YAxis tick={{ fontSize: 12 }} width={48} />
            <Tooltip content={({ active, payload }) => (active && payload?.[0] ? <Tip>{String(payload[0].value)}</Tip> : null)} />
            <Bar dataKey="value" fill="var(--primary)" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return <div className="bg-card px-3 py-2 text-sm text-card-foreground shadow-elev-1">{children}</div>;
}
