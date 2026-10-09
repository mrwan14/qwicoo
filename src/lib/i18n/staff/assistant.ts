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
} as const;

export const assistantCopy = defineDictionary(en, ar);
