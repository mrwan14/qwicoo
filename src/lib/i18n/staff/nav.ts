import { defineDictionary } from "@/lib/i18n/dictionary";

const en = {
  brands: "Brands",
  people: "People",
  features: "Features",
  delivery: "Delivery",
  menu: "Menu",
  qr: "QR",
  staff: "Staff",
  team: "Team",
  floor: "Floor",
  requests: "Requests",
  pos: "POS",
  kds: "KDS",
  handover: "Handover",
  payments: "Payments",
  offlineOrders: "Offline orders",
  dashboard: "Dashboard",
  analytics: "Analytics",
  till: "Till",
  attendance: "Attendance",
  audit: "Audit",
  settings: "Settings",
  branchSettings: "Branch settings",
  groups: {
    portfolio: "Portfolio",
    brandOps: "Brand ops",
    insight: "Insight",
  },
} as const;

const ar = {
  brands: "العلامات",
  people: "الأشخاص",
  features: "المزايا",
  delivery: "التوصيل",
  menu: "القائمة",
  qr: "QR",
  staff: "الفريق",
  team: "الفريق",
  floor: "الصالة",
  requests: "الطلبات",
  pos: "POS",
  kds: "KDS",
  handover: "التسليم",
  payments: "المدفوعات",
  offlineOrders: "طلبات دون اتصال",
  dashboard: "لوحة التحكم",
  analytics: "التحليلات",
  till: "الصندوق",
  attendance: "الحضور",
  audit: "السجل",
  settings: "الإعدادات",
  branchSettings: "إعدادات الفرع",
  groups: {
    portfolio: "المحفظة",
    brandOps: "تشغيل العلامة",
    insight: "المؤشرات",
  },
} as const;

export const navCopy = defineDictionary(en, ar);
export type NavLabelKey = Exclude<keyof typeof en, "groups">;
