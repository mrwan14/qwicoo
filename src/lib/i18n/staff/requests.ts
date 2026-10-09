import { defineDictionary } from "@/lib/i18n/dictionary";

const en = {
  screen: "Requests",
  loading: "Loading requests",
  queueFailed: "Queue failed",
  updateFailed: "Update failed",
  escalateFailed: "Escalate failed",
  escalated: "Escalated {count}",
  title: "Requests",
  escalate: "Escalate overdue",
  empty: "No open requests.",
  table: "Table",
  tableNumber: "Table {number}",
  type: {
    WATER: "Water",
    WATER_REFILL: "Water refill",
    CUTLERY: "Cutlery",
    NAPKINS: "Napkins",
    PLATES: "Plates",
    WAITER_CALL: "Call a waiter",
    PACK_LEFTOVERS: "Pack leftovers",
    BILL_REQUEST: "Ask for the bill",
    TAKEAWAY_ORDER: "Takeaway",
    OTHER: "Something else",
  },
  status: {
    PENDING: "Pending",
    ACKNOWLEDGED: "Acknowledged",
    COMPLETED: "Completed",
    DISMISSED: "Dismissed",
  },
  action: {
    ACKNOWLEDGED: "Acknowledge",
    COMPLETED: "Complete",
    DISMISSED: "Dismiss",
  },
} as const;

const ar = {
  screen: "الطلبات",
  loading: "جارٍ تحميل الطلبات",
  queueFailed: "تعذّر تحميل الطلبات",
  updateFailed: "تعذّر التحديث",
  escalateFailed: "تعذّر التصعيد",
  escalated: "تم تصعيد {count}",
  title: "الطلبات",
  escalate: "تصعيد المتأخر",
  empty: "لا توجد طلبات مفتوحة.",
  table: "طاولة",
  tableNumber: "طاولة {number}",
  type: {
    WATER: "ماء",
    WATER_REFILL: "إعادة ملء الماء",
    CUTLERY: "أدوات المائدة",
    NAPKINS: "مناديل",
    PLATES: "أطباق",
    WAITER_CALL: "استدعاء النادل",
    PACK_LEFTOVERS: "تغليف المتبقي",
    BILL_REQUEST: "طلب الحساب",
    TAKEAWAY_ORDER: "طلب للخارج",
    OTHER: "طلب آخر",
  },
  status: {
    PENDING: "قيد الانتظار",
    ACKNOWLEDGED: "تم الاستلام",
    COMPLETED: "تم",
    DISMISSED: "أُغلق",
  },
  action: {
    ACKNOWLEDGED: "استلام",
    COMPLETED: "إتمام",
    DISMISSED: "إغلاق",
  },
} as const;

export const requestsCopy = defineDictionary(en, ar);
