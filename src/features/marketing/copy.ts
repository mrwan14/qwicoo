import { defineDictionary } from "@/lib/i18n/dictionary";

export const SURFACE_KEYS = ["guest", "pos", "kds", "owner"] as const;
export const FEATURE_KEYS = ["qr", "pos", "kds", "floor", "payments", "pickup", "analytics", "staff"] as const;

export type SurfaceKey = (typeof SURFACE_KEYS)[number];
export type FeatureKey = (typeof FEATURE_KEYS)[number];

type Entry = { title: string; body: string };

type LandingCopy = {
  meta: { title: string; description: string };
  nav: { features: string; partner: string; signIn: string; language: string; languageLabel: string };
  hero: { badge: string; title: string; body: string; primary: string; secondary: string };
  demo: {
    table: string;
    status: string;
    items: string[];
    station: string;
    elapsed: string;
    bump: string;
    paid: string;
    total: string;
  };
  surfaces: { eyebrow: string; items: Record<SurfaceKey, Entry> };
  problems: { eyebrow: string; title: string; fixLabel: string; items: (Entry & { fix: string })[] };
  features: { eyebrow: string; title: string; items: Record<FeatureKey, Entry> };
  steps: { eyebrow: string; title: string; body: string; stepLabel: string; items: Entry[]; cta: string; note: string };
  assistant: {
    launcher: string;
    disclaimer: string;
    becomePartner: string;
    close: string;
    starters: { capabilities: string; qr: string; arabic: string; start: string; partner: string };
  };
  lead: {
    name: string;
    restaurant: string;
    contact: string;
    city: string;
    branches: string;
    message: string;
    submit: string;
    sending: string;
    thanksTitle: string;
    thanksBody: string;
    failed: string;
  };
  footer: { rights: string; dashboard: string; signInLabel: string };
};

const landingEn = {
    meta: {
      title: "Qwicoo · Run your restaurant from the table to the kitchen",
      description:
        "Qwicoo gives restaurants QR table ordering, POS, kitchen displays, floor management, payments, and analytics in one system.",
    },
    nav: {
      features: "Features",
      partner: "Become a partner",
      signIn: "Restaurant sign in",
      language: "العربية",
      languageLabel: "Switch to Arabic",
    },
    hero: {
      badge: "One system for the table, the kitchen, and the back office",
      title: "Orders for the floor, the kitchen, and the table.",
      body: "Qwicoo is an operating system for restaurants. Guests order from a QR at the table, the kitchen sees every ticket on a screen, cashiers close out a clean drawer, and owners see every branch from one dashboard.",
      primary: "Become a partner",
      secondary: "See how it works",
    },
    demo: {
      table: "Table 12",
      status: "Ordered",
      items: ["2× Mixed grill", "1× Lentil soup", "1× Mint lemonade"],
      station: "Grill station",
      elapsed: "02:14",
      bump: "Bump",
      paid: "Paid · cash",
      total: "Total",
    },
    surfaces: {
      eyebrow: "Four screens, one system",
      items: {
        guest: { title: "Guest phone", body: "Scan, order, pay" },
        pos: { title: "Cashier POS", body: "Tickets and drawer" },
        kds: { title: "Kitchen display", body: "Stations and expo" },
        owner: { title: "Owner dashboard", body: "Every branch, live" },
      },
    },
    problems: {
      eyebrow: "Restaurant problems, and how we solve them",
      title: "The day-to-day problems we built Qwicoo for",
      fixLabel: "With Qwicoo",
      items: [
        {
          title: "Guests wait to order and wait to pay",
          body: "Waiters are the bottleneck. Tables sit idle between the first look at the menu and the first ticket in the kitchen.",
          fix: "Guests scan the table QR, order from their phone, and pay when they are ready. Your team serves instead of transcribing.",
        },
        {
          title: "The kitchen works from paper and shouting",
          body: "Tickets get lost, modifiers get missed, and nobody knows what is late until a guest asks.",
          fix: "Every order lands on a station display with its modifiers and notes. Expo sees the whole pass and bumps it out.",
        },
        {
          title: "Menus drift between branches",
          body: "One branch is out of an item, another changed a price, and the printed menu says something else.",
          fix: "One menu per brand with per-branch prices and 86 lists. Change it once and every QR and POS updates.",
        },
        {
          title: "Owners find out about problems a month later",
          body: "Cash drawers, attendance, and sales live in different notebooks and spreadsheets.",
          fix: "Drawer and Z reports, attendance, payments, and sales analytics per brand and per branch, in one place.",
        },
      ],
    },
    features: {
      eyebrow: "Features",
      title: "Everything a branch needs, in one system",
      items: {
        qr: {
          title: "QR table ordering",
          body: "Table presence by location or PIN, a shared table cart, bilingual menus, and live order tracking.",
        },
        pos: {
          title: "Point of sale",
          body: "Fast ticket building with price validation, modifiers, checkout, and cancellations.",
        },
        kds: {
          title: "Kitchen display and expo",
          body: "Station tickets with bump buttons sized for a busy line, plus a pass view for expo.",
        },
        floor: {
          title: "Floor and service requests",
          body: "Live table states and a queue of guest requests for waiters and runners.",
        },
        payments: {
          title: "Payments and cash control",
          body: "Cash and online payments, pending payment approvals, drawer sessions, and Z reports.",
        },
        pickup: {
          title: "Drive-thru and delivery",
          body: "Pickup orders with vehicle details and delivery fees by governorate and zone.",
        },
        analytics: { title: "Analytics", body: "Dashboards for sales, menu performance, and branch comparison." },
        staff: {
          title: "Staff and attendance",
          body: "Role-based accounts, check-in and check-out logs, and an audit trail.",
        },
      },
    },
    steps: {
      eyebrow: "Become a partner",
      title: "Bring your restaurant onto Qwicoo",
      body: "We onboard brands one branch at a time. You keep your menu, your prices, and your staff. We handle the setup.",
      stepLabel: "Step",
      items: [
        { title: "Tell us about your brand", body: "Number of branches, table count, and the menu you run today." },
        {
          title: "We set up your workspace",
          body: "Brand, branches, tables with QR codes, menu, and staff accounts.",
        },
        {
          title: "Go live in a branch",
          body: "Start with one branch, then roll out to the rest with the same menu and settings.",
        },
      ],
      cta: "Talk to us",
      note: "Already a partner? Sign in below.",
    },
    assistant: {
      launcher: "Questions about Qwicoo?",
      disclaimer: "Answers are about Qwicoo only. Please don't share personal details here.",
      becomePartner: "Become a partner",
      close: "Close",
      starters: {
        capabilities: "What can Qwicoo do for my restaurant?",
        qr: "How does QR ordering work?",
        arabic: "Does it work in Arabic?",
        start: "What do I need to get started?",
        partner: "How do I become a partner?",
      },
    },
    lead: {
      name: "Name",
      restaurant: "Restaurant name",
      contact: "Phone or email",
      city: "City",
      branches: "Number of branches",
      message: "Message",
      submit: "Send",
      sending: "Sending…",
      thanksTitle: "Thank you",
      thanksBody: "We received your note and will be in touch about bringing your restaurant onto Qwicoo.",
      failed: "We couldn't send that. Try again.",
    },
    footer: {
      rights: "All rights reserved",
      dashboard: "Sign in",
      signInLabel: "Sign in",
    },
} satisfies LandingCopy;

const landingAr = {
    meta: {
      title: "Qwicoo · شغّل مطعمك من الطاولة إلى المطبخ",
      description:
        "يمنح Qwicoo المطاعم الطلب من الطاولة برمز QR، ونقطة بيع، وشاشات مطبخ، وإدارة صالة، ومدفوعات، وتحليلات في نظام واحد.",
    },
    nav: {
      features: "المزايا",
      partner: "انضم كشريك",
      signIn: "دخول المطاعم",
      language: "English",
      languageLabel: "التبديل إلى الإنجليزية",
    },
    hero: {
      badge: "نظام واحد للطاولة والمطبخ والإدارة",
      title: "الطلبات من الطاولة إلى المطبخ إلى الكاشير.",
      body: "Qwicoo نظام تشغيل للمطاعم. يطلب الضيف من رمز QR على الطاولة، ويرى المطبخ كل تذكرة على شاشته، ويغلق الكاشير دُرجاً نظيفاً، ويتابع المالك كل فرع من لوحة واحدة.",
      primary: "انضم كشريك",
      secondary: "شاهد كيف يعمل",
    },
    demo: {
      table: "طاولة ١٢",
      status: "تم الطلب",
      items: ["٢× مشاوي مشكلة", "١× شوربة عدس", "١× ليمون بالنعنع"],
      station: "قسم المشاوي",
      elapsed: "٠٢:١٤",
      bump: "تم التجهيز",
      paid: "مدفوع · نقداً",
      total: "المجموع",
    },
    surfaces: {
      eyebrow: "أربع شاشات، نظام واحد",
      items: {
        guest: { title: "هاتف الضيف", body: "مسح، طلب، دفع" },
        pos: { title: "نقطة البيع", body: "التذاكر والدُرج" },
        kds: { title: "شاشة المطبخ", body: "الأقسام والتجهيز" },
        owner: { title: "لوحة المالك", body: "كل الفروع مباشرة" },
      },
    },
    problems: {
      eyebrow: "مشكلات المطاعم، وكيف نحلها",
      title: "المشكلات اليومية التي بنينا Qwicoo من أجلها",
      fixLabel: "مع Qwicoo",
      items: [
        {
          title: "الضيف ينتظر ليطلب وينتظر ليدفع",
          body: "الويتر هو عنق الزجاجة، وتبقى الطاولة معطلة بين أول نظرة على المنيو وأول تذكرة في المطبخ.",
          fix: "يمسح الضيف رمز الطاولة، ويطلب من هاتفه، ويدفع حين يجهز. فريقك يخدم بدلاً من أن ينقل الطلبات.",
        },
        {
          title: "المطبخ يعمل بالورق والصوت العالي",
          body: "تذاكر تُفقد، وإضافات تُنسى، ولا أحد يعرف ما تأخر حتى يسأل الضيف.",
          fix: "كل طلب يظهر على شاشة القسم مع إضافاته وملاحظاته، والتجهيز يرى الممر كاملاً ويُخرج الطلب.",
        },
        {
          title: "المنيو يختلف بين الفروع",
          body: "فرع نفد منه صنف، وفرع غيّر السعر، والمنيو المطبوع يقول شيئاً آخر.",
          fix: "منيو واحد للعلامة مع أسعار لكل فرع وقوائم نفاد. تعدّله مرة واحدة فتتحدث كل رموز QR ونقاط البيع.",
        },
        {
          title: "المالك يعرف بالمشكلة بعد شهر",
          body: "الدُرج والحضور والمبيعات في دفاتر وجداول متفرقة.",
          fix: "تقارير الدُرج وتقارير Z، والحضور، والمدفوعات، وتحليلات المبيعات لكل علامة وفرع في مكان واحد.",
        },
      ],
    },
    features: {
      eyebrow: "المزايا",
      title: "كل ما يحتاجه الفرع في نظام واحد",
      items: {
        qr: {
          title: "الطلب من الطاولة برمز QR",
          body: "تحديد الطاولة بالموقع أو بالرمز السري، وسلة مشتركة للطاولة، ومنيو بلغتين، وتتبع مباشر للطلب.",
        },
        pos: {
          title: "نقطة البيع",
          body: "بناء سريع للتذاكر مع التحقق من السعر، والإضافات، والدفع، والإلغاء.",
        },
        kds: {
          title: "شاشة المطبخ والتجهيز",
          body: "تذاكر لكل قسم بأزرار كبيرة تناسب ضغط العمل، مع شاشة ممر للتجهيز.",
        },
        floor: {
          title: "الصالة وطلبات الخدمة",
          body: "حالات الطاولات مباشرة، وقائمة بطلبات الضيوف للويتر والرانر.",
        },
        payments: {
          title: "المدفوعات وضبط النقد",
          body: "دفع نقدي وإلكتروني، واعتماد المدفوعات المعلقة، وجلسات الدُرج، وتقارير Z.",
        },
        pickup: {
          title: "السيارة والتوصيل",
          body: "طلبات الاستلام مع بيانات السيارة، ورسوم توصيل حسب المحافظة والمنطقة.",
        },
        analytics: { title: "التحليلات", body: "لوحات للمبيعات وأداء المنيو ومقارنة الفروع." },
        staff: {
          title: "الفريق والحضور",
          body: "حسابات بصلاحيات محددة، وسجل حضور وانصراف، وسجل تدقيق.",
        },
      },
    },
    steps: {
      eyebrow: "انضم كشريك",
      title: "اجعل مطعمك على Qwicoo",
      body: "نضم العلامات فرعاً بعد فرع. تبقى لك قائمتك وأسعارك وفريقك، ونحن نتولى التجهيز.",
      stepLabel: "خطوة",
      items: [
        { title: "عرّفنا على علامتك", body: "عدد الفروع، وعدد الطاولات، والمنيو الذي تعمل به اليوم." },
        { title: "نجهّز مساحة عملك", body: "العلامة، والفروع، والطاولات مع رموز QR، والمنيو، وحسابات الفريق." },
        { title: "ابدأ في فرع واحد", body: "ابدأ بفرع واحد، ثم وسّع لبقية الفروع بنفس المنيو والإعدادات." },
      ],
      cta: "تحدث إلينا",
      note: "شريك بالفعل؟ سجّل الدخول من الأسفل.",
    },
    assistant: {
      launcher: "أسئلة عن كويكو؟",
      disclaimer: "الإجابات عن كويكو فقط. يرجى عدم مشاركة بيانات شخصية هنا.",
      becomePartner: "كن شريكاً",
      close: "إغلاق",
      starters: {
        capabilities: "ماذا يمكن أن يقدمه كويكو لمطعمي؟",
        qr: "كيف يعمل الطلب برمز QR؟",
        arabic: "هل يعمل بالعربية؟",
        start: "ماذا أحتاج للبدء؟",
        partner: "كيف أصبح شريكاً؟",
      },
    },
    lead: {
      name: "الاسم",
      restaurant: "اسم المطعم",
      contact: "هاتف أو بريد",
      city: "المدينة",
      branches: "عدد الفروع",
      message: "الرسالة",
      submit: "إرسال",
      sending: "جارٍ الإرسال…",
      thanksTitle: "شكراً لك",
      thanksBody: "وصلَتنا رسالتك، وسنتواصل معك بشأن انضمام مطعمك إلى كويكو.",
      failed: "تعذّر الإرسال. حاول مرة أخرى.",
    },
    footer: {
      rights: "جميع الحقوق محفوظة",
      dashboard: "تسجيل الدخول",
      signInLabel: "تسجيل الدخول",
    },
} satisfies LandingCopy;

export const landingCopy = defineDictionary(landingEn, landingAr);
