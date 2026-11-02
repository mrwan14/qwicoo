import { defineDictionary } from "@/lib/i18n/dictionary";

const en = {
  close: "Close",
  moreOptions: "More options",
  search: "Search",
  apply: "Apply",
  export: "Export",
  delete: "Delete",
  deleting: "Deleting…",
  dateRange: "Date range",
  from: "From",
  to: "To",
  presets: {
    today: "Today",
    yesterday: "Yesterday",
    thisWeek: "This week",
    thisMonth: "This month",
    custom: "Custom",
  },
  nothingYet: "Nothing to show yet",
  comingSoon: "Coming soon",
} as const;

const ar = {
  close: "إغلاق",
  moreOptions: "خيارات إضافية",
  search: "بحث",
  apply: "تطبيق",
  export: "تصدير",
  delete: "حذف",
  deleting: "جارٍ الحذف…",
  dateRange: "الفترة",
  from: "من",
  to: "إلى",
  presets: {
    today: "اليوم",
    yesterday: "أمس",
    thisWeek: "هذا الأسبوع",
    thisMonth: "هذا الشهر",
    custom: "مخصص",
  },
  nothingYet: "لا يوجد شيء لعرضه بعد",
  comingSoon: "قريبًا",
};

export const kitCopy = defineDictionary(en, ar);
