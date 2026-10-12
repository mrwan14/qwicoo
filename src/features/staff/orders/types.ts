/** Staff order history / receipt shapes (OpenAPI currently returns unknown). */

export type StaffOrderListItem = {
  id: string;
  display_number?: string | null;
  pickup_number?: number | null;
  status: string;
  order_source: string;
  fulfillment_type: string;
  table_label?: string | null;
  is_paid: boolean;
  total_amount: string;
  currency?: string;
  created_at: string;
  payment_methods?: string[];
};

export type StaffOrderListTotals = {
  order_count: number;
  paid_count: number;
  unpaid_count: number;
  gross_total: string;
  paid_total: string;
};

export type StaffOrderListResponse = {
  items: StaffOrderListItem[];
  next_cursor?: string | null;
  totals: StaffOrderListTotals;
};

export type StaffReceiptItemLine = {
  name: string;
  quantity: number;
  unit_price: string;
  line_total: string;
};

export type StaffReceiptPaymentLine = {
  method: string;
  status: string;
  amount: string;
  reference?: string | null;
  transaction_reference?: string | null;
};

export type StaffOrderReceipt = {
  order_id: string;
  receipt_number: string;
  created_at: string;
  currency: string;
  branch_name?: string | null;
  branch_address?: string | null;
  branch_phone?: string | null;
  brand_name?: string | null;
  brand_logo_url?: string | null;
  cashier_name?: string | null;
  table_label?: string | null;
  status: string;
  items: StaffReceiptItemLine[];
  subtotal: string;
  discount_total?: string;
  service_fee_total: string;
  tax_total: string;
  total_amount: string;
  payments: StaffReceiptPaymentLine[];
  is_paid: boolean;
};
