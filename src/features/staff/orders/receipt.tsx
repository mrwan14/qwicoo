"use client";

import type { LocaleCode } from "@/lib/i18n/locale-text";
import { formatMoney } from "@/lib/format/money";
import { formatCairoDateTime } from "@/lib/format/time";
import { paymentMethodLabel, paymentStatusLabel } from "@/lib/status-labels";

import { printHtmlInIframe } from "./print-html";
import { receiptDocumentHtml, type ReceiptLabels } from "./receipt-document";
import type { StaffOrderReceipt } from "./types";

export type { ReceiptLabels };
export { receiptDocumentHtml };

function money(amount: string, currency: string, locale: LocaleCode): string {
  return formatMoney(amount, currency || "EGP", locale);
}

function hasAmount(value: string | null | undefined): boolean {
  const n = Number(value || 0);
  return Number.isFinite(n) && n !== 0;
}

export async function printReceipt(receipt: StaffOrderReceipt, locale: LocaleCode, labels: ReceiptLabels): Promise<void> {
  await printHtmlInIframe(receiptDocumentHtml(receipt, locale, labels));
}

/** On-screen preview that mirrors the thermal receipt. */
export function Receipt({
  receipt,
  locale,
  labels,
}: {
  receipt: StaffOrderReceipt;
  locale: LocaleCode;
  labels: ReceiptLabels;
}) {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const currency = receipt.currency || "EGP";
  const items = receipt.items ?? [];
  const payments = receipt.payments ?? [];

  return (
    <div
      dir={dir}
      className={`w-[72mm] max-w-full border bg-card p-3 text-sm ${locale === "ar" ? "font-[family-name:var(--font-arabic)]" : ""}`}
    >
      <p className="text-base font-semibold">{receipt.brand_name || receipt.branch_name || "Qwicoo"}</p>
      {receipt.branch_name ? <p>{receipt.branch_name}</p> : null}
      {receipt.branch_address ? <p className="text-muted-foreground">{receipt.branch_address}</p> : null}
      {receipt.branch_phone ? (
        <p className="text-muted-foreground" dir="ltr">
          {receipt.branch_phone}
        </p>
      ) : null}
      <div className="mt-2 grid gap-0.5 border-t border-dashed pt-2 text-muted-foreground">
        <p className="flex justify-between gap-2">
          <span>{labels.receipt}</span>
          <span dir="ltr">{receipt.receipt_number}</span>
        </p>
        <p className="flex justify-between gap-2">
          <span>{labels.date}</span>
          <span dir="ltr">{formatCairoDateTime(receipt.created_at, locale)}</span>
        </p>
        {receipt.table_label ? (
          <p className="flex justify-between gap-2">
            <span>{labels.table}</span>
            <span dir="ltr">{receipt.table_label}</span>
          </p>
        ) : null}
        {receipt.cashier_name ? (
          <p className="flex justify-between gap-2">
            <span>{labels.cashier}</span>
            <span>{receipt.cashier_name}</span>
          </p>
        ) : null}
      </div>
      <ul className="mt-3 grid gap-1 border-y border-dashed py-2">
        {items.map((item, index) => (
          <li key={`${item.name}-${index}`} className="flex justify-between gap-2">
            <span>
              <span dir="ltr">{item.quantity}×</span> {item.name}
            </span>
            <span dir="ltr">{money(item.line_total, currency, locale)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 grid gap-0.5">
        <p className="flex justify-between gap-2">
          <span>{labels.subtotal}</span>
          <span dir="ltr">{money(receipt.subtotal, currency, locale)}</span>
        </p>
        {hasAmount(receipt.discount_total) ? (
          <p className="flex justify-between gap-2">
            <span>{labels.discount}</span>
            <span dir="ltr">{money(receipt.discount_total || "0", currency, locale)}</span>
          </p>
        ) : null}
        <p className="flex justify-between gap-2">
          <span>{labels.serviceFee}</span>
          <span dir="ltr">{money(receipt.service_fee_total, currency, locale)}</span>
        </p>
        <p className="flex justify-between gap-2">
          <span>{labels.tax}</span>
          <span dir="ltr">{money(receipt.tax_total, currency, locale)}</span>
        </p>
        <p className="flex justify-between gap-2 font-semibold">
          <span>{labels.total}</span>
          <span dir="ltr">{money(receipt.total_amount, currency, locale)}</span>
        </p>
      </div>
      <div className="mt-2 grid gap-0.5 border-t border-dashed pt-2">
        {payments.length > 0 ? (
          payments.map((payment, index) => (
            <p key={`${payment.method}-${index}`} className="flex justify-between gap-2 text-muted-foreground">
              <span>
                {paymentMethodLabel(payment.method, locale)} · {paymentStatusLabel(payment.status, locale)}
              </span>
              <span dir="ltr">{money(payment.amount, currency, locale)}</span>
            </p>
          ))
        ) : (
          <p className="text-muted-foreground">{receipt.is_paid ? labels.paid : labels.unpaid}</p>
        )}
      </div>
      <p className="mt-2 text-muted-foreground">{labels.thanks}</p>
    </div>
  );
}
