"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/ops/money";
import { StatusChip } from "@/components/ops/status-chip";
import { EmptyState, LoadingState, QueryErrorState } from "@/components/ops/states";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Receipt, printReceipt, type ReceiptLabels } from "@/features/staff/orders/receipt";
import { PaymobRefunds } from "@/features/staff/paymob-refund";
import type { StaffOrderListItem, StaffOrderListResponse, StaffOrderReceipt } from "@/features/staff/orders/types";
import { asApiError } from "@/lib/api/error";
import { browserApi } from "@/lib/api/browser";
import { formatCairoDateTime } from "@/lib/format/time";
import { useLocale } from "@/lib/i18n/locale-store";
import { ordersCopy } from "@/lib/i18n/staff/orders";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

const control = "h-11 w-full border border-input bg-background px-3 text-sm";

/** Today's calendar date in Africa/Cairo as YYYY-MM-DD. */
function cairoToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function orderLabel(row: StaffOrderListItem): string {
  if (row.display_number?.trim()) return row.display_number.trim();
  if (row.pickup_number != null) return `#${row.pickup_number}`;
  return row.id.slice(0, 8);
}

export function OrdersScreen() {
  const t = useStaffSection(ordersCopy);
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const branchId = useScope((state) => state.branchId);
  const today = useMemo(() => cairoToday(), []);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paid, setPaid] = useState<"" | "true" | "false">("");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [applied, setApplied] = useState({
    search: "",
    status: "",
    source: "",
    paymentMethod: "",
    paid: "" as "" | "true" | "false",
    dateFrom: today,
    dateTo: today,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["staff-orders", branchId, applied],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/orders", {
        params: {
          query: {
            date_from: applied.dateFrom || null,
            date_to: applied.dateTo || null,
            status_filter: (applied.status || null) as never,
            source: applied.source || null,
            payment_method: applied.paymentMethod || null,
            is_paid: applied.paid === "" ? null : applied.paid === "true",
            search: applied.search || null,
            limit: 50,
          },
        },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.loadFailed, locale);
      return result.data as StaffOrderListResponse;
    },
  });

  const receiptLabels: ReceiptLabels = {
    receipt: t.receipt,
    date: t.date,
    table: t.table,
    cashier: t.cashier,
    subtotal: t.subtotal,
    discount: t.discount,
    serviceFee: t.serviceFee,
    tax: t.tax,
    total: t.total,
    paid: t.paid,
    unpaid: t.unpaid,
    thanks: t.thanks,
  };

  const receipt = useQuery({
    queryKey: ["staff-receipt", selectedId, branchId],
    enabled: Boolean(selectedId && branchId),
    queryFn: async () => {
      const result = await browserApi.GET("/api/v1/orders/{order_id}/receipt", {
        params: { path: { order_id: selectedId ?? "" } },
      });
      if (!result.response.ok) throw asApiError(result.error, result.response, t.receiptFailed, locale);
      return result.data as StaffOrderReceipt;
    },
  });

  const reprint = useMutation({
    mutationFn: async () => {
      // Always hit the API so RECEIPT_REPRINT is audited and totals stay fresh.
      const result = await browserApi.GET("/api/v1/orders/{order_id}/receipt", {
        params: { path: { order_id: selectedId ?? "" } },
      });
      if (!result.response.ok || !result.data) throw asApiError(result.error, result.response, t.receiptFailed, locale);
      const data = result.data as StaffOrderReceipt;
      queryClient.setQueryData(["staff-receipt", selectedId, branchId], data);
      await printReceipt(data, locale, receiptLabels);
      return data;
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!branchId) return null;
  if (list.isLoading) return <LoadingState label={t.loading} />;
  if (list.isError) return <QueryErrorState error={list.error} screen={t.screen} onRetry={() => void list.refetch()} />;

  const rows = list.data?.items ?? [];

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h1 className="text-[length:var(--text-28)] font-semibold">{t.title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t.hint}</p>
      </div>
      <form
        className="grid gap-3 bg-card p-4 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({ search, status, source, paymentMethod, paid, dateFrom, dateTo });
        }}
      >
        <label className="grid gap-1 text-sm lg:col-span-2">
          {t.search}
          <input className={control} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.searchPlaceholder} />
        </label>
        <label className="grid gap-1 text-sm">
          {t.status}
          <select className={control} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">{t.any}</option>
            {["SUBMITTED", "PREPARING", "READY", "DELIVERED", "PAID", "CLOSED", "CANCELLED", "PENDING_STAFF_CONFIRMATION"].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {t.source}
          <select className={control} value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">{t.any}</option>
            {["POS", "QR", "DRIVE_THRU", "PICKUP", "MOBILE"].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {t.payment}
          <select className={control} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
            <option value="">{t.any}</option>
            {["CASH", "CARD", "POS_TERMINAL", "ONLINE"].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {t.paidFilter}
          <select className={control} value={paid} onChange={(event) => setPaid(event.target.value as "" | "true" | "false")}>
            <option value="">{t.any}</option>
            <option value="true">{t.paid}</option>
            <option value="false">{t.unpaid}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {t.dateFrom}
          <input className={control} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          {t.dateTo}
          <input className={control} type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
        <button type="submit" className="min-h-11 self-end bg-primary px-4 text-sm font-medium text-primary-foreground">
          {t.apply}
        </button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title={t.empty} body="" />
      ) : (
        <div className="overflow-x-auto bg-card">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <caption className="px-4 py-3 text-start text-sm text-muted-foreground">{t.caption}</caption>
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="px-4 py-3 text-start font-medium">{t.order}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t.table}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t.status}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t.source}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t.total}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t.time}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-b last:border-b-0 hover:bg-muted/50"
                  onClick={() => setSelectedId(row.id)}
                >
                  <th scope="row" className="px-4 py-3 text-start font-medium tabular-nums">{orderLabel(row)}</th>
                  <td className="px-4 py-3">{row.table_label ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusChip tone={row.is_paid ? "available" : "ordered"}>{row.status}</StatusChip>
                  </td>
                  <td className="px-4 py-3">{row.order_source}</td>
                  <td className="px-4 py-3">
                    <Money amount={row.total_amount} currency={row.currency || "EGP"} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatCairoDateTime(row.created_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Sheet open={selectedId !== null} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t.detail}</SheetTitle>
          </SheetHeader>
          <div className="grid gap-4 px-4 pb-6">
            {receipt.isLoading ? <LoadingState label={t.printing} /> : null}
            {receipt.isError ? <p className="text-sm text-destructive">{receipt.error.message}</p> : null}
            {receipt.data ? <Receipt receipt={receipt.data} locale={locale} labels={receiptLabels} /> : null}
            {selectedId ? <PaymobRefunds orderId={selectedId} /> : null}
            <button
              type="button"
              className="min-h-11 bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              disabled={!selectedId || reprint.isPending}
              onClick={() => reprint.mutate()}
            >
              {reprint.isPending ? t.printing : t.reprint}
            </button>
            <button type="button" className="min-h-11 border px-4 text-sm" onClick={() => setSelectedId(null)}>
              {t.close}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
