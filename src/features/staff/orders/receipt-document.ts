import { formatMoney } from "@/lib/format/money";
import { formatCairoDateTime } from "@/lib/format/time";
import type { LocaleCode } from "@/lib/i18n/locale-text";
import { paymentMethodLabel, paymentStatusLabel } from "@/lib/status-labels";

import type { StaffOrderReceipt } from "./types";

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

const RECEIPT_CSS = `
/* Do not set @page size — fighting Chrome’s A4/Landscape defaults makes preview flash. */
@page { margin: 10mm; }
html, body {
  margin: 0;
  padding: 0;
  background: #fff;
}
.receipt-sheet {
  box-sizing: border-box;
  width: 72mm;
  max-width: 72mm;
  margin: 0 auto;
  padding: 4mm;
  color: #111;
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 12px;
  line-height: 1.35;
}
.receipt-sheet[dir="rtl"] {
  font-family: "IBM Plex Sans Arabic", "Noto Naskh Arabic", "Segoe UI", Tahoma, sans-serif;
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function hasAmount(value: string | null | undefined): boolean {
  const n = Number(value || 0);
  return Number.isFinite(n) && n !== 0;
}

/** Full thermal receipt HTML document for iframe printing. */
export function receiptDocumentHtml(receipt: StaffOrderReceipt, locale: LocaleCode, labels: ReceiptLabels): string {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const currency = receipt.currency || "EGP";
  const items = receipt.items ?? [];
  const payments = receipt.payments ?? [];

  const lines = items
    .map(
      (item) => `
      <tr>
        <td class="qty ltr">${item.quantity}×</td>
        <td>${escapeHtml(item.name)}</td>
        <td class="amt ltr">${escapeHtml(money(item.line_total, currency, locale))}</td>
      </tr>`,
    )
    .join("");

  const paymentRows = payments
    .map(
      (payment) => `
      <div class="row">
        <span>${escapeHtml(paymentMethodLabel(payment.method, locale))} · ${escapeHtml(paymentStatusLabel(payment.status, locale))}</span>
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
    <div class="row"><span>${escapeHtml(labels.date)}</span><span class="ltr">${escapeHtml(formatCairoDateTime(receipt.created_at, locale))}</span></div>
    ${receipt.table_label ? `<div class="row"><span>${escapeHtml(labels.table)}</span><span class="ltr">${escapeHtml(receipt.table_label)}</span></div>` : ""}
    ${receipt.cashier_name ? `<div class="row"><span>${escapeHtml(labels.cashier)}</span><span>${escapeHtml(receipt.cashier_name)}</span></div>` : ""}
    <div class="line"></div>
    <table><tbody>${lines}</tbody></table>
    <div class="line"></div>
    <div class="row"><span>${escapeHtml(labels.subtotal)}</span><span class="ltr">${escapeHtml(money(receipt.subtotal, currency, locale))}</span></div>
    ${hasAmount(receipt.discount_total) ? `<div class="row"><span>${escapeHtml(labels.discount)}</span><span class="ltr">${escapeHtml(money(receipt.discount_total || "0", currency, locale))}</span></div>` : ""}
    <div class="row"><span>${escapeHtml(labels.serviceFee)}</span><span class="ltr">${escapeHtml(money(receipt.service_fee_total, currency, locale))}</span></div>
    <div class="row"><span>${escapeHtml(labels.tax)}</span><span class="ltr">${escapeHtml(money(receipt.tax_total, currency, locale))}</span></div>
    <div class="row"><strong>${escapeHtml(labels.total)}</strong><strong class="ltr">${escapeHtml(money(receipt.total_amount, currency, locale))}</strong></div>
    <div class="line"></div>
    ${paymentRows || `<div class="muted">${escapeHtml(receipt.is_paid ? labels.paid : labels.unpaid)}</div>`}
    <div class="line"></div>
    <div class="muted">${escapeHtml(labels.thanks)}</div>
  </div>
  </body></html>`;
}
