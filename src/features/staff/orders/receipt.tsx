"use client";

import type { LocaleCode } from "@/lib/i18n/locale-text";
import { formatMoney } from "@/lib/format/money";

import { printHtmlInIframe } from "./print-html";
import type { StaffOrderReceipt } from "./types";

const RECEIPT_CSS = `
@page { size: 80mm auto; margin: 0; }
@media print {
  html, body { margin: 0; padding: 0; background: #fff; }
  .receipt-sheet { width: 72mm; max-width: 72mm; margin: 0 auto; }
}
@media print and (min-width: 210mm) {
  @page { size: A4; margin: 12mm; }
  .receipt-sheet { width: 72mm; margin: 0 auto; }
}
.receipt-sheet {
  box-sizing: border-box;
  width: 72mm;
  max-width: 72mm;
  padding: 4mm;
  color: #111;
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 12px;
  line-height: 1.35;
}
.receipt-sheet[dir="rtl"] {
  font-family: "IBM Plex Sans Arabic", "Noto Naskh Arabic", sans-serif;
}
.receipt-sheet h1 { font-size: 16px; margin: 0 0 4px; font-weight: 700; }
.receipt-sheet .muted { color: #555; }
.receipt-sheet .row { display: flex; justify-content: space-between; gap: 8px; }
.receipt-sheet .line { border-top: 1px dashed #999; margin: 6px 0; }
.receipt-sheet .ltr { unicode-bidi: isolate; direction: ltr; }
.receipt-sheet table { width: 100%; border-collapse: collapse; }
.receipt-sheet td { padding: 2px 0; vertical-align: top; }
.receipt-sheet td.qty { width: 2.5em; }
.receipt-sheet td.amt { text-align: end; white-space: nowrap; }
`;

function money(amount: string, currency: string, locale: LocaleCode): string {
  return formatMoney(amount, currency || "EGP", locale);
}

export function receiptDocumentHtml(receipt: StaffOrderReceipt, locale: LocaleCode, labels: ReceiptLabels): string {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const currency = receipt.currency || "EGP";
  const lines = receipt.items
    .map(
      (item) => `
      <tr>
        <td class="qty ltr">${item.quantity}×</td>
        <td>${escapeHtml(item.name)}</td>
        <td class="amt ltr">${escapeHtml(money(item.line_total, currency, locale))}</td>
      </tr>`,
    )
    .join("");
  const payments = receipt.payments
    .map(
      (payment) => `
      <div class="row">
        <span>${escapeHtml(payment.method)} · ${escapeHtml(payment.status)}</span>
        <span class="ltr">${escapeHtml(money(payment.amount, currency, locale))}</span>
      </div>`,
    )
    .join("");

  return `<!DOCTYPE html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"/><title>${escapeHtml(labels.receipt)}</title><style>${RECEIPT_CSS}</style></head><body>
  <div class="receipt-sheet" dir="${dir}">
    <h1>${escapeHtml(receipt.brand_name || receipt.branch_name || "Qwicoo")}</h1>
    ${receipt.branch_name ? `<div>${escapeHtml(receipt.branch_name)}</div>` : ""}
    ${receipt.branch_address ? `<div class="muted">${escapeHtml(receipt.branch_address)}</div>` : ""}
    ${receipt.branch_phone ? `<div class="muted ltr">${escapeHtml(receipt.branch_phone)}</div>` : ""}
    <div class="line"></div>
    <div class="row"><span>${escapeHtml(labels.receipt)}</span><span class="ltr">${escapeHtml(receipt.receipt_number)}</span></div>
    <div class="row"><span>${escapeHtml(labels.date)}</span><span class="ltr">${escapeHtml(new Date(receipt.created_at).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB"))}</span></div>
    ${receipt.table_label ? `<div class="row"><span>${escapeHtml(labels.table)}</span><span class="ltr">${escapeHtml(receipt.table_label)}</span></div>` : ""}
    ${receipt.cashier_name ? `<div class="row"><span>${escapeHtml(labels.cashier)}</span><span>${escapeHtml(receipt.cashier_name)}</span></div>` : ""}
    <div class="line"></div>
    <table><tbody>${lines}</tbody></table>
    <div class="line"></div>
    <div class="row"><span>${escapeHtml(labels.subtotal)}</span><span class="ltr">${escapeHtml(money(receipt.subtotal, currency, locale))}</span></div>
    ${Number(receipt.discount_total || 0) ? `<div class="row"><span>${escapeHtml(labels.discount)}</span><span class="ltr">${escapeHtml(money(receipt.discount_total || "0", currency, locale))}</span></div>` : ""}
    <div class="row"><span>${escapeHtml(labels.serviceFee)}</span><span class="ltr">${escapeHtml(money(receipt.service_fee_total, currency, locale))}</span></div>
    <div class="row"><span>${escapeHtml(labels.tax)}</span><span class="ltr">${escapeHtml(money(receipt.tax_total, currency, locale))}</span></div>
    <div class="row"><strong>${escapeHtml(labels.total)}</strong><strong class="ltr">${escapeHtml(money(receipt.total_amount, currency, locale))}</strong></div>
    <div class="line"></div>
    ${payments || `<div class="muted">${escapeHtml(receipt.is_paid ? labels.paid : labels.unpaid)}</div>`}
    <div class="line"></div>
    <div class="muted">${escapeHtml(labels.thanks)}</div>
  </div>
  </body></html>`;
}

export type ReceiptLabels = {
  receipt: string;
  date: string;
  table: string;
  cashier: string;
  subtotal: string;
  discount: string;
  serviceFee: string;
  tax: string;
  total: string;
  paid: string;
  unpaid: string;
  thanks: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function printReceipt(receipt: StaffOrderReceipt, locale: LocaleCode, labels: ReceiptLabels): void {
  printHtmlInIframe(receiptDocumentHtml(receipt, locale, labels));
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
  return (
    <div
      dir={dir}
      className={`w-[72mm] max-w-full border bg-card p-3 text-sm ${locale === "ar" ? "font-[family-name:var(--font-arabic)]" : ""}`}
    >
      <p className="text-base font-semibold">{receipt.brand_name || receipt.branch_name || "Qwicoo"}</p>
      {receipt.branch_name ? <p>{receipt.branch_name}</p> : null}
      <p className="text-muted-foreground">
        {labels.receipt} <span dir="ltr">{receipt.receipt_number}</span>
      </p>
      {receipt.table_label ? (
        <p>
          {labels.table} <span dir="ltr">{receipt.table_label}</span>
        </p>
      ) : null}
      <ul className="mt-3 grid gap-1 border-y py-2">
        {receipt.items.map((item, index) => (
          <li key={`${item.name}-${index}`} className="flex justify-between gap-2">
            <span>
              <span dir="ltr">{item.quantity}×</span> {item.name}
            </span>
            <span dir="ltr">{money(item.line_total, currency, locale)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex justify-between font-semibold">
        <span>{labels.total}</span>
        <span dir="ltr">{money(receipt.total_amount, currency, locale)}</span>
      </p>
    </div>
  );
}
