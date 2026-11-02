import type { DateFilter } from "@/components/ops/kit/date-range";
import type { components } from "@/lib/api/schema";

export type AnalyticsPeriodQuery = {
  period: components["schemas"]["TimePeriod"];
  start_date?: string;
  end_date?: string;
};

/** The analytics API knows today and yesterday; every other range goes as a custom start and end date. */
export function analyticsPeriod(filter: DateFilter): AnalyticsPeriodQuery {
  if (filter.preset === "today") return { period: "today" };
  if (filter.preset === "yesterday") return { period: "yesterday" };
  return { period: "custom", start_date: filter.from, end_date: filter.to };
}
