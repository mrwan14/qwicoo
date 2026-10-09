"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { answerBlockClass, chartRows, type AssistantAnswerView } from "@/components/assistant/model";
import { useLocale } from "@/lib/i18n/locale-store";

const TERRACOTTA = "var(--primary)";
const SLICES = [TERRACOTTA, "#e39a62", "#8c4a2f", "#d4a574", "#a66b45"];

function useChartReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

function AnswerChart({ chart }: { chart: NonNullable<AssistantAnswerView["chart"]> }) {
  const ready = useChartReady();
  const { locale } = useLocale();
  const { rows, keys } = chartRows(chart);
  const plotted = locale === "ar" ? [...rows].reverse() : rows;
  const data = plotted.map((row) => ({ x: row.x, ...row.values }));
  const margin = locale === "ar" ? { top: 8, right: 0, left: 8, bottom: 4 } : { top: 8, right: 8, left: 0, bottom: 4 };
  const axis = locale === "ar" ? "right" : "left";
  const shared = (
    <>
      <CartesianGrid vertical={false} stroke="var(--border)" />
      <XAxis dataKey="x" tick={{ fill: "var(--foreground)", fontSize: 12 }} />
      <YAxis orientation={axis} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
      <Tooltip
        cursor={{ fill: "var(--secondary)" }}
        content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          return (
            <div className="grid gap-0.5 bg-card px-3 py-2 text-sm text-card-foreground shadow-elev-1">
              <p className="font-medium">{label}</p>
              {payload.map((item) => (
                <p key={String(item.name)}>
                  {item.name}: {item.value}
                </p>
              ))}
            </div>
          );
        }}
      />
      {keys.map((key, index) =>
        chart.type === "line" ? (
          <Line key={key} type="monotone" dataKey={key} stroke={SLICES[index % SLICES.length]} strokeWidth={2} dot={false} />
        ) : (
          <Bar key={key} dataKey={key} fill={SLICES[index % SLICES.length]} radius={[6, 6, 0, 0]} maxBarSize={28} />
        ),
      )}
    </>
  );

  return (
    <div className="h-56 w-full">
      {ready ? (
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === "line" ? (
            <LineChart data={data} margin={margin}>
              {shared}
            </LineChart>
          ) : (
            <BarChart data={data} margin={margin}>
              {shared}
            </BarChart>
          )}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

export function AnswerBlock({ answer, sourcesLabel }: { answer: AssistantAnswerView; sourcesLabel: string }) {
  return (
    <article className={answerBlockClass(answer.tone)}>
      <p className="whitespace-pre-wrap text-sm leading-6">{answer.text}</p>
      {answer.tables.map((table) => (
        <div key={table.columns.join("|")} className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-start text-sm">
            <thead>
              <tr>
                {table.columns.map((column) => (
                  <th key={column} className="border border-border px-2 py-1 text-start font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr key={`${table.columns[0] ?? "row"}-${index}`}>
                  {table.columns.map((column, cell) => (
                    <td key={column} className="border border-border px-2 py-1 tabular-nums">
                      {row[cell] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {answer.chart ? (
        <div className="mt-3">
          <AnswerChart chart={answer.chart} />
        </div>
      ) : null}
      {answer.sources.length > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {sourcesLabel}: {answer.sources.join(" · ")}
        </p>
      ) : null}
    </article>
  );
}
