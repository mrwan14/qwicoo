import { defineDictionary } from "@/lib/i18n/dictionary";

const en = {
  screen: "Payments",
  loading: "Loading payments",
  loadFailed: "Payments failed",
  verifyFailed: "Verify failed",
  verified: "Payment verified",
  title: "Payments",
  hint: "Cash and card-terminal payments waiting for you to confirm the money was taken.",
  waiting: "waiting",
  lastAt: "last {time}",
  empty: "No payments are waiting.",
  caption: "Confirm a row after you have taken the money.",
  order: "Order",
  method: "Method",
  status: "Status",
  amount: "Amount",
  action: "Action",
  pickup: "Pickup {number}",
  table: "Table",
  confirming: "Confirming…",
  confirm: "Confirm payment",
} as const;

const ar = {
  screen: "المدفوعات",
  loading: "جارٍ تحميل المدفوعات",
  loadFailed: "تعذّر تحميل المدفوعات",
  verifyFailed: "تعذّر التحقق",
  verified: "تم التحقق من الدفع",
  title: "المدفوعات",
  hint: "مدفوعات الكاش وجهاز البطاقة بانتظار أن تؤكد استلام المال.",
  waiting: "بانتظار",
  lastAt: "آخر {time}",
  empty: "لا مدفوعات بانتظار.",
  caption: "أكّد الصف بعد أن تقبض المال.",
  order: "الطلب",
  method: "الطريقة",
  status: "الحالة",
  amount: "المبلغ",
  action: "إجراء",
  pickup: "استلام {number}",
  table: "طاولة",
  confirming: "جارٍ التأكيد…",
  confirm: "تأكيد الدفع",
} as const;

export const paymentsCopy = defineDictionary(en, ar);
