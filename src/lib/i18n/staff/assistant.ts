import { defineDictionary } from "@/lib/i18n/dictionary";

const en = {
  typing: "Qwicoo is writing…",
  disabled: "Not available yet",
  limit: "You've reached this month's question limit.",
  network: "The connection dropped. Try again.",
  retry: "Retry",
  sources: "Sources",
  send: "Send",
  placeholder: "Ask a question",
  composerLabel: "Your question",
  you: "You",
  qwicoo: "Qwicoo",
  ask: "Ask Qwicoo",
  branch: "Branch",
  outside: "That stays outside the branches you can see.",
  starters: {
    today: "Today vs yesterday",
    items: "Best and worst items this week",
    cash: "Any cash drawer differences this week?",
    cancelled: "Cancelled orders today",
    hours: "Busiest hours this month",
    topBranch: "Which branch sold the most this month?",
  },
} as const;

const ar = {
  typing: "كويكو يكتب…",
  disabled: "غير متاح بعد",
  limit: "وصلت إلى حد الأسئلة لهذا الشهر.",
  network: "انقطع الاتصال. حاول مرة أخرى.",
  retry: "إعادة المحاولة",
  sources: "المصادر",
  send: "إرسال",
  placeholder: "اكتب سؤالاً",
  composerLabel: "سؤالك",
  you: "أنت",
  qwicoo: "كويكو",
  ask: "اسأل كويكو",
  branch: "الفرع",
  outside: "هذا خارج الفروع التي يمكنك الاطلاع عليها.",
  starters: {
    today: "اليوم مقارنة بالأمس",
    items: "أفضل وأسوأ الأصناف هذا الأسبوع",
    cash: "هل يوجد فرق في درج النقدية هذا الأسبوع؟",
    cancelled: "الطلبات الملغاة اليوم",
    hours: "أكثر الساعات ازدحاماً هذا الشهر",
    topBranch: "أي فرع باع أكثر هذا الشهر؟",
  },
} as const;

export const assistantCopy = defineDictionary(en, ar);
