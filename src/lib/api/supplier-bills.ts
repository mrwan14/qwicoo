/** Supplier bills: hand-typed until the generated schema is refreshed against the API. */
import { query, staffJson } from "@/lib/api/staff-json";

export type BillStatus = "UNPAID" | "PART_PAID" | "PAID" | "OVERDUE" | "VOID";
export type BillPaymentMethod = "CASH" | "BANK_TRANSFER" | "CHEQUE" | "OTHER";

export type BillSupplier = { id: string; name: string; payment_terms_days: number | null; tax_number: string | null };

export type BillLine = {
  ingredient_id: string;
  sku: string;
  name: Record<string, string> | null;
  unit_code: string;
  qty: string;
  ordered_unit_price: string;
  unit_price: string;
  line_total: string;
};

export type BillDraft = {
  receipt_id: string;
  purchase_order_id: string;
  received_at: string;
  supplier: BillSupplier;
  lines: BillLine[];
  received_total: string;
  invoice_date: string;
  due_date: string;
  existing_bill_id: string | null;
};

export type BillPayment = {
  id: string;
  paid_on: string;
  amount: string;
  method: BillPaymentMethod;
  note: string | null;
  created_by_name: string | null;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
  from_drawer?: boolean;
};

export type BillSummary = {
  id: string;
  supplier: BillSupplier;
  branch_id: string | null;
  purchase_order_id: string;
  receipt_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  subtotal: string;
  vat: string;
  total: string;
  paid: string;
  balance: string;
  status: BillStatus;
  has_attachment: boolean;
  created_at: string;
};

export type BillDetail = BillSummary & {
  notes: string | null;
  lines: BillLine[];
  received_total: string;
  payments: BillPayment[];
  void_reason: string | null;
  voided_at: string | null;
};

export type BillList = { items: BillSummary[]; owed: string; overdue: string };

export type BillCreate = {
  receipt_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string | null;
  subtotal: string;
  vat: string;
  total: string;
  notes?: string | null;
};

const BASE = "/api/v1/inventory";
const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export function fetchBillDraft(receiptId: string, failed: string) {
  return staffJson<BillDraft>(`${BASE}/receipts/${receiptId}/bill-draft`, {}, failed);
}

export function fetchBills(input: { brandId: string; status?: BillStatus | ""; supplierId?: string }, failed: string) {
  return staffJson<BillList>(
    `${BASE}/supplier-bills${query({ brand_id: input.brandId, status: input.status, supplier_id: input.supplierId })}`,
    {},
    failed,
  );
}

export function fetchBill(id: string, failed: string) {
  return staffJson<BillDetail>(`${BASE}/supplier-bills/${id}`, {}, failed);
}

export function createBill(body: BillCreate, failed: string) {
  return staffJson<BillDetail>(`${BASE}/supplier-bills`, json(body), failed);
}

export function payBill(
  id: string,
  body: { paid_on: string; amount: string; method: BillPaymentMethod; note?: string | null; from_drawer?: boolean },
  failed: string,
) {
  return staffJson<BillDetail>(`${BASE}/supplier-bills/${id}/payments`, json(body), failed);
}

export function voidBillPayment(id: string, paymentId: string, reason: string, failed: string) {
  return staffJson<BillDetail>(`${BASE}/supplier-bills/${id}/payments/${paymentId}/void`, json({ reason }), failed);
}

export function voidBill(id: string, reason: string, failed: string) {
  return staffJson<BillDetail>(`${BASE}/supplier-bills/${id}/void`, json({ reason }), failed);
}

export function attachInvoice(id: string, file: File, failed: string) {
  const body = new FormData();
  body.set("file", file, file.name);
  return staffJson<BillDetail>(`${BASE}/supplier-bills/${id}/attachment`, { method: "POST", body }, failed);
}

/** Opens the invoice photo or PDF in a new tab (the API streams it or redirects to a short private link). */
export function invoiceUrl(id: string): string {
  return `${BASE}/supplier-bills/${id}/attachment`;
}
