"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { labelColumns } from "@/components/assistant/column-labels";
import { extractLeadFigure } from "@/components/assistant/lead-figure";
import { renderAssistantMarkdown } from "@/components/assistant/markdown";
import { answerBlockClass, chartRows, type AssistantAnswerView } from "@/components/assistant/model";
import { useLocale } from "@/lib/i18n/locale-store";

const SLICES = ["var(--orange)", "var(--amber)", "var(--sage)", "var(--sage-deep)", "var(--ink)"];

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
      <CartesianGrid vertical={false} stroke="var(--qw-line)" />
      <XAxis dataKey="x" tick={{ fill: "var(--ink)", fontSize: 12 }} />
      <YAxis orientation={axis} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
      <Tooltip
        cursor={{ fill: "var(--canvas)" }}
        content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          return (
            <div className="grid gap-0.5 border border-qw-line bg-white px-3 py-2 text-sm text-ink">
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
          <Bar key={key} dataKey={key} fill={SLICES[index % SLICES.length]} radius={0} maxBarSize={28} />
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

function formatClock(at: number, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(at));
}

export function AnswerBlock({
  answer,
  sourcesLabel,
  receivedAt,
  scopeLabel,
  liveLabel,
  updatedTemplate,
  askAgainLabel,
  onAskAgain,
}: {
  answer: AssistantAnswerView;
  sourcesLabel: string;
  receivedAt?: number;
  scopeLabel?: string;
  liveLabel?: string;
  updatedTemplate?: string;
  askAgainLabel?: string;
  onAskAgain?: () => void;
}) {
  const { locale } = useLocale();
  const lead = answer.tone === "answer" ? extractLeadFigure(answer.text) : null;
  const body = lead?.summary ?? answer.text;
  const html = renderAssistantMarkdown(body);

  return (
    <article className={`asst-fade ${answerBlockClass(answer.tone)}`}>
      {lead ? (
        <p className="mb-2 text-3xl font-semibold tracking-tight text-ink tabular-nums" dir="ltr">
          {lead.figure}
        </p>
      ) : null}
      <div className="text-sm leading-6 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:ms-4 [&_ul]:list-disc [&_ul]:space-y-1" dangerouslySetInnerHTML={{ __html: html }} />
      {answer.tables.map((table) => {
        const columns = labelColumns(table.columns, locale);
        return (
          <div key={table.columns.join("|")} className="mt-3 w-full overflow-x-auto">
            <table className="w-full border-collapse text-start text-sm">
              <thead>
                <tr className="bg-ink text-canvas">
                  {columns.map((column) => (
                    <th key={column} className="px-3 py-2 text-start font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, index) => (
                  <tr key={`${table.columns[0] ?? "row"}-${index}`} className="border-b border-qw-line">
                    {table.columns.map((column, cell) => (
                      <td key={column} className="bg-white px-3 py-2 tabular-nums" dir="ltr">
                        {row[cell] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      {answer.chart ? (
        <div className="mt-3">
          <AnswerChart chart={answer.chart} />
        </div>
      ) : null}
      {answer.sources.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {answer.sources.map((source) => (
            <span key={source} className="border border-qw-line bg-canvas px-2 py-0.5 text-xs text-muted-foreground">
              {source}
            </span>
          ))}
          <span className="sr-only">
            {sourcesLabel}: {answer.sources.join(" · ")}
          </span>
        </div>
      ) : null}
      {receivedAt && liveLabel && updatedTemplate && scopeLabel ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {liveLabel} · {updatedTemplate.replace("{time}", formatClock(receivedAt, locale))} · {scopeLabel}
          </span>
          {onAskAgain && askAgainLabel ? (
            <button type="button" className="font-semibold text-ink underline-offset-2 hover:underline" onClick={onAskAgain}>
              {askAgainLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
