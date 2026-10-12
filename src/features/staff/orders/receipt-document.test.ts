import assert from "node:assert/strict";
import { test } from "node:test";

import { receiptDocumentHtml, type ReceiptLabels } from "./receipt-document.ts";
import type { StaffOrderReceipt } from "./types.ts";

const labels: ReceiptLabels = {
  receipt: "Receipt",
  date: "Date",
  table: "Table",
  cashier: "Cashier",
  subtotal: "Subtotal",
  discount: "Discount",
  serviceFee: "Service fee",
  tax: "Tax",
  total: "Total",
  paid: "Paid",
  unpaid: "Unpaid",
  thanks: "Thank you",
};

function sampleReceipt(overrides: Partial<StaffOrderReceipt> = {}): StaffOrderReceipt {
  return {
    order_id: "ord-1",
    receipt_number: "R-100",
    created_at: "2026-10-10T12:00:00+00:00",
    currency: "EGP",
    brand_name: "Demo Brand",
    branch_name: "Downtown",
    branch_address: "12 Nile St",
    branch_phone: "+20 100 000 0000",
    cashier_name: "Sara",
    table_label: "7",
    status: "PAID",
    items: [{ name: "Shawarma <special>", quantity: 2, unit_price: "50.00", line_total: "100.00" }],
    subtotal: "100.00",
    discount_total: "0",
    service_fee_total: "10.00",
    tax_total: "14.00",
    total_amount: "124.00",
    payments: [{ method: "CASH", status: "COMPLETED", amount: "124.00" }],
    is_paid: true,
    ...overrides,
  };
}

test("receipt HTML includes identity, lines, totals, and escapes item names", () => {
  const html = receiptDocumentHtml(sampleReceipt(), "en", labels);
  assert.match(html, /Demo Brand/);
  assert.match(html, /Downtown/);
  assert.match(html, /12 Nile St/);
  assert.match(html, /R-100/);
  assert.match(html, /2×/);
  assert.match(html, /Shawarma &lt;special&gt;/);
  assert.match(html, /Service fee/);
  assert.match(html, /Tax/);
  assert.match(html, /Thank you/);
  assert.doesNotMatch(html, /Discount/);
});

test("discount line appears only when non-zero", () => {
  const html = receiptDocumentHtml(sampleReceipt({ discount_total: "5.00" }), "en", labels);
  assert.match(html, /Discount/);
});

test("a Paymob line shows the provider transaction id", () => {
  const html = receiptDocumentHtml(
    sampleReceipt({
      payments: [{ method: "PAYMOB", status: "COMPLETED", amount: "40.00", provider_txn_id: "192036465", reference: "slip-9" }],
    }),
    "en",
    labels,
  );
  assert.match(html, /Paymob/);
  assert.match(html, /192036465/);
  assert.doesNotMatch(html, /slip-9/);
});

test("unpaid receipt without payments shows unpaid label", () => {
  const html = receiptDocumentHtml(sampleReceipt({ payments: [], is_paid: false }), "en", labels);
  assert.match(html, /Unpaid/);
});

test("Arabic locale sets rtl direction", () => {
  const html = receiptDocumentHtml(sampleReceipt(), "ar", {
    ...labels,
    receipt: "إيصال",
    thanks: "شكراً لكم",
  });
  assert.match(html, /lang="ar"/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /إيصال/);
});

test("missing items/payments arrays do not throw", () => {
  const html = receiptDocumentHtml(
    sampleReceipt({ items: undefined as never, payments: undefined as never }),
    "en",
    labels,
  );
  assert.match(html, /Total/);
});
