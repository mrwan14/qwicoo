import { DATE_PRESETS, presetRange, type DateFilter, type DatePreset } from "@/components/ops/kit/date-range";

/**
 * Report filters live in the URL (`?range=thisWeek`, `?range=custom&from=…&to=…`, `&branch=…`),
 * so a refresh keeps them and a link opens the same view. A preset is stored by name, so a
 * bookmarked "today" is always today.
 */
type Params = { get(name: string): string | null; toString(): string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function readFilter(params: Params, fallback: Exclude<DatePreset, "custom">, now: Date = new Date()): DateFilter {
  const preset = params.get("range") as DatePreset | null;
  if (preset === "custom") {
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";
    if (DAY.test(from) && DAY.test(to) && from <= to) return { preset, from, to };
  } else if (preset && DATE_PRESETS.includes(preset)) {
    return { preset, ...presetRange(preset, now) };
  }
  return { preset: fallback, ...presetRange(fallback, now) };
}

/** The query string after changing the range and/or branch; other parameters are kept. */
export function filterQuery(params: Params, next: { range?: DateFilter; branch?: string }): string {
  const query = new URLSearchParams(params.toString());
  if (next.range) {
    query.set("range", next.range.preset);
    if (next.range.preset === "custom") {
      query.set("from", next.range.from);
      query.set("to", next.range.to);
    } else {
      query.delete("from");
      query.delete("to");
    }
  }
  if (next.branch !== undefined) {
    if (next.branch && next.branch !== "all") query.set("branch", next.branch);
    else query.delete("branch");
  }
  return query.toString();
}

/** Just the filter part of a query, to carry from one report to the next. */
export function filterOnly(params: Params): string {
  const source = new URLSearchParams(params.toString());
  const query = new URLSearchParams();
  for (const key of ["range", "from", "to", "branch"]) {
    const value = source.get(key);
    if (value) query.set(key, value);
  }
  return query.toString();
}
