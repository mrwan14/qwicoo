import { defineDictionary } from "@/lib/i18n/dictionary";

const en = {
  title: "Reports",
  subtitle: "Sales, menu, stock, staff and money for the branches you look after.",
  groups: {
    sales: "Sales",
    menu: "Menu",
    stock: "Stock",
    staff: "Staff & shifts",
    money: "Payments & taxes",
  },
  items: {
    overview: { title: "Sales overview", body: "Sales, orders and best sellers for a period." },
    branches: { title: "Branch comparison", body: "Every branch side by side." },
    menu: { title: "Menu performance", body: "What sells, by item and category." },
    stock: { title: "Stock usage", body: "What was used, wasted and bought, with CSV export." },
    attendance: { title: "Attendance", body: "Who checked in, late arrivals and absences." },
    till: { title: "Till / Z report", body: "Drawers, cash counts and end-of-day reports." },
    payments: { title: "Payments", body: "Payments taken and payments waiting to be confirmed." },
  },
  nothing: "No reports for your role yet.",
} as const;

const ar = {
  title: "التقارير",
  subtitle: "المبيعات والقائمة والمخزون والفريق والمال للفروع التي تتابعها.",
  groups: {
    sales: "المبيعات",
    menu: "القائمة",
    stock: "المخزون",
    staff: "الفريق والورديات",
    money: "المدفوعات والضرائب",
  },
  items: {
    overview: { title: "نظرة على المبيعات", body: "المبيعات والطلبات والأكثر مبيعًا لفترة محددة." },
    branches: { title: "مقارنة الفروع", body: "كل الفروع جنبًا إلى جنب." },
    menu: { title: "أداء القائمة", body: "ما يُباع حسب الصنف والفئة." },
    stock: { title: "استهلاك المخزون", body: "ما استُخدم وما أُهدر وما اشتُري، مع تصدير CSV." },
    attendance: { title: "الحضور", body: "من سجّل حضوره والتأخير والغياب." },
    till: { title: "الصندوق / تقرير Z", body: "الأدراج وعدّ النقدية وتقارير نهاية اليوم." },
    payments: { title: "المدفوعات", body: "المدفوعات المحصّلة والمدفوعات التي تنتظر التأكيد." },
  },
  nothing: "لا توجد تقارير لدورك بعد.",
} as const;

export const reportsCopy = defineDictionary(en, ar);
