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
    branch: { title: "Branch", body: "Details, opening hours, tables, money and service." },
    tablesQr: { title: "Tables & QR", body: "Guest PIN, pickup link and table QR codes." },
    staff: { title: "Staff & roles", body: "Who works here, invites and attendance." },
    customers: { title: "Customers", body: "People who order through the Qwicoo app." },
    payments: { title: "Payments", body: "Card payments through Paymob." },
    delivery: { title: "Delivery", body: "Delivery areas and fees." },
    stock: { title: "Stock", body: "Units, import, background jobs and stock rules." },
    audit: { title: "Audit log", body: "Who changed what, and when." },
  },
  nothing: "Nothing to set up for your role.",
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
    branch: { title: "الفرع", body: "البيانات ومواعيد العمل والطاولات والمال والخدمة." },
    tablesQr: { title: "الطاولات وQR", body: "رمز PIN للضيوف ورابط الاستلام ورموز QR للطاولات." },
    staff: { title: "الفريق والأدوار", body: "من يعمل هنا والدعوات والحضور." },
    customers: { title: "العملاء", body: "من يطلبون عبر تطبيق كويكو." },
    payments: { title: "المدفوعات", body: "الدفع بالبطاقة عبر Paymob." },
    delivery: { title: "التوصيل", body: "مناطق التوصيل ورسومه." },
    stock: { title: "المخزون", body: "الوحدات والاستيراد والمهام الخلفية وقواعد المخزون." },
    audit: { title: "سجل التدقيق", body: "من غيّر ماذا ومتى." },
  },
  nothing: "لا توجد إعدادات لدورك.",
} as const;

export const settingsCopy = defineDictionary(en, ar);
