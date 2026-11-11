import { defineDictionary } from "@/lib/i18n/dictionary";

const en = {
  title: "Settings",
  subtitle: "Business details, people, money and security.",
  groups: {
    business: "Business",
    people: "People",
    money: "Money & services",
    security: "Security",
  },
  items: {
    brand: { title: "Brand", body: "Name, logo, branches and the Qwicoo app listing." },
    branch: { title: "Branch", body: "Details, opening hours, money and service." },
    tablesQr: { title: "Tables & QR", body: "Add tables, print their QR codes, the guest PIN and the pickup link." },
    staff: { title: "Staff & roles", body: "Who works here, invites and attendance." },
    customers: { title: "Customers", body: "People who order through the Qwicoo app." },
    payments: { title: "Payments", body: "Card payments through Paymob." },
    delivery: { title: "Delivery", body: "Delivery areas and fees." },
    stock: { title: "Stock", body: "Units, import, background jobs and stock rules." },
    audit: { title: "Audit log", body: "Who changed what, and when." },
  },
  nothing: "Nothing to set up for your role.",
  back: "Settings",
  listLabel: "Settings",
  staffTabs: { staff: "Staff", invites: "Invites", attendance: "Attendance" },
  branchTabs: { details: "Details", money: "Money", service: "Service" },
  branchTabsLabel: "Branch settings",
} as const;

const ar = {
  title: "الإعدادات",
  subtitle: "بيانات النشاط والفريق والمال والأمان.",
  groups: {
    business: "النشاط",
    people: "الأشخاص",
    money: "المال والخدمات",
    security: "الأمان",
  },
  items: {
    brand: { title: "العلامة", body: "الاسم والشعار والفروع والظهور في تطبيق كويكو." },
    branch: { title: "الفرع", body: "البيانات ومواعيد العمل والمال والخدمة." },
    tablesQr: { title: "الطاولات وQR", body: "أضف الطاولات واطبع رموز QR الخاصة بها، ورمز PIN للضيوف ورابط الاستلام." },
    staff: { title: "الفريق والأدوار", body: "من يعمل هنا والدعوات والحضور." },
    customers: { title: "العملاء", body: "من يطلبون عبر تطبيق كويكو." },
    payments: { title: "المدفوعات", body: "الدفع بالبطاقة عبر Paymob." },
    delivery: { title: "التوصيل", body: "مناطق التوصيل ورسومه." },
    stock: { title: "المخزون", body: "الوحدات والاستيراد والمهام الخلفية وقواعد المخزون." },
    audit: { title: "سجل التدقيق", body: "من غيّر ماذا ومتى." },
  },
  nothing: "لا توجد إعدادات لدورك.",
  back: "الإعدادات",
  listLabel: "الإعدادات",
  staffTabs: { staff: "الفريق", invites: "الدعوات", attendance: "الحضور" },
  branchTabs: { details: "البيانات", money: "المال", service: "الخدمة" },
  branchTabsLabel: "إعدادات الفرع",
} as const;

export const settingsCopy = defineDictionary(en, ar);
