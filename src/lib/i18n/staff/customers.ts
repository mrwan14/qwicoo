import { defineDictionary } from "@/lib/i18n/dictionary";

const en = {
  title: "Qwicoo app customers",
  hint: "People who order from this restaurant in the Qwicoo app. Blocking stops them ordering here only. Their account at other restaurants stays open.",
  loading: "Loading customers",
  failed: "Could not load customers",
  empty: "No customers match.",
  chooseBrand: "Choose a restaurant first.",
  search: "Search",
  searchPlaceholder: "Name, email or phone",
  orders: "{count} orders",
  block: "Block",
  unblock: "Unblock",
  blockTitle: "Block this customer?",
  unblockTitle: "Unblock this customer?",
  blockBody: "They will not be able to order at this restaurant. Their account elsewhere is unchanged.",
  unblockBody: "They can order at this restaurant again.",
  blocked: "Blocked",
  active: "Active",
  saved: "Customer updated",
  saveFailed: "Could not update this customer",
} as const;

const ar = {
  title: "عملاء تطبيق كويكو",
  hint: "من يطلب من هذا المطعم في تطبيق كويكو. الحظر يوقف الطلب من هذا المطعم فقط. حسابه في المطاعم الأخرى يبقى مفتوحاً.",
  loading: "جارٍ تحميل العملاء",
  failed: "تعذّر تحميل العملاء",
  empty: "لا عملاء يطابقون البحث.",
  chooseBrand: "اختر مطعماً أولاً.",
  search: "بحث",
  searchPlaceholder: "الاسم أو البريد أو الهاتف",
  orders: "{count} طلبات",
  block: "حظر",
  unblock: "رفع الحظر",
  blockTitle: "حظر هذا العميل؟",
  unblockTitle: "رفع الحظر عن هذا العميل؟",
  blockBody: "لن يستطيع الطلب من هذا المطعم. حسابه في مكان آخر لا يتغير.",
  unblockBody: "يستطيع الطلب من هذا المطعم من جديد.",
  blocked: "محظور",
  active: "نشط",
  saved: "تم تحديث العميل",
  saveFailed: "تعذّر تحديث هذا العميل",
} as const;

export const customersCopy = defineDictionary(en, ar);
