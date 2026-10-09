import type { components } from "@/lib/api/schema";
import type { LocaleCode } from "@/lib/i18n/locale-text";

export type AssistantChatResponse = components["schemas"]["AssistantChatResponse"];

export type AssistantTableView = {
  columns: string[];
  rows: string[][];
};

export type AssistantChartPoint = { x: string; y: number };

export type AssistantChartView = {
  type: "bar" | "line";
  series: { name: string; points: AssistantChartPoint[] }[];
};

export type AssistantAnswerTone = "answer" | "refusal";

export type AssistantAnswerView = {
  text: string;
  tables: AssistantTableView[];
  chart: AssistantChartView | null;
  sources: string[];
  refused: boolean;
  tone: AssistantAnswerTone;
};

export type AssistantFailure =
  | { kind: "disabled"; message: string }
  | { kind: "limit"; message: string }
  | { kind: "denied"; message: string }
  | { kind: "network"; message: string };

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

function finite(value: string): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function presentChart(chart: AssistantChatResponse["chart"]): AssistantChartView | null {
  if (!chart || (chart.type !== "bar" && chart.type !== "line")) return null;
  const series = chart.series
    .map((item) => ({
      name: item.name,
      points: item.points.flatMap((point) => {
        const y = finite(point.y);
        return y == null ? [] : [{ x: point.x, y }];
      }),
    }))
    .filter((item) => item.points.length > 0);
  return series.length > 0 ? { type: chart.type, series } : null;
}

/** Tables, chart, and sources stay hidden on a refusal so it reads as a calm reply. */
export function presentAnswer(raw: AssistantChatResponse): AssistantAnswerView {
  const refused = raw.refused === true;
  const tables = refused
    ? []
    : (raw.tables ?? []).flatMap((table) => (table.columns.length > 0 ? [{ columns: table.columns, rows: table.rows }] : []));
  return {
    text: raw.answer,
    tables,
    chart: refused ? null : presentChart(raw.chart),
    sources: refused ? [] : raw.sources.map((source) => source.trim()).filter(Boolean),
    refused,
    tone: refused ? "refusal" : "answer",
  };
}

export function answerBlockClass(tone: AssistantAnswerTone): string {
  return tone === "refusal"
    ? "border border-qw-line bg-canvas px-3 py-3 text-muted-foreground"
    : "border-inline-start-[3px] border-sage bg-transparent py-1 ps-4 text-ink";
}

/** Rows keyed by category, in first-seen order. Arabic callers reverse the list. */
export function chartRows(chart: AssistantChartView): { rows: { x: string; values: Record<string, number> }[]; keys: string[] } {
  const keys = chart.series.map((series) => series.name);
  const order: string[] = [];
  const byX = new Map<string, Record<string, number>>();
  for (const series of chart.series) {
    for (const point of series.points) {
      let values = byX.get(point.x);
      if (!values) {
        values = {};
        byX.set(point.x, values);
        order.push(point.x);
      }
      values[series.name] = point.y;
    }
  }
  return { keys, rows: order.map((x) => ({ x, values: byX.get(x) ?? {} })) };
}

type FailureCopy = { disabled: string; limit: string; network: string; outside: string };

function readError(error: unknown): { status: number | null; code: string | null; detail: string | null } {
  if (error instanceof TypeError) return { status: 0, code: null, detail: null };
  if (!error || typeof error !== "object") return { status: null, code: null, detail: null };
  const record = error as { status?: unknown; code?: unknown; detail?: unknown; message?: unknown };
  const status = typeof record.status === "number" ? record.status : null;
  const code = typeof record.code === "string" ? record.code : null;
  const detail = typeof record.detail === "string" ? record.detail.trim() : null;
  return { status, code, detail: detail || null };
}

function humanLimit(detail: string | null, locale: LocaleCode, fallback: string): string {
  if (!detail || detail === "ASSISTANT_LIMIT_REACHED") return fallback;
  const arabic = ARABIC.test(detail);
  if (locale === "en" && arabic) return fallback;
  if (locale === "ar" && !arabic) return fallback;
  return detail;
}

/**
 * Map a failed assistant call to copy. The machine code is never the message.
 * The live API answers with JSON, so a failed call is a notice rather than a stream.
 */
export function classifyAssistantError(error: unknown, locale: LocaleCode, copy: FailureCopy): AssistantFailure {
  const { status, code, detail } = readError(error);
  if (code === "ASSISTANT_DISABLED" || (status === 503 && code !== "ASSISTANT_LIMIT_REACHED")) {
    return { kind: "disabled", message: copy.disabled };
  }
  if (code === "ASSISTANT_LIMIT_REACHED" || status === 429) {
    return { kind: "limit", message: humanLimit(detail, locale, copy.limit) };
  }
  if (status === 403 || code === "FORBIDDEN" || code === "BRANCH_ACCESS_FORBIDDEN" || code === "ROLE_FORBIDDEN") {
    return { kind: "denied", message: copy.outside };
  }
  return { kind: "network", message: copy.network };
}
