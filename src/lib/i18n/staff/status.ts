import { defineDictionary } from "@/lib/i18n/dictionary";

const en = {
  none: "None",
  kitchen: "Kitchen",
  order: {
    DRAFT: "Draft",
    PENDING_STAFF_CONFIRMATION: "Needs confirmation",
    SUBMITTED: "Confirmed",
    PREPARING: "Preparing",
    READY: "Ready",
    SERVED: "Served",
    DELIVERED: "Delivered",
    PAID: "Paid",
    CLOSED: "Closed",
    CANCELLED: "Cancelled",
  },
  payment: {
    PENDING: "Pending",
    PENDING_CASHIER_VERIFICATION: "Waiting for cash",
    COMPLETED: "Paid",
    FAILED: "Payment failed",
    REFUNDED: "Refunded",
  },
  method: {
    CASH: "Cash",
    CARD_TERMINAL: "Card terminal",
    POS_TERMINAL: "Card terminal",
    STRIPE: "Card",
    ONLINE_CARD: "Card",
    APPLE_PAY: "Apple Pay",
    LOCAL_WALLET: "Wallet",
    ONLINE_PREPAID: "Prepaid",
  },
  occupancy: {
    AVAILABLE: "Available",
    SEATED: "Seated",
    AWAITING_FOOD: "Waiting for food",
    FOOD_SERVED: "Food served",
    BILL_REQUESTED: "Bill requested",
  },
  station: {
    HOT_KITCHEN: "Hot kitchen",
    COLD_KITCHEN: "Cold kitchen",
    BEVERAGE: "Drinks",
    DESSERT: "Dessert",
  },
} as const;

const ar = {
  none: "لا شيء",
  kitchen: "المطبخ",
  order: {
    DRAFT: "مسودة",
    PENDING_STAFF_CONFIRMATION: "بانتظار التأكيد",
    SUBMITTED: "مؤكد",
    PREPARING: "قيد التحضير",
    READY: "جاهز",
    SERVED: "قُدّم",
    DELIVERED: "تم التسليم",
    PAID: "مدفوع",
    CLOSED: "مغلق",
    CANCELLED: "ملغى",
  },
  payment: {
    PENDING: "قيد الانتظار",
    PENDING_CASHIER_VERIFICATION: "بانتظار الكاش",
    COMPLETED: "مدفوع",
    FAILED: "فشل الدفع",
    REFUNDED: "مُسترد",
  },
  method: {
    CASH: "كاش",
    CARD_TERMINAL: "جهاز البطاقة",
    POS_TERMINAL: "جهاز البطاقة",
    STRIPE: "بطاقة",
    ONLINE_CARD: "بطاقة",
    APPLE_PAY: "Apple Pay",
    LOCAL_WALLET: "محفظة",
    ONLINE_PREPAID: "مدفوع مسبقاً",
  },
  occupancy: {
    AVAILABLE: "متاحة",
    SEATED: "مشغولة",
    AWAITING_FOOD: "بانتظار الطعام",
    FOOD_SERVED: "تم تقديم الطعام",
    BILL_REQUESTED: "طُلب الحساب",
  },
  station: {
    HOT_KITCHEN: "المطبخ الساخن",
    COLD_KITCHEN: "المطبخ البارد",
    BEVERAGE: "المشروبات",
    DESSERT: "الحلويات",
  },
} as const;

export const statusCopy = defineDictionary(en, ar);
