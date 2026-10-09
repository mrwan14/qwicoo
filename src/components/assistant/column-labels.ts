import type { LocaleCode } from "@/lib/i18n/locale-text";

const LABELS: Record<LocaleCode, Record<string, string>> = {
  en: {
    gross_sales: "Gross sales",
    net_sales: "Net sales",
    cancelled_orders: "Cancelled orders",
    order_count: "Orders",
    orders: "Orders",
    item_name: "Item",
    quantity: "Quantity",
    revenue: "Revenue",
    branch: "Branch",
    branch_name: "Branch",
    hour: "Hour",
    cash_difference: "Cash difference",
    average_ticket: "Average ticket",
  },
  ar: {
    gross_sales: "إجمالي المبيعات",
    net_sales: "صافي المبيعات",
    cancelled_orders: "الطلبات الملغاة",
    order_count: "الطلبات",
    orders: "الطلبات",
    item_name: "الصنف",
    quantity: "الكمية",
    revenue: "الإيراد",
    branch: "الفرع",
    branch_name: "الفرع",
    hour: "الساعة",
    cash_difference: "فرق النقدية",
    average_ticket: "متوسط التذكرة",
  },
};

/** Map a column key; unknown keys become spaced words, never snake_case. */
export function columnLabel(key: string, locale: LocaleCode): string {
  const mapped = LABELS[locale][key];
  if (mapped) return mapped;
  return key.replace(/_/g, " ").trim() || key;
}

export function labelColumns(columns: string[], locale: LocaleCode): string[] {
  return columns.map((column) => columnLabel(column, locale));
}
