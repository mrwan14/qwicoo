"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ops/kit/badge";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { dateFilter, type DateFilter } from "@/components/ops/kit/date-range";
import { Field, Select } from "@/components/ops/kit/field";
import { FilterBar } from "@/components/ops/kit/filter-bar";
import { formatAmount } from "@/components/ops/kit/money";
import { MoreOptions } from "@/components/ops/kit/side-panel";
import { QueryErrorState } from "@/components/ops/states";
import { matchesOrderChannel } from "@/features/staff/delivery";
import { orderLabel, orderTone, placeLabel, sourceLabel } from "@/features/staff/orders/labels";
import { OrderPanel } from "@/features/staff/orders/order-panel";
import type { StaffOrderListResponse } from "@/features/staff/orders/types";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { formatCairoDateTime } from "@/lib/format/time";
import { useLocale } from "@/lib/i18n/locale-store";
import { ordersCopy } from "@/lib/i18n/staff/orders";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { orderStatusLabel } from "@/lib/status-labels";
import { useScope } from "@/stores/scope";

type Channel = "" | "mobile" | "delivery" | "store";
type Filters = {
  search: string;
  status: string;
  source: string;
  channel: Channel;
  paymentMethod: string;
  paid: "" | "true" | "false";
  range: DateFilter;
};

const STATUSES = ["SUBMITTED", "PREPARING", "READY", "DELIVERED", "PAID", "CLOSED", "CANCELLED", "PENDING_STAFF_CONFIRMATION"] as const;
const SOURCES = ["POS", "QR", "DRIVE_THRU", "PICKUP"] as const;
const METHODS = ["CASH", "CARD", "POS_TERMINAL", "ONLINE"] as const;
/** Typing pauses this long before the search runs, so one word is one request. */
const SEARCH_DELAY = 300;

function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return settled;
}

/** History tab: every order at this branch, filtered on the server as the filters change, opened in the order panel. */
export function OrdersScreen() {
  const t = useStaffSection(ordersCopy);
  const { locale } = useLocale();
  const branchId = useScope((state) => state.branchId);
  const params = useSearchParams();
  // `?q=` comes from the top-bar search; `?order=` opens one order.
  const q = params.get("q");
  const [filters, setFilters] = useState<Filters>(() => ({
    search: q ?? "",
    status: "",
    source: "",
    channel: "",
    paymentMethod: "",
    paid: "",
    range: dateFilter("today"),
  }));
  const [selectedId, setSelectedId] = useState<string | null>(params.get("order"));
  useEffect(() => {
    if (q === null) return;
    setFilters((current) => ({ ...current, search: q }));
  }, [q]);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((current) => ({ ...current, [key]: value }));
  // Dropdowns and dates apply at once; the search box waits for a pause in typing.
  const search = useDebounced(filters.search.trim(), SEARCH_DELAY);
  const applied = { ...filters, search };

  const list = useQuery({
    queryKey: ["staff-orders", branchId, applied],
    enabled: Boolean(branchId),
    // Keep the current rows on screen while the next filter loads.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/orders", {
        params: {
          query: {
            date_from: applied.range.from || null,
            date_to: applied.range.to || null,
            status_filter: (applied.status || null) as never,
            source: applied.source || null,
            payment_method: applied.paymentMethod || null,
            is_paid: applied.paid === "" ? null : applied.paid === "true",
            search: applied.search || null,
            limit: 50,
          },
        },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.loadFailed, locale);
      const data = result.data as StaffOrderListResponse;
      if (applied.channel !== "store") return data;
      const flags = await Promise.all(
        data.items.map(async (row) => {
          const detail = await browserApi.GET("/api/v1/orders/{order_id}", { params: { path: { order_id: row.id } } });
          if (!detail.response.ok || !detail.data) return false;
          return (detail.data.items ?? []).some((item) => item.is_store);
        }),
      );
      return { ...data, items: data.items.filter((_, index) => flags[index]) };
    },
  });

  if (!branchId) return null;

  const allRows = list.data?.items ?? [];
  const rows = allRows.filter((row) => matchesOrderChannel(row, applied.channel));
  const selected = allRows.find((row) => row.id === selectedId) ?? null;
  type Row = (typeof rows)[number];

  const columns: Column<Row>[] = [
    { key: "order", header: t.order, strong: true, width: 130, cell: (row) => orderLabel(row) },
    { key: "where", header: t.live.where, cell: (row) => placeLabel(row, t) },
    { key: "source", header: t.source, width: 150, cell: (row) => sourceLabel(row.order_source, t) },
    { key: "time", header: t.time, width: 190, cell: (row) => formatCairoDateTime(row.created_at, locale) },
    { key: "total", header: t.total, width: 120, align: "end", cell: (row) => formatAmount(row.total_amount, row.currency || "EGP", locale) },
    {
      key: "status",
      header: t.status,
      width: 170,
      cell: (row) => {
        const tone = orderTone(row, t, locale);
        return <Badge tone={tone.tone}>{tone.label}</Badge>;
      },
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 gap-3">
        <FilterBar
          search={{ value: filters.search, onChange: (value) => set("search", value), placeholder: t.searchPlaceholder }}
          date={{ value: filters.range, onChange: (value) => set("range", value), variant: "select" }}
          dropdowns={[
            {
              label: t.status,
              value: filters.status,
              onChange: (value) => set("status", value),
              options: [{ value: "", label: t.live.allStatuses }, ...STATUSES.map((value) => ({ value, label: orderStatusLabel(value, locale) }))],
            },
            {
              label: t.paidFilter,
              value: filters.paid,
              onChange: (value) => set("paid", value as Filters["paid"]),
              options: [
                { value: "", label: `${t.paidFilter}: ${t.any}` },
                { value: "true", label: t.paid },
                { value: "false", label: t.unpaid },
              ],
            },
          ]}
        />
        <MoreOptions label={t.history.moreFilters} summary={t.history.moreSummary}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t.source}>
              <Select value={filters.source} onChange={(event) => set("source", event.target.value)}>
                <option value="">{t.any}</option>
                {SOURCES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.channel}>
              <Select value={filters.channel} onChange={(event) => set("channel", event.target.value as Channel)}>
                <option value="">{t.any}</option>
                <option value="mobile">{t.mobile}</option>
                <option value="delivery">{t.delivery}</option>
                <option value="store">{t.store}</option>
              </Select>
            </Field>
            <Field label={t.payment}>
              <Select value={filters.paymentMethod} onChange={(event) => set("paymentMethod", event.target.value)}>
                <option value="">{t.any}</option>
                {METHODS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </MoreOptions>
      </div>
      {list.isError ? (
        <QueryErrorState error={list.error} screen={t.screen} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable
          caption={t.caption}
          columns={columns}
          rows={rows}
          loading={list.isLoading}
          rowKey={(row) => row.id}
          selectedKey={selectedId}
          onRowClick={(row) => setSelectedId(row.id)}
          empty={t.empty}
        />
      )}
      <OrderPanel orderId={selectedId} summary={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}
