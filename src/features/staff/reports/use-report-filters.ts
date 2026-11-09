"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";

import type { DateFilter, DatePreset } from "@/components/ops/kit/date-range";

import { filterOnly, filterQuery, readFilter } from "./filter-query";

const MEMORY = "qwicoo.reports.filter";

function recall(): string | null {
  try {
    return window.sessionStorage.getItem(MEMORY);
  } catch {
    return null;
  }
}

function remember(query: string) {
  try {
    window.sessionStorage.setItem(MEMORY, query);
  } catch {
    // Private windows can refuse storage; the URL still holds the filter.
  }
}

/**
 * The period (and branch) of a report, kept in the URL. A report opened without filters picks up
 * the last ones used in this tab, so moving from Sales to Menu keeps "This week".
 *
 * `carry: false` skips that hand-over, for Till where today has no Z report yet.
 */
export function useReportFilters(fallback: Exclude<DatePreset, "custom"> = "today", { carry = true }: { carry?: boolean } = {}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const range = useMemo(() => readFilter(params, fallback), [params, fallback]);
  const branch = params.get("branch") ?? "all";

  const go = useCallback(
    (query: string) => {
      remember(filterOnly(new URLSearchParams(query)));
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  // A report opened from a link or a bookmark hands its period on too, not only one picked here.
  useEffect(() => {
    if (params.get("range")) remember(filterOnly(params));
  }, [params]);

  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (!carry || params.get("range")) return;
    const saved = recall();
    if (!saved) return;
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of new URLSearchParams(saved)) query.set(key, value);
    router.replace(`${pathname}?${query}`, { scroll: false });
  }, [carry, params, pathname, router]);

  const setRange = useCallback((next: DateFilter) => go(filterQuery(params, { range: next })), [go, params]);
  const setBranch = useCallback((next: string) => go(filterQuery(params, { branch: next })), [go, params]);
  return { range, setRange, branch, setBranch };
}
