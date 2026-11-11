"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, FileText, Paperclip } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge, type Tone } from "@/components/ops/kit/badge";
import { Button } from "@/components/ops/kit/button";
import { KpiCard } from "@/components/ops/kit/card";
import { ConfirmDialog } from "@/components/ops/kit/confirm-dialog";
import { DataTable, type Column } from "@/components/ops/kit/data-table";
import { Field, Input, Select, Textarea } from "@/components/ops/kit/field";
import { SegmentedControl } from "@/components/ops/kit/segmented";
import { Money } from "@/components/ops/money";
import { PageHeader } from "@/components/ops/page-header";
import { LoadingState, QueryErrorState } from "@/components/ops/states";
import { useStaffSession } from "@/components/ops/staff-session";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ApiError } from "@/lib/api/error";
import {
  attachInvoice,
  createBill,
  fetchBill,
  fetchBillDraft,
  fetchBills,
  invoiceUrl,
  payBill,
  voidBill,
  voidBillPayment,
  type BillDetail,
  type BillLine,
  type BillPaymentMethod,
  type BillStatus,
  type BillSummary,
} from "@/lib/api/supplier-bills";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { canWriteStock } from "./access";
import { InventoryFrame, useBranchCurrency } from "./chrome";
import { billTotalsMatch, cairoDay, moneyInput, priceChange } from "./bills";
import { formatQty } from "./qty";

type Filter = "all" | "open" | "OVERDUE" | "PART_PAID" | "PAID" | "VOID";
const METHODS: BillPaymentMethod[] = ["CASH", "BANK_TRANSFER", "CHEQUE", "OTHER"];
const TONE: Record<BillStatus, Tone> = { UNPAID: "warning", PART_PAID: "info", PAID: "success", OVERDUE: "danger", VOID: "neutral" };

function useBillCopy() {
  return useStaffSection(inventoryCopy).bills;
}

function dayLabel(day: string, locale: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric", numberingSystem: "latn" }).format(date);
}

/** A bill error in plain words: our copy for known codes, the API's own message otherwise. */
function billError(error: unknown, errors: Record<string, string>, fallback: string): string {
  if (error instanceof ApiError) {
    const code = error.code ?? (/^[A-Z_]+$/.test(error.message) ? error.message : null);
    if (code && errors[code]) return errors[code];
    return error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

export function BillsScreen() {
  const t = useStaffSection(inventoryCopy);
  const b = t.bills;
  const { locale } = useLocale();
  const brandId = useScope((state) => state.brandId) ?? "";
  const currency = useBranchCurrency();
  const [filter, setFilter] = useState<Filter>("open");
  const [supplierId, setSupplierId] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const bills = useQuery({
    queryKey: ["inventory", "bills", brandId, supplierId],
    enabled: Boolean(brandId),
    queryFn: () => fetchBills({ brandId, supplierId: supplierId || undefined }, t.loadFailed),
  });
  const all = bills.data?.items ?? [];
  const rows = all.filter((bill) =>
    filter === "all" ? true : filter === "open" ? bill.status !== "PAID" && bill.status !== "VOID" : bill.status === filter,
  );
  const suppliers = [...new Map(all.map((bill) => [bill.supplier.id, bill.supplier.name])).entries()].sort((x, y) => x[1].localeCompare(y[1]));
  const openCount = all.filter((bill) => bill.status !== "PAID" && bill.status !== "VOID").length;

  const columns: Column<BillSummary>[] = [
    { key: "supplier", header: b.supplier, strong: true, cell: (bill) => bill.supplier.name },
    { key: "invoice", header: b.invoice, cell: (bill) => <bdi>{bill.invoice_number}</bdi> },
    { key: "date", header: b.invoiceDate, cell: (bill) => dayLabel(bill.invoice_date, locale) },
    { key: "due", header: b.dueDate, cell: (bill) => dayLabel(bill.due_date, locale) },
    { key: "total", header: b.total, align: "end", cell: (bill) => <Money amount={bill.total} currency={currency} /> },
    { key: "balance", header: b.balance, align: "end", cell: (bill) => (bill.status === "VOID" ? "—" : <Money amount={bill.balance} currency={currency} />) },
    { key: "status", header: b.status, width: 130, cell: (bill) => <Badge tone={TONE[bill.status]}>{b.statuses[bill.status]}</Badge> },
  ];

  return (
    <InventoryFrame page="bills">
      <PageHeader title={b.title} detail={b.detail} />
      <div className="grid gap-3 sm:grid-cols-2">
        <KpiCard
          label={b.owed}
          value={bills.data ? <Money amount={bills.data.owed} currency={currency} /> : "—"}
          note={bills.data ? fill(b.openBills, { count: openCount }) : undefined}
          loading={bills.isLoading}
        />
        <KpiCard label={b.overdue} value={bills.data ? <Money amount={bills.data.overdue} currency={currency} /> : "—"} loading={bills.isLoading} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<Filter>
          label={b.status}
          value={filter}
          onValueChange={setFilter}
          items={(["open", "OVERDUE", "PART_PAID", "PAID", "VOID", "all"] as const).map((value) => ({ value, label: b.filters[value] }))}
        />
        <Select aria-label={b.supplier} className="w-auto min-w-48" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
          <option value="">{b.allSuppliers}</option>
          {suppliers.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
      </div>
      {bills.isError ? (
        <QueryErrorState error={bills.error} screen={b.title} onRetry={() => void bills.refetch()} />
      ) : (
        <DataTable
          stack
          caption={b.title}
          columns={columns}
          rows={rows}
          loading={bills.isLoading}
          rowKey={(bill) => bill.id}
          onRowClick={(bill) => setOpenId(bill.id)}
          empty={all.length === 0 ? b.empty : b.emptyFiltered}
        />
      )}
      {openId ? <BillSheet billId={openId} onClose={() => setOpenId(null)} /> : null}
    </InventoryFrame>
  );
}

function LinesTable({ lines, currency }: { lines: BillLine[]; currency: string }) {
  const b = useBillCopy();
  const { locale } = useLocale();
  return (
    <div className="overflow-x-auto rounded-[12px] border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-subtle/60">
            {[b.lines, b.billed, b.lineTotal].map((label, index) => (
              <th key={label} className={`px-3 py-2 font-medium ${index === 0 ? "text-start" : "text-end"}`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const change = priceChange(line.ordered_unit_price, line.unit_price);
            return (
              <tr key={line.ingredient_id} className="border-b align-top last:border-b-0">
                <td className="px-3 py-2">
                  <span className="block">{pickLocale(line.name, locale) || line.sku}</span>
                  <span className="text-xs text-ink-secondary tabular-nums">
                    {formatQty(line.qty, locale)} {line.unit_code}
                  </span>
                </td>
                <td className="px-3 py-2 text-end">
                  <span className={`inline-flex items-center gap-1 ${change > 0 ? "text-danger" : change < 0 ? "text-success" : ""}`}>
                    {change > 0 ? <ArrowUp aria-label={b.priceUp} className="size-3.5" /> : change < 0 ? <ArrowDown aria-label={b.priceDown} className="size-3.5" /> : null}
                    <Money amount={line.unit_price} currency={currency} />
                  </span>
                  {change !== 0 ? (
                    <span className="block text-xs text-ink-secondary">
                      {b.ordered} <Money amount={line.ordered_unit_price} currency={currency} />
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-end">
                  <Money amount={line.line_total} currency={currency} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The bill form for one delivery, opened right after receiving goods. */
export function NewBillSheet({ receiptId, onClose, onSaved }: { receiptId: string; onClose: () => void; onSaved?: (bill: BillDetail) => void }) {
  const t = useStaffSection(inventoryCopy);
  const b = t.bills;
  const currency = useBranchCurrency();
  const queryClient = useQueryClient();
  const [number, setNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(cairoDay());
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [subtotal, setSubtotal] = useState<string | null>(null);
  const [vat, setVat] = useState("0.00");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [openBill, setOpenBill] = useState<string | null>(null);
  const draft = useQuery({ queryKey: ["inventory", "bill-draft", receiptId], queryFn: () => fetchBillDraft(receiptId, t.loadFailed) });
  const terms = draft.data?.supplier.payment_terms_days ?? 0;
  const before = subtotal ?? draft.data?.received_total ?? "";
  const total = moneyInput(Number(before || 0) + Number(vat || 0));
  const due = dueDate ?? (draft.data ? addDays(invoiceDate, terms) : "");
  const valid = Boolean(number.trim()) && Number(before) >= 0 && Number(total) > 0 && billTotalsMatch(before, vat, total) && due >= invoiceDate;

  const save = useMutation({
    mutationFn: async () => {
      const bill = await createBill(
        { receipt_id: receiptId, invoice_number: number.trim(), invoice_date: invoiceDate, due_date: due, subtotal: moneyInput(before), vat: moneyInput(vat), total, notes: notes.trim() || null },
        t.loadFailed,
      );
      if (file) {
        try {
          return await attachInvoice(bill.id, file, t.loadFailed);
        } catch (error) {
          toast.error(billError(error, b.errors, t.loadFailed));
        }
      }
      return bill;
    },
    onSuccess: (bill) => {
      toast.success(b.saved);
      void queryClient.invalidateQueries({ queryKey: ["inventory", "bills"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory", "suppliers"] });
      onSaved?.(bill);
      onClose();
    },
    onError: (error) => toast.error(billError(error, b.errors, t.loadFailed)),
  });

  if (openBill) return <BillSheet billId={openBill} onClose={onClose} />;
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto rounded-none sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{draft.data ? `${b.addTitle} · ${draft.data.supplier.name}` : b.addTitle}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-6">
          {draft.isLoading ? <LoadingState label={t.loading} /> : null}
          {draft.isError ? <QueryErrorState error={draft.error} screen={b.title} onRetry={() => void draft.refetch()} /> : null}
          {draft.data?.existing_bill_id ? (
            <div className="grid gap-3 rounded-[12px] bg-subtle p-4">
              <p className="text-sm">{b.alreadyBilled}</p>
              <Button variant="secondary" onClick={() => setOpenBill(draft.data?.existing_bill_id ?? null)}>
                {b.openBill}
              </Button>
            </div>
          ) : null}
          {draft.data && !draft.data.existing_bill_id ? (
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (valid) save.mutate();
              }}
            >
              <LinesTable lines={draft.data.lines} currency={currency} />
              <p className="text-sm text-ink-secondary">
                <span className="font-medium text-ink">
                  {b.receivedTotal} <Money amount={draft.data.received_total} currency={currency} />
                </span>
                {" · "}
                {b.receivedTotalHint}
              </p>
              <Field label={b.invoiceNumber} required>
                <Input value={number} onChange={(event) => setNumber(event.target.value)} maxLength={64} required dir="auto" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={b.invoiceDate} required>
                  <Input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} required />
                </Field>
                <Field label={b.dueDate} required hint={terms ? fill(b.dueHint, { days: terms }) : b.dueSameDay}>
                  <Input type="date" value={due} min={invoiceDate} onChange={(event) => setDueDate(event.target.value)} required />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={b.subtotal} required>
                  <Input inputMode="decimal" value={before} onChange={(event) => setSubtotal(event.target.value)} required />
                </Field>
                <Field label={b.vat}>
                  <Input inputMode="decimal" value={vat} onChange={(event) => setVat(event.target.value)} />
                </Field>
                <Field label={b.total}>
                  <p className="flex h-[42px] items-center text-base font-semibold">
                    <Money amount={total} currency={currency} />
                  </p>
                </Field>
              </div>
              <Field label={b.notes}>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} />
              </Field>
              <Field label={b.attach} hint={b.attachHint}>
                <Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              </Field>
              <Button type="submit" disabled={!valid || save.isPending}>
                {save.isPending ? b.saving : b.save}
              </Button>
            </form>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** One bill: what arrived, totals, the invoice file, payments, and voiding. */
export function BillSheet({ billId, onClose }: { billId: string; onClose: () => void }) {
  const t = useStaffSection(inventoryCopy);
  const b = t.bills;
  const { locale } = useLocale();
  const me = useStaffSession();
  const canWrite = canWriteStock(me?.role);
  const currency = useBranchCurrency();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(cairoDay());
  const [method, setMethod] = useState<BillPaymentMethod>("CASH");
  const [note, setNote] = useState("");
  const [voiding, setVoiding] = useState<{ kind: "bill" } | { kind: "payment"; id: string } | null>(null);
  const [reason, setReason] = useState("");
  const bill = useQuery({ queryKey: ["inventory", "bill", billId], queryFn: () => fetchBill(billId, t.loadFailed) });
  const data = bill.data;

  const settle = (next: BillDetail) => {
    queryClient.setQueryData(["inventory", "bill", billId], next);
    void queryClient.invalidateQueries({ queryKey: ["inventory", "bills"] });
    void queryClient.invalidateQueries({ queryKey: ["inventory", "suppliers"] });
  };
  const fail = (error: unknown) => toast.error(billError(error, b.errors, t.loadFailed));
  const pay = useMutation({
    mutationFn: () => payBill(billId, { paid_on: paidOn, amount: moneyInput(amount), method, note: note.trim() || null }, t.loadFailed),
    onSuccess: (next) => {
      toast.success(b.paymentSaved);
      setAmount("");
      setNote("");
      settle(next);
    },
    onError: fail,
  });
  const voidIt = useMutation({
    mutationFn: () =>
      voiding?.kind === "payment" ? voidBillPayment(billId, voiding.id, reason.trim(), t.loadFailed) : voidBill(billId, reason.trim(), t.loadFailed),
    onSuccess: (next) => {
      setVoiding(null);
      setReason("");
      settle(next);
    },
    onError: fail,
  });
  const attach = useMutation({
    mutationFn: (file: File) => attachInvoice(billId, file, t.loadFailed),
    onSuccess: (next) => {
      toast.success(b.attached);
      settle(next);
    },
    onError: fail,
  });

  const livePayments = data?.payments.filter((payment) => !payment.voided_at) ?? [];
  const isVoid = data?.status === "VOID";
  const payable = Boolean(data && canWrite && !isVoid && Number(data.balance) > 0);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto rounded-none sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{data ? `${data.supplier.name} · ${data.invoice_number}` : b.addTitle}</SheetTitle>
        </SheetHeader>
        <div className="grid gap-5 px-4 pb-6">
          {bill.isLoading ? <LoadingState label={t.loading} /> : null}
          {bill.isError ? <QueryErrorState error={bill.error} screen={b.title} onRetry={() => void bill.refetch()} /> : null}
          {data ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
                <Badge tone={TONE[data.status]}>{b.statuses[data.status]}</Badge>
                <span>
                  {b.invoiceDate} {dayLabel(data.invoice_date, locale)} · {b.dueDate} {dayLabel(data.due_date, locale)}
                </span>
              </div>
              {isVoid && data.void_reason ? <p className="rounded-[12px] bg-subtle p-3 text-sm">{fill(b.voidedBecause, { reason: data.void_reason })}</p> : null}

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-[12px] border border-border p-4 text-sm">
                {[
                  [b.subtotal, data.subtotal],
                  [b.vat, data.vat],
                  [b.total, data.total],
                  [b.balance, isVoid ? "0.00" : data.balance],
                ].map(([label, value]) => (
                  <div key={label} className="grid">
                    <dt className="text-xs text-ink-secondary">{label}</dt>
                    <dd className="font-semibold">
                      <Money amount={value} currency={currency} />
                    </dd>
                  </div>
                ))}
              </dl>

              <LinesTable lines={data.lines} currency={currency} />
              {data.notes ? <p className="whitespace-pre-wrap text-sm" dir="auto">{data.notes}</p> : null}

              <div className="flex flex-wrap items-center gap-2">
                {data.has_attachment ? (
                  <a className="inline-flex min-h-10 items-center gap-2 rounded-staff border border-border px-3 text-sm font-medium hover:bg-subtle" href={invoiceUrl(billId)} target="_blank" rel="noopener noreferrer">
                    <FileText aria-hidden className="size-4" />
                    {b.viewInvoice}
                  </a>
                ) : null}
                {canWrite && !isVoid ? (
                  <>
                    <Button variant="secondary" size="sm" disabled={attach.isPending} onClick={() => fileInput.current?.click()}>
                      <Paperclip aria-hidden />
                      {data.has_attachment ? b.attachReplace : b.attach}
                    </Button>
                    <input
                      ref={fileInput}
                      type="file"
                      hidden
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) attach.mutate(file);
                        event.target.value = "";
                      }}
                    />
                  </>
                ) : null}
              </div>

              <section className="grid gap-2">
                <h3 className="text-sm font-semibold">{b.payments}</h3>
                {data.payments.length === 0 ? <p className="text-sm text-ink-secondary">{b.noPayments}</p> : null}
                <ul className="grid gap-1">
                  {data.payments.map((payment) => (
                    <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-b-0">
                      <span className={payment.voided_at ? "text-ink-secondary line-through" : ""}>
                        {dayLabel(payment.paid_on, locale)} · {payment.created_by_name ? fill(b.paidBy, { method: b.methods[payment.method], name: payment.created_by_name }) : b.methods[payment.method]}
                        {payment.note ? <span dir="auto"> · {payment.note}</span> : null}
                      </span>
                      <span className="flex items-center gap-2">
                        {payment.voided_at ? <Badge tone="neutral">{b.voided}</Badge> : null}
                        <Money amount={payment.amount} currency={currency} />
                        {canWrite && !payment.voided_at && !isVoid ? (
                          <Button variant="ghost" size="sm" onClick={() => setVoiding({ kind: "payment", id: payment.id })}>
                            {b.voidPayment}
                          </Button>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              {payable ? (
                <form
                  className="grid gap-3 rounded-[12px] bg-subtle/60 p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (Number(amount) > 0) pay.mutate();
                  }}
                >
                  <h3 className="text-sm font-semibold">{b.pay}</h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label={b.payAmount} required>
                      <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required />
                    </Field>
                    <Field label={b.payDate} required>
                      <Input type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} required />
                    </Field>
                    <Field label={b.payMethod}>
                      <Select value={method} onChange={(event) => setMethod(event.target.value as BillPaymentMethod)}>
                        {METHODS.map((value) => (
                          <option key={value} value={value}>
                            {b.methods[value]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <Field label={b.payNote}>
                    <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={255} dir="auto" />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={pay.isPending || !(Number(amount) > 0)}>
                      {pay.isPending ? b.paying : b.pay}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setAmount(data.balance)}>
                      {b.payAll}
                    </Button>
                  </div>
                </form>
              ) : null}

              {canWrite && !isVoid ? (
                <div className="grid gap-1 border-t pt-4">
                  <Button variant="ghost" className="w-fit text-danger" onClick={() => setVoiding({ kind: "bill" })} disabled={livePayments.length > 0}>
                    {b.voidBill}
                  </Button>
                  {livePayments.length > 0 ? <p className="text-xs text-ink-secondary">{b.voidFirst}</p> : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        <ConfirmDialog
          open={voiding !== null}
          onOpenChange={(open) => {
            if (!open) {
              setVoiding(null);
              setReason("");
            }
          }}
          title={voiding?.kind === "payment" ? b.voidPaymentTitle : b.voidBillTitle}
          body={
            <span className="grid gap-3">
              <span>{voiding?.kind === "payment" ? b.voidPaymentBody : b.voidBillBody}</span>
              <Field label={b.voidReason} required>
                <Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={255} dir="auto" />
              </Field>
            </span>
          }
          confirmLabel={voiding?.kind === "payment" ? b.voidPayment : b.voidBill}
          pending={voidIt.isPending}
          onConfirm={() => {
            if (reason.trim()) voidIt.mutate();
            else toast.error(b.voidReason);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
