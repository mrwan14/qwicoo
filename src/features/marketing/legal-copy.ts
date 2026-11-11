import type { LocaleCode } from "@/lib/i18n/locale-text";

import { CONTACT } from "./contact";

/**
 * Plain-language starting drafts. Have them reviewed by a lawyer before relying on them.
 * Kept out of the dictionary test on purpose: the two languages are prose, not mirrored keys.
 */
type LegalDoc = { title: string; updated: string; intro: string; sections: { heading: string; body: string[] }[] };

const UPDATED = { en: "Last updated: 9 November 2026", ar: "آخر تحديث: 9 نوفمبر 2026" };

export const privacyCopy: Record<LocaleCode, LegalDoc> = {
  en: {
    title: "Privacy policy",
    updated: UPDATED.en,
    intro:
      "This policy explains what Qwicoo collects on this website and in the Qwicoo restaurant system, why, and what you can ask us to do with it. We follow Egypt's Personal Data Protection Law (Law No. 151 of 2020).",
    sections: [
      {
        heading: "What we collect on this website",
        body: [
          "When you send the demo form we receive your name, restaurant name, city, number of branches, phone number or email, your message and any promo code.",
          "When you use Ask Qwicoo on this site, your questions are sent to our assistant to answer them. Please don't share personal details in the chat.",
          "We don't use advertising trackers on this page.",
        ],
      },
      {
        heading: "Why we use it",
        body: [
          "To reply to you, prepare a demo and talk about bringing your restaurant onto Qwicoo.",
          "To improve the answers our assistant gives about Qwicoo.",
          "We don't sell your details, and we don't share them with anyone except the service providers that host and run Qwicoo for us.",
        ],
      },
      {
        heading: "Restaurants using Qwicoo",
        body: [
          "Each restaurant owns the data it enters: menus, orders, staff accounts, stock and reports. We process it only to run the service for that restaurant.",
          "Card payments are handled by the restaurant's own Paymob account. Qwicoo does not store card numbers.",
          "A restaurant can export its reports at any time, and can ask us to delete its data when it leaves.",
        ],
      },
      {
        heading: "How long we keep it",
        body: [
          "Demo requests are kept for up to 24 months unless you become a partner or ask us to delete them sooner.",
          "Restaurant data is kept while the subscription is active and for a limited period afterwards for legal and accounting needs.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "You can ask to see, correct or delete the personal data we hold about you, or object to how we use it.",
          `Contact us at ${CONTACT.email} or on WhatsApp ${CONTACT.whatsappDisplay}. We reply within one working day.`,
        ],
      },
    ],
  },
  ar: {
    title: "سياسة الخصوصية",
    updated: UPDATED.ar,
    intro:
      "توضح هذه السياسة ما يجمعه كويكو في هذا الموقع وفي نظام كويكو للمطاعم، ولماذا، وما يمكنك أن تطلبه منا بشأنه. نلتزم بقانون حماية البيانات الشخصية المصري (القانون رقم 151 لسنة 2020).",
    sections: [
      {
        heading: "ما نجمعه في هذا الموقع",
        body: [
          "عند إرسال نموذج العرض نستلم اسمك واسم المطعم والمدينة وعدد الفروع ورقم الهاتف أو البريد ورسالتك وأي كود خصم.",
          "عند استخدام «اسأل كويكو» في هذا الموقع تُرسل أسئلتك إلى المساعد ليجيب عنها. من فضلك لا تشارك بيانات شخصية في المحادثة.",
          "لا نستخدم أدوات تتبع إعلانية في هذه الصفحة.",
        ],
      },
      {
        heading: "لماذا نستخدمها",
        body: [
          "للرد عليك وتجهيز عرض تجريبي والحديث عن انضمام مطعمك إلى كويكو.",
          "لتحسين إجابات المساعد عن كويكو.",
          "لا نبيع بياناتك، ولا نشاركها إلا مع مزودي الخدمة الذين يستضيفون كويكو ويشغلونه لصالحنا.",
        ],
      },
      {
        heading: "المطاعم التي تستخدم كويكو",
        body: [
          "كل مطعم يملك البيانات التي يدخلها: المنيو والطلبات وحسابات الفريق والمخزون والتقارير. نعالجها فقط لتشغيل الخدمة لهذا المطعم.",
          "يتم الدفع بالبطاقة عبر حساب Paymob الخاص بالمطعم. كويكو لا يحفظ أرقام البطاقات.",
          "يمكن للمطعم تصدير تقاريره في أي وقت، وطلب حذف بياناته عند المغادرة.",
        ],
      },
      {
        heading: "مدة الاحتفاظ",
        body: [
          "نحتفظ بطلبات العرض حتى 24 شهرًا ما لم تصبح شريكًا أو تطلب حذفها قبل ذلك.",
          "نحتفظ ببيانات المطعم طوال مدة الاشتراك ولفترة محدودة بعدها للمتطلبات القانونية والمحاسبية.",
        ],
      },
      {
        heading: "حقوقك",
        body: [
          "يمكنك أن تطلب الاطلاع على بياناتك الشخصية لدينا أو تصحيحها أو حذفها، أو الاعتراض على طريقة استخدامها.",
          `تواصل معنا على ${CONTACT.email} أو واتساب \u2066${CONTACT.whatsappDisplay}\u2069. نرد خلال يوم عمل واحد.`,
        ],
      },
    ],
  },
};

export const termsCopy: Record<LocaleCode, LegalDoc> = {
  en: {
    title: "Terms of service",
    updated: UPDATED.en,
    intro: "These terms cover a restaurant's subscription to Qwicoo. Your signed order form or written offer from us takes priority if it says something different.",
    sections: [
      {
        heading: "The service",
        body: [
          "Qwicoo provides table QR ordering, a POS, kitchen and floor screens, stock, attendance, reports and the related tools, as described on this website.",
          "We set up your menu, branches and staff accounts during onboarding, and we keep improving the product over time.",
        ],
      },
      {
        heading: "Prices and billing",
        body: [
          "Prices are per branch per month in Egyptian pounds and exclude 14% VAT. Current prices are listed in the Pricing section of this website.",
          "Billing is monthly unless you choose yearly billing. Founding Partner and promo offers apply as stated in your written offer.",
          "Qwicoo takes no commission on card payments. Card payments are processed by your own Paymob account under Paymob's terms and fees.",
        ],
      },
      {
        heading: "Cancelling",
        body: [
          "You can cancel at any time. The service stays active until the end of the period you have paid for. Yearly payments are not refunded for unused months unless agreed in writing.",
          "Before you leave, you can export your reports. We delete your restaurant data after a limited period, as described in the privacy policy.",
        ],
      },
      {
        heading: "Your responsibilities",
        body: [
          "Keep staff passwords and PINs private, and give each person only the role they need.",
          "You are responsible for your menu, prices, taxes and receipts, and for the devices and internet connection in your branches.",
        ],
      },
      {
        heading: "Availability and liability",
        body: [
          "We work to keep Qwicoo available and your data safe. The offline till lets branches keep taking cash orders during internet outages.",
          "To the extent the law allows, our liability for any claim is limited to the fees you paid us in the three months before it.",
        ],
      },
      {
        heading: "Law and contact",
        body: [
          "These terms are governed by the laws of the Arab Republic of Egypt.",
          `Questions: ${CONTACT.email} or WhatsApp ${CONTACT.whatsappDisplay}.`,
        ],
      },
    ],
  },
  ar: {
    title: "شروط الخدمة",
    updated: UPDATED.ar,
    intro: "تغطي هذه الشروط اشتراك المطعم في كويكو. إذا اختلف نموذج الطلب الموقّع أو العرض المكتوب منا عن هذه الشروط، يُعمل بما فيه.",
    sections: [
      {
        heading: "الخدمة",
        body: [
          "يوفر كويكو طلب الطاولات بالـQR والكاشير وشاشات المطبخ والصالة والمخزون والحضور والتقارير والأدوات المرتبطة بها كما هو موضح في هذا الموقع.",
          "نجهز المنيو والفروع وحسابات الفريق أثناء التجهيز، ونستمر في تطوير المنتج.",
        ],
      },
      {
        heading: "الأسعار والفوترة",
        body: [
          "الأسعار لكل فرع شهريًا بالجنيه المصري ولا تشمل ضريبة القيمة المضافة 14%. الأسعار الحالية في قسم الأسعار في هذا الموقع.",
          "الفوترة شهرية ما لم تختر الدفع السنوي. يُطبق عرض الشركاء المؤسسين وأكواد الخصم كما في العرض المكتوب لك.",
          "كويكو لا يأخذ عمولة على الدفع بالبطاقة. تتم مدفوعات البطاقة عبر حساب Paymob الخاص بك وفق شروط Paymob ورسومها.",
        ],
      },
      {
        heading: "الإلغاء",
        body: [
          "يمكنك الإلغاء في أي وقت، وتظل الخدمة فعالة حتى نهاية الفترة المدفوعة. لا تُسترد قيمة الأشهر غير المستخدمة في الدفع السنوي إلا باتفاق مكتوب.",
          "قبل المغادرة يمكنك تصدير تقاريرك. نحذف بيانات مطعمك بعد فترة محدودة كما هو موضح في سياسة الخصوصية.",
        ],
      },
      {
        heading: "مسؤولياتك",
        body: [
          "حافظ على سرية كلمات المرور ورموز PIN، وامنح كل شخص الدور الذي يحتاجه فقط.",
          "أنت مسؤول عن المنيو والأسعار والضرائب والإيصالات، وعن الأجهزة والإنترنت في فروعك.",
        ],
      },
      {
        heading: "التوفر والمسؤولية",
        body: [
          "نعمل على إبقاء كويكو متاحًا وبياناتك آمنة. يتيح الكاشير دون اتصال للفروع الاستمرار في الطلبات النقدية أثناء انقطاع الإنترنت.",
          "في الحدود التي يسمح بها القانون، تقتصر مسؤوليتنا عن أي مطالبة على الرسوم التي دفعتها لنا في الأشهر الثلاثة السابقة لها.",
        ],
      },
      {
        heading: "القانون والتواصل",
        body: ["تخضع هذه الشروط لقوانين جمهورية مصر العربية.", `للاستفسار: ${CONTACT.email} أو واتساب \u2066${CONTACT.whatsappDisplay}\u2069.`],
      },
    ],
  },
};
