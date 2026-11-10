import { defineDictionary } from "@/lib/i18n/dictionary";

export const SURFACE_KEYS = ["guest", "pos", "kds", "owner"] as const;
export const FEATURE_KEYS = ["qr", "pos", "kds", "floor", "payments", "pickup", "analytics", "staff"] as const;

export type SurfaceKey = (typeof SURFACE_KEYS)[number];
export type FeatureKey = (typeof FEATURE_KEYS)[number];

type Entry = { title: string; body: string };
type Chip = { label: string; detail: string };
type Ticket = { heading: string; badge: string; item: string };
type Dish = { name: string; detail: string; price: string };
type StoryFrame = { tab: string; kicker: string; title: string; body: string; stat: string; statNote: string };
type StartStep = { title: string; body: string; lines: string[] };
type Priced = { name: string; price: string };
type KitchenTicket = { code: string; item: string };
type PriceTier = { name: string; price: string; note: string };

export const BACK_OFFICE_KEYS = ["stock", "purchasing", "attendance", "reports", "delivery", "brands"] as const;
export type BackOfficeKey = (typeof BACK_OFFICE_KEYS)[number];

export const FLOW_KEYS = ["guest", "kitchen", "expo", "owner", "floor", "pay", "pos", "drive"] as const;
export type FlowKey = (typeof FLOW_KEYS)[number];

type LandingCopy = {
  meta: { title: string; description: string };
  nav: {
    offer: string;
    flow: string;
    start: string;
    partners: string;
    features: string;
    backOffice: string;
    pricing: string;
    faq: string;
    partner: string;
    signIn: string;
    language: string;
    languageLabel: string;
    menu: string;
    close: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    primary: string;
    whatsapp: string;
    ask: string;
    signals: { devices: string; languages: string; commission: string; setup: string };
    chips: { newOrder: Chip; ready: Chip; paid: Chip; grill: Chip };
    tickets: { drive: Ticket; table7: Ticket; table12: Ticket; qr: Ticket; pos: Ticket; pickup: Ticket; table9: Ticket };
  };
  scan: {
    ghost: string;
    left: string;
    right: string;
    place: string;
    menu: string;
    categories: { grill: string; soups: string; drinks: string; dessert: string };
    dishes: { grill: Dish; soup: Dish; drink: Dish; dessert: Dish };
    cart: string;
    total: string;
    bubbles: { order: Chip; waiter: Chip; ready: Chip; paid: Chip };
    caption: string;
  };
  offer: {
    eyebrow: string;
    title: string;
    body: string;
    sample: string;
    qr: Entry & { tag: string; scan: string };
    pos: Entry & { tag: string; a: string; b: string; charge: string };
    kds: Entry & { tag: string; a: string; b: string; c: string };
    floor: Entry & { tag: string };
    drive: Entry & { tag: string; lane1: string; car: string; lane2: string; pickup: string };
    pay: Entry & { tag: string; amount: string };
    analytics: Entry & { tag: string };
    ask: Entry & { tag: string; question: string; lead: string; figure: string; summary: string; source: string };
    menu: Entry & { tag: string; item: string; price: string; soldName: string; sold: string };
    offline: Entry & { tag: string; status: string };
    lang: Entry & { tag: string; mark: string };
  };
  flowHub: {
    eyebrow: string;
    title: string;
    body: string;
    order: string;
    meta: string;
    nodes: Record<FlowKey, Chip>;
  };
  story: {
    guest: StoryFrame;
    cashier: StoryFrame;
    kitchen: StoryFrame;
    owner: StoryFrame;
    cashierItems: Priced[];
    cashierTotal: string;
    cashierMethods: string;
    kitchenNew: string;
    kitchenCook: string;
    kitchenReady: string;
    kitchenTickets: KitchenTicket[];
    ownerSample: string;
    ownerSalesLabel: string;
    ownerSales: string;
    ownerOrdersLabel: string;
    ownerOrders: string;
  };
  start: {
    ghost: string;
    eyebrow: string;
    title: string;
    body: string;
    talk: StartStep;
    setup: StartStep;
    print: StartStep;
    live: StartStep;
  };
  cta: {
    title: string;
    placeholder: string;
    button: string;
    branch: string;
    menu: string;
    languages: string;
  };
  partner: {
    eyebrow: string;
    title: string;
    body: string;
    askEyebrow: string;
    askTitle: string;
    askBody: string;
    askOpen: string;
    talkTitle: string;
    talkBody: string;
    whatsapp: string;
    call: string;
    email: string;
    waMessage: string;
  };
  backOffice: { eyebrow: string; title: string; body: string; items: Record<BackOfficeKey, Entry & { tag: string }> };
  pricing: {
    eyebrow: string;
    title: string;
    body: string;
    currency: string;
    tiers: PriceTier[];
    popular: string;
    includesTitle: string;
    includes: string[];
    terms: string[];
    founding: { badge: string; title: string; body: string; cta: string; limited: string };
    cta: string;
  };
  faq: { eyebrow: string; title: string; items: { q: string; a: string }[] };
  surfaces: { eyebrow: string; items: Record<SurfaceKey, Entry> };
  problems: { eyebrow: string; title: string; fixLabel: string; items: (Entry & { fix: string })[] };
  features: { eyebrow: string; title: string; items: Record<FeatureKey, Entry> };
  steps: { eyebrow: string; title: string; body: string; stepLabel: string; items: Entry[]; cta: string; note: string };
  assistant: {
    launcher: string;
    launcherShort: string;
    status: string;
    greeting: string;
    greetingBody: string;
    tryAsking: string;
    newChat: string;
    nudge: string;
    nudgeDismiss: string;
    demoTitle: string;
    demoBody: string;
    moreQuestions: string;
    disclaimer: string;
    becomePartner: string;
    close: string;
    starters: { capabilities: string; pricing: string; qr: string; arabic: string; start: string; partner: string };
  };
  lead: {
    name: string;
    restaurant: string;
    contact: string;
    city: string;
    branches: string;
    message: string;
    promo: string;
    submit: string;
    sending: string;
    thanksTitle: string;
    thanksBody: string;
    failed: string;
    privacyNote: string;
    privacyLink: string;
    errors: Record<"name" | "restaurant" | "contact" | "city" | "branches" | "message", string>;
  };
  footer: {
    rights: string;
    dashboard: string;
    signInLabel: string;
    blurb: string;
    made: string;
    product: string;
    company: string;
    language: string;
    qr: string;
    pos: string;
    kitchen: string;
    drive: string;
    contact: string;
    backOffice: string;
    pricing: string;
    faq: string;
    privacy: string;
    terms: string;
    whatsapp: string;
  };
};

const landingEn = {
    meta: {
      title: "Qwicoo — Restaurant POS, QR ordering and kitchen screens in Egypt",
      description: "Qwicoo is one system for table QR ordering, your POS, kitchen screens, stock and reports — in Arabic and English. From EGP 4,000 per branch per month."
    },
    nav: {
      offer: "Features",
      flow: "How orders flow",
      start: "How to start",
      partners: "Partners",
      features: "Features",
      backOffice: "Back office",
      pricing: "Pricing",
      faq: "FAQ",
      partner: "Book a free demo",
      signIn: "Sign in",
      language: "العربية",
      languageLabel: "Switch to Arabic",
      menu: "Menu",
      close: "Close menu"
    },
    hero: {
      eyebrow: "The restaurant system built for Egypt",
      title: "Take orders faster. Waste less. See every branch from your phone.",
      subtitle: "Qwicoo is one system for table QR ordering, your POS, kitchen screens, stock and reports — in Arabic and English.",
      primary: "Book a free demo",
      whatsapp: "WhatsApp us",
      ask: "Ask Qwicoo a question",
      signals: {
        devices: "Works on the devices you have",
        languages: "English · العربية",
        commission: "0% commission on card payments",
        setup: "Free setup"
      },
      chips: {
        newOrder: { label: "New QR order", detail: "Table 7" },
        ready: { label: "#128 · Table 12", detail: "ready" },
        paid: { label: "EGP 455.00", detail: "paid · card" },
        grill: { label: "Grill station", detail: "cooking · 4:12" },
      },
      tickets: {
        drive: { heading: "#131 · Drive-thru", badge: "New", item: "2× Shawarma wrap" },
        table7: { heading: "#130 · Table 7", badge: "4:12", item: "1× Mixed grill" },
        table12: { heading: "#128 · Table 12", badge: "Ready", item: "2× Mint lemonade" },
        qr: { heading: "#132 · QR Table 3", badge: "New", item: "1× Koshary large" },
        pos: { heading: "#127 · POS", badge: "7:40", item: "2× Feteer" },
        pickup: { heading: "#126 · Pickup", badge: "Ready", item: "3× Turkish coffee" },
        table9: { heading: "#133 · Table 9", badge: "New", item: "1× Om Ali" },
      },
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
    scan: {
      ghost: "QR",
      left: "Scan.",
      right: "Order.",
      place: "Mousa Cafe · Tagamoa · Table 12",
      menu: "Menu",
      categories: { grill: "Grill", soups: "Soups", drinks: "Drinks", dessert: "Dessert" },
      dishes: {
        grill: { name: "Mixed grill", detail: "Kofta, shish tawook, rice", price: "EGP 185" },
        soup: { name: "Lentil soup", detail: "Lemon, crispy bread", price: "EGP 45" },
        drink: { name: "Mint lemonade", detail: "Fresh, crushed ice", price: "EGP 40" },
        dessert: { name: "Om Ali", detail: "Warm, nuts, cream", price: "EGP 60" },
      },
      cart: "3 items · View order",
      total: "EGP 270",
      bubbles: {
        order: { label: "New order · Table 12", detail: "2× Mixed grill, 1× Lentil soup" },
        waiter: { label: "Waiter called · Table 7", detail: "“Can we get more bread?”" },
        ready: { label: "Order #128 is ready", detail: "Your runner is on the way" },
        paid: { label: "Bill paid · EGP 455.00", detail: "Card · Table 12" },
      },
      caption:
        "No app to install. The table QR opens your menu in Arabic or English, keeps a shared cart for the table and shows the order's status live.",
    },
    offer: {
      eyebrow: "What Qwicoo offers",
      title: "Everything a restaurant runs on.",
      body: "Eleven parts that share one menu, one order and one drawer — from the first scan to the Z report.",
      sample: "Sample figures",
      qr: {
        tag: "Guests",
        title: "Table QR ordering",
        body: "Scan, browse a bilingual menu, order and pay from your own phone. Shared table cart and live status.",
        scan: "Scan.\nOrder.\nPay.",
      },
      pos: {
        tag: "Cashier",
        title: "Staff POS",
        body: "Fast tickets with modifiers, discounts and split payments.",
        a: "Shawarma ×2",
        b: "Coffee ×2",
        charge: "Charge EGP 170.00",
      },
      kds: {
        tag: "Kitchen & expo",
        title: "KDS + Expo",
        body: "Station tickets with timers and bump buttons; expo sees the whole pass.",
        a: "#131 0:15",
        b: "#130 4:12",
        c: "#128 ready",
      },
      floor: {
        tag: "Floor",
        title: "Floor & tables",
        body: "Live table states and guest calls for waiters and runners.",
      },
      drive: {
        tag: "Drive-thru",
        title: "Drive-thru & pickup",
        body: "Car details and lanes on the ticket; delivery fees by zone.",
        lane1: "Lane 1",
        car: "White Hyundai · 4821",
        lane2: "Lane 2",
        pickup: "Pickup #126",
      },
      pay: {
        tag: "Cashier",
        title: "Payments & cash drawer",
        body: "Cash, card and wallets in EGP. Drawer sessions, hand-overs and Z reports.",
        amount: "EGP 455.00",
      },
      analytics: {
        tag: "Owners",
        title: "Multi-branch analytics",
        body: "Sales by hour, top items and branch comparison — in Cairo time.",
      },
      ask: {
        tag: "Admins",
        title: "Ask Qwicoo",
        body: "Ask about your own branch in plain English or Arabic. Read-only, scoped to your role.",
        question: "What were today's sales at Tagamoa?",
        lead: "Gross sales today:",
        figure: "EGP 9,340.00",
        summary: "across 112 orders.",
        source: "Source: Analytics",
      },
      menu: {
        tag: "Admins",
        title: "Menu management",
        body: "One brand menu, branch prices and sold-out lists that update every QR and till.",
        item: "Mixed grill",
        price: "EGP 185",
        soldName: "Om Ali",
        sold: "Sold out",
      },
      offline: {
        tag: "Cashier",
        title: "Offline till",
        body: "Keep taking orders when the internet drops. Orders sync safely when it's back.",
        status: "Offline · 3 orders queued",
      },
      lang: {
        tag: "Everyone",
        title: "English / Arabic",
        body: "Every screen in both languages, with full right-to-left layout.",
        mark: "EN / ع",
      },
    },
    flowHub: {
      eyebrow: "One order, every screen",
      title: "Order #128 goes everywhere at once.",
      body: "The moment a guest taps “Order”, the kitchen, expo, floor, cashier and owner all see it — and its status moves from new to cooking to ready on every screen.",
      order: "Order #128",
      meta: "Table 12 · EGP 455.00",
      nodes: {
        guest: { label: "Guest phone", detail: "Ordered from table QR" },
        kitchen: { label: "Kitchen display", detail: "Grill · cooking 4:12" },
        expo: { label: "Expo", detail: "Plates complete · send" },
        owner: { label: "Owner dashboard", detail: "Sales update live" },
        floor: { label: "Floor & runners", detail: "Runner Karim · Table 12" },
        pay: { label: "Payments & drawer", detail: "Paid by card · drawer 2" },
        pos: { label: "Staff POS", detail: "Visible to cashier" },
        drive: { label: "Drive-thru", detail: "Same flow for lanes" },
      },
    },
    story: {
      guest: {
        tab: "Guest",
        kicker: "01 Guest",
        title: "Order from the table.",
        body: "The table QR opens the menu in Arabic or English. Guests order, call a waiter or ask for the bill.",
        stat: "0 apps",
        statNote: "to install for guests",
      },
      cashier: {
        tab: "Cashier",
        kicker: "02 Cashier",
        title: "A till that keeps up.",
        body: "Quick tickets, split payments in EGP, and a drawer that balances at every hand-over.",
        stat: "Offline",
        statNote: "keeps taking orders, syncs later",
      },
      kitchen: {
        tab: "Kitchen",
        kicker: "03 Kitchen",
        title: "Every ticket on the line.",
        body: "QR, POS and drive-thru tickets arrive on the station screen with timers. Expo bumps them out.",
        stat: "3 states",
        statNote: "new · cooking · ready",
      },
      owner: {
        tab: "Owner",
        kicker: "04 Owner",
        title: "Every branch, live.",
        body: "Sales, orders and drawers for each branch — and Ask Qwicoo for the figure you need.",
        stat: "1 view",
        statNote: "for every branch",
      },
      cashierItems: [
        { name: "Feteer", price: "EGP 45" },
        { name: "Shawarma", price: "EGP 70" },
        { name: "Koshary", price: "EGP 55" },
      ],
      cashierTotal: "EGP 170",
      cashierMethods: "Cash · Card · Wallet",
      kitchenNew: "New",
      kitchenCook: "Cooking",
      kitchenReady: "Ready",
      kitchenTickets: [
        { code: "#140 · Table 4", item: "1× Grill mix" },
        { code: "#128 · Table 12", item: "2× Molokhia" },
        { code: "#133 · Pickup", item: "1× Om Ali" },
      ],
      ownerSample: "Sample figures",
      ownerSalesLabel: "Sales",
      ownerSales: "EGP 18,420",
      ownerOrdersLabel: "Orders",
      ownerOrders: "86",
    },
    start: {
      ghost: "Start",
      eyebrow: "How to start",
      title: "Four steps to your first ticket.",
      body: "We onboard one branch at a time. You keep your menu, your prices and your team.",
      talk: {
        title: "Talk to us",
        body: "Tell us about your brand: branches, tables, service types and the menu you use today. Ask Qwicoo can answer the first questions right away.",
        lines: [
          "We have 3 branches and a drive-thru in Tagamoa.",
          "Great — send us your current menu and table counts, and we'll prepare a demo branch.",
        ],
      },
      setup: {
        title: "We set up your menu & branches",
        body: "We build your menu in Arabic and English, set branch prices, kitchen stations, drawers and staff roles.",
        lines: [
          "Menu · 64 items · AR/EN · Done",
          "Branch prices · 3 branches · Done",
          "Stations · Grill · Cold · Bar · Done",
          "Staff roles · 18 accounts · In progress",
        ],
      },
      print: {
        title: "Print table QRs",
        body: "Every table gets its own QR. Guests scan, order, and call a waiter. You print the sheet we prepare.",
        lines: ["Table 1", "Table 2", "Table 3"],
      },
      live: {
        title: "Go live",
        body: "Start in one branch with a short session per role — cashier, kitchen, runners — then roll out the rest.",
        lines: ["Live", "First ticket", "#001 · Table 4", "Ready", "2× Turkish coffee"],
      },
    },
    cta: {
      title: "Bring your restaurant onto Qwicoo.",
      placeholder: "Restaurant name",
      button: "Book a demo",
      branch: "One branch at a time",
      menu: "Your menu, your prices",
      languages: "English and Arabic",
    },
    partner: {
      eyebrow: "Free demo",
      title: "Book your free demo.",
      body: "Tell us about your restaurant. We reply within one working day and set up a demo branch with your own menu.",
      askEyebrow: "Not ready yet?",
      askTitle: "Ask Qwicoo.",
      askBody: "Features, prices, onboarding, Arabic menus — answered now, only about Qwicoo.",
      askOpen: "Start a chat",
      talkTitle: "Prefer to talk?",
      talkBody: "Message us on WhatsApp, call, or email. We reply within one working day.",
      whatsapp: "WhatsApp",
      call: "Call",
      email: "Email",
      waMessage: "Hi Qwicoo, I'd like a free demo for my restaurant."
    },
    backOffice: {
      eyebrow: "Behind the counter",
      title: "The back office runs on the same system.",
      body: "Stock, staff, delivery and the numbers share the same menu and the same orders — so you see food cost, cash and hours without spreadsheets.",
      items: {
        stock: {
          tag: "Stock",
          title: "Stock & food cost",
          body: "Ingredients, recipes, prep batches, stock counts and waste — plus transfers between branches and a central kitchen."
        },
        purchasing: {
          tag: "Purchasing",
          title: "Suppliers & purchase orders",
          body: "Order from your suppliers, receive into stock, and see what each branch used."
        },
        attendance: {
          tag: "Staff",
          title: "Attendance & shifts",
          body: "Check in with a PIN on the till, plan each person's usual shift, and correct timesheets as a manager."
        },
        reports: {
          tag: "Reports",
          title: "Reports that add up",
          body: "Sales, items, branches, payments, taxes, channels and discounts — compared with last week or last month, and exported to CSV."
        },
        delivery: {
          tag: "Delivery",
          title: "Your own drivers",
          body: "A delivery board from “waiting for driver” to “delivered”, with fees by governorate and zone."
        },
        brands: {
          tag: "Owners",
          title: "Many branches, many brands",
          body: "Roles for every level — branch, region and brand — and an audit log of who changed what."
        }
      }
    },
    pricing: {
      eyebrow: "Pricing",
      title: "One plan. Every feature. Priced per branch.",
      body: "Prices in EGP per branch per month, excluding 14% VAT. Setup, menu entry and staff training are free.",
      currency: "EGP",
      tiers: [
        {
          name: "1 branch",
          price: "4,000",
          note: "per branch / month"
        },
        {
          name: "2–4 branches",
          price: "3,600",
          note: "per branch / month · save 10%"
        },
        {
          name: "5–9 branches",
          price: "3,200",
          note: "per branch / month · save 20%"
        },
        {
          name: "10+ branches",
          price: "Custom",
          note: "Talk to us for a group price"
        }
      ],
      popular: "Most chains",
      includesTitle: "Every plan includes",
      includes: [
        "Table QR ordering and guest payments",
        "POS, offline till and cash drawer",
        "Kitchen display and expo",
        "Stock, recipes and purchasing",
        "Attendance and shifts",
        "Reports and CSV export",
        "Ask Qwicoo for managers",
        "Arabic and English"
      ],
      terms: [
        "Pay yearly and get 2 months free",
        "No commission on card payments — only Paymob's own fees",
        "Monthly billing, cancel anytime",
        "Your data is yours to export"
      ],
      founding: {
        badge: "Founding Partners",
        title: "The first 20 restaurants get 3 months free.",
        body: "After that you keep 20% off for life, in return for your feedback and permission to share your story. Have a promo code? Add it to the demo form.",
        cta: "Claim a founding spot",
        limited: "Limited to the first 20 restaurants"
      },
      cta: "Book a free demo"
    },
    faq: {
      eyebrow: "FAQ",
      title: "Questions owners ask us.",
      items: [
        {
          q: "What devices do I need?",
          a: "The tablets, phones and computers you already have, with a modern browser. A receipt printer is optional. We don't sell hardware and don't tie you to a brand."
        },
        {
          q: "What happens if the internet goes down?",
          a: "The till keeps taking cash orders for takeaway and dine-in. They sync when the connection is back, and a manager reviews anything that needs a second look."
        },
        {
          q: "Do guests need to install an app?",
          a: "No. Guests scan the table QR and the menu opens in their phone's browser, in Arabic or English."
        },
        {
          q: "How do card payments work?",
          a: "Guests and cashiers can pay by card or wallet through your own Paymob account. The money goes to you, and Qwicoo takes no commission."
        },
        {
          q: "How long does setup take?",
          a: "We start with one branch: we enter your menu in both languages, prepare your table QR sheet and train each role in a short session. Then you roll out the other branches."
        },
        {
          q: "Is there a long contract?",
          a: "No. You pay monthly and can cancel at any time. Paying yearly gives you 2 months free."
        },
        {
          q: "Who owns my data?",
          a: "You do. Your reports export to CSV whenever you need them."
        },
        {
          q: "Can I run several branches or brands?",
          a: "Yes. One brand menu with branch prices, reports across branches, and roles for branch managers, regional managers and brand owners."
        }
      ]
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
      launcherShort: "Ask Qwicoo",
      status: "Answers in English or Arabic, right away",
      greeting: "Hi! What would you like to know about Qwicoo?",
      greetingBody: "Ask about table QR ordering, the cashier, kitchen screens, prices or getting started.",
      tryAsking: "Popular questions",
      newChat: "New chat",
      nudge: "Questions? Ask Qwicoo in English or Arabic.",
      nudgeDismiss: "Dismiss",
      demoTitle: "See it with your own menu",
      demoBody: "We reply within one working day and set up a demo branch with your menu.",
      moreQuestions: "More questions",
      disclaimer: "Answers are about Qwicoo only. Please don't share personal details here.",
      becomePartner: "Become a partner",
      close: "Close",
      starters: {
        capabilities: "What can Qwicoo do for my restaurant?",
        pricing: "How much does Qwicoo cost?",
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
      promo: "Promo code (optional)",
      privacyNote: "We use these details only to contact you about Qwicoo.",
      privacyLink: "Privacy policy",
      errors: {
        name: "Enter your name.",
        restaurant: "Enter the restaurant name.",
        contact: "Enter a phone number or an email.",
        city: "Enter your city.",
        branches: "Enter a number from 1 to 500.",
        message: "Keep the message under 1,000 characters."
      },
    },
    footer: {
      rights: "All rights reserved",
      dashboard: "Sign in",
      signInLabel: "Sign in",
      blurb: "The restaurant operating system for the table, the kitchen and the back office.",
      made: "Made in Cairo.",
      product: "Product",
      company: "Company",
      language: "Language",
      qr: "Table QR",
      pos: "POS & offline till",
      kitchen: "Kitchen & expo",
      drive: "Drive-thru",
      contact: "Contact",
      backOffice: "Back office",
      pricing: "Pricing",
      faq: "FAQ",
      privacy: "Privacy",
      terms: "Terms",
      whatsapp: "WhatsApp",
    },
} satisfies LandingCopy;

const landingAr = {
    meta: {
      title: "كويكو — كاشير وطلب QR وشاشات مطبخ للمطاعم في مصر",
      description: "كويكو نظام واحد لطلب الطاولات بالـQR والكاشير وشاشات المطبخ والمخزون والتقارير — بالعربي والإنجليزي. من 4,000 جنيه للفرع شهريًا."
    },
    nav: {
      offer: "المزايا",
      flow: "رحلة الطلب",
      start: "كيف تبدأ",
      partners: "الشركاء",
      features: "المزايا",
      backOffice: "الإدارة",
      pricing: "الأسعار",
      faq: "أسئلة شائعة",
      partner: "احجز عرضًا مجانيًا",
      signIn: "تسجيل الدخول",
      language: "English",
      languageLabel: "التبديل إلى الإنجليزية",
      menu: "القائمة",
      close: "إغلاق القائمة"
    },
    hero: {
      eyebrow: "نظام مطاعم مصمم لمصر",
      title: "طلبات أسرع. هدر أقل. وكل فروعك على موبايلك.",
      subtitle: "كويكو نظام واحد لطلب الطاولات بالـQR والكاشير وشاشات المطبخ والمخزون والتقارير — بالعربي والإنجليزي.",
      primary: "احجز عرضًا مجانيًا",
      whatsapp: "كلمنا واتساب",
      ask: "اسأل كويكو",
      signals: {
        devices: "يعمل على أجهزتك الحالية",
        languages: "العربية · English",
        commission: "0% عمولة على الدفع بالبطاقة",
        setup: "تجهيز مجاني"
      },
      chips: {
        newOrder: { label: "طلب QR جديد", detail: "طاولة 7" },
        ready: { label: "#128 · طاولة 12", detail: "جاهز" },
        paid: { label: "EGP 455.00", detail: "دُفع بالبطاقة" },
        grill: { label: "محطة الشواية", detail: "قيد التحضير · 4:12" },
      },
      tickets: {
        drive: { heading: "#131 · سيارة", badge: "جديد", item: "٢× ساندويتش شاورما" },
        table7: { heading: "#130 · طاولة 7", badge: "4:12", item: "١× مشويات مشكلة" },
        table12: { heading: "#128 · طاولة 12", badge: "جاهز", item: "٢× ليمون بالنعناع" },
        qr: { heading: "#132 · QR طاولة 3", badge: "جديد", item: "١× كشري كبير" },
        pos: { heading: "#127 · كاشير", badge: "7:40", item: "٢× فطير" },
        pickup: { heading: "#126 · استلام", badge: "جاهز", item: "٣× قهوة تركي" },
        table9: { heading: "#133 · طاولة 9", badge: "جديد", item: "١× أم علي" },
      },
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
      title: "المشكلات اليومية التي بنينا كويكو من أجلها",
      fixLabel: "مع كويكو",
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
    scan: {
      ghost: "QR",
      left: "امسح.",
      right: "اطلب.",
      place: "موسى كافيه · التجمع · طاولة 12",
      menu: "المنيو",
      categories: { grill: "مشويات", soups: "شوربة", drinks: "مشروبات", dessert: "حلويات" },
      dishes: {
        grill: { name: "مشويات مشكلة", detail: "كفتة، شيش طاووق، أرز", price: "EGP 185" },
        soup: { name: "شوربة عدس", detail: "ليمون، عيش محمص", price: "EGP 45" },
        drink: { name: "ليمون بالنعناع", detail: "فريش، ثلج مجروش", price: "EGP 40" },
        dessert: { name: "أم علي", detail: "ساخنة، مكسرات، قشطة", price: "EGP 60" },
      },
      cart: "٣ أصناف · عرض الطلب",
      total: "EGP 270",
      bubbles: {
        order: { label: "طلب جديد · طاولة 12", detail: "٢× مشويات، ١× شوربة عدس" },
        waiter: { label: "نداء نادل · طاولة 7", detail: "«ممكن عيش زيادة؟»" },
        ready: { label: "الطلب #128 جاهز", detail: "الرانر في الطريق" },
        paid: { label: "تم الدفع · EGP 455.00", detail: "بطاقة · طاولة 12" },
      },
      caption:
        "بدون تطبيق. رمز QR على الطاولة يفتح المنيو بالعربية أو الإنجليزية، مع سلة مشتركة للطاولة وحالة الطلب لحظة بلحظة.",
    },
    offer: {
      eyebrow: "ما يقدمه كويكو",
      title: "كل ما يدار به المطعم.",
      body: "أحد عشر جزءاً تشترك في منيو واحد وطلب واحد ودُرج واحد — من أول مسح حتى تقرير Z.",
      sample: "أرقام تجريبية",
      qr: {
        tag: "الضيوف",
        title: "الطلب من الطاولة برمز QR",
        body: "امسح، تصفّح منيو بلغتين، واطلب وادفع من هاتفك. سلة مشتركة للطاولة وحالة مباشرة.",
        scan: "امسح.\nاطلب.\nادفع.",
      },
      pos: {
        tag: "الكاشير",
        title: "نقطة البيع",
        body: "تذاكر سريعة مع الإضافات والخصومات وتقسيم الدفع.",
        a: "شاورما ×2",
        b: "قهوة ×2",
        charge: "تحصيل EGP 170.00",
      },
      kds: {
        tag: "المطبخ والتجميع",
        title: "شاشة المطبخ والتجميع",
        body: "تذاكر المحطات مع مؤقتات وأزرار إنهاء، وشاشة التجميع ترى الممر كله.",
        a: "#131 0:15",
        b: "#130 4:12",
        c: "#128 جاهز",
      },
      floor: {
        tag: "الصالة",
        title: "الصالة والطاولات",
        body: "حالات الطاولات مباشرة ونداءات الضيوف للنادل والرانر.",
      },
      drive: {
        tag: "الدرايف ثرو",
        title: "الدرايف ثرو والاستلام",
        body: "بيانات السيارة والمسار على التذكرة، ورسوم التوصيل حسب المنطقة.",
        lane1: "مسار 1",
        car: "هيونداي بيضاء · 4821",
        lane2: "مسار 2",
        pickup: "استلام #126",
      },
      pay: {
        tag: "الكاشير",
        title: "المدفوعات ودُرج النقد",
        body: "نقد وبطاقة ومحافظ بالجنيه. جلسات الدُرج والتسليم وتقارير Z.",
        amount: "EGP 455.00",
      },
      analytics: {
        tag: "الملاك",
        title: "تحليلات الفروع",
        body: "المبيعات بالساعة وأفضل الأصناف ومقارنة الفروع — بتوقيت القاهرة.",
      },
      ask: {
        tag: "الإدارة",
        title: "اسأل كويكو",
        body: "اسأل عن فرعك بالإنجليزية أو العربية. للقراءة فقط، وفي حدود صلاحيتك.",
        question: "كم كانت مبيعات التجمع اليوم؟",
        lead: "إجمالي المبيعات اليوم:",
        figure: "EGP 9,340.00",
        summary: "عبر 112 طلباً.",
        source: "المصدر: التحليلات",
      },
      menu: {
        tag: "الإدارة",
        title: "إدارة المنيو",
        body: "منيو واحد للعلامة، وأسعار لكل فرع، وقوائم نفاد تتحدث على كل QR والصندوق.",
        item: "مشويات مشكلة",
        price: "EGP 185",
        soldName: "أم علي",
        sold: "نفد",
      },
      offline: {
        tag: "الكاشير",
        title: "الصندوق بدون إنترنت",
        body: "واصل استقبال الطلبات إذا انقطع الإنترنت. تتزامن الطلبات بأمان عند العودة.",
        status: "غير متصل · ٣ طلبات في الانتظار",
      },
      lang: {
        tag: "الجميع",
        title: "العربية / الإنجليزية",
        body: "كل الشاشات باللغتين، مع تخطيط كامل من اليمين إلى اليسار.",
        mark: "EN / ع",
      },
    },
    flowHub: {
      eyebrow: "طلب واحد، كل الشاشات",
      title: "الطلب #128 يصل إلى كل الشاشات دفعة واحدة.",
      body: "في اللحظة التي يضغط فيها الضيف «اطلب»، يراه المطبخ والتجميع والصالة والكاشير والمالك — وتنتقل حالته من جديد إلى قيد التحضير إلى جاهز على كل شاشة.",
      order: "الطلب #128",
      meta: "طاولة 12 · EGP 455.00",
      nodes: {
        guest: { label: "هاتف الضيف", detail: "طلب من رمز الطاولة" },
        kitchen: { label: "شاشة المطبخ", detail: "المشويات · قيد التحضير 4:12" },
        expo: { label: "التجميع", detail: "الأطباق كاملة · أرسل" },
        owner: { label: "لوحة المالك", detail: "المبيعات تتحدث مباشرة" },
        floor: { label: "الصالة والرانرز", detail: "الرانر كريم · طاولة 12" },
        pay: { label: "المدفوعات والدُرج", detail: "دُفع بالبطاقة · دُرج 2" },
        pos: { label: "نقطة البيع", detail: "ظاهرة للكاشير" },
        drive: { label: "الدرايف ثرو", detail: "نفس المسار للسيارات" },
      },
    },
    story: {
      guest: {
        tab: "الضيف",
        kicker: "01 الضيف",
        title: "اطلب من الطاولة.",
        body: "رمز الطاولة يفتح المنيو بالعربية أو الإنجليزية. يطلب الضيف، أو ينادي النادل، أو يطلب الحساب.",
        stat: "0 تطبيقات",
        statNote: "للتثبيت على هاتف الضيف",
      },
      cashier: {
        tab: "الكاشير",
        kicker: "02 الكاشير",
        title: "نقطة بيع تواكب الخدمة.",
        body: "تذاكر سريعة، وتقسيم المدفوعات بالجنيه، ودُرج يتوازن عند كل تسليم.",
        stat: "دون اتصال",
        statNote: "يستمر استقبال الطلبات، ثم تتزامن لاحقاً",
      },
      kitchen: {
        tab: "المطبخ",
        kicker: "03 المطبخ",
        title: "كل تذكرة على خط التحضير.",
        body: "طلبات الرمز ونقطة البيع والدرايف ثرو تصل إلى شاشة المحطة مع المؤقتات. التجميع يُخرجها.",
        stat: "3 حالات",
        statNote: "جديد · قيد التحضير · جاهز",
      },
      owner: {
        tab: "المالك",
        kicker: "04 المالك",
        title: "كل الفروع، مباشرة.",
        body: "المبيعات والطلبات والأدراج لكل فرع — واسأل كويكو عن الرقم الذي تحتاجه.",
        stat: "عرض واحد",
        statNote: "لكل الفروع",
      },
      cashierItems: [
        { name: "فطير", price: "EGP 45" },
        { name: "شاورما", price: "EGP 70" },
        { name: "كشري", price: "EGP 55" },
      ],
      cashierTotal: "EGP 170",
      cashierMethods: "نقد · بطاقة · محفظة",
      kitchenNew: "جديد",
      kitchenCook: "قيد التحضير",
      kitchenReady: "جاهز",
      kitchenTickets: [
        { code: "#140 · طاولة 4", item: "١× مشويات مشكلة" },
        { code: "#128 · طاولة 12", item: "٢× ملوخية" },
        { code: "#133 · استلام", item: "١× أم علي" },
      ],
      ownerSample: "أرقام تجريبية",
      ownerSalesLabel: "المبيعات",
      ownerSales: "EGP 18,420",
      ownerOrdersLabel: "الطلبات",
      ownerOrders: "86",
    },
    start: {
      ghost: "ابدأ",
      eyebrow: "كيف تبدأ",
      title: "أربع خطوات حتى أول تذكرة.",
      body: "نضم فرعاً واحداً في كل مرة. تبقى لك قائمتك وأسعارك وفريقك.",
      talk: {
        title: "تحدث إلينا",
        body: "أخبرنا عن علامتك: الفروع، والطاولات، وأنواع الخدمة، والمنيو الذي تستخدمه اليوم. اسأل كويكو يستطيع الإجابة عن الأسئلة الأولى فوراً.",
        lines: [
          "لدينا 3 فروع ودرايف ثرو في التجمع.",
          "ممتاز — أرسلوا المنيو الحالي وعدد الطاولات، ونجهّز فرعاً تجريبياً.",
        ],
      },
      setup: {
        title: "نجهّز المنيو والفروع",
        body: "نبني المنيو بالعربية والإنجليزية، ونضبط أسعار الفروع ومحطات المطبخ والأدراج وأدوار الفريق.",
        lines: [
          "المنيو · 64 صنفاً · عربي/إنجليزي · تم",
          "أسعار الفروع · 3 فروع · تم",
          "المحطات · شواية · بارد · بار · تم",
          "أدوار الفريق · 18 حساباً · قيد التجهيز",
        ],
      },
      print: {
        title: "اطبع رموز الطاولات",
        body: "كل طاولة لها رمزها. يمسح الضيف، ويطلب، وينادي النادل. تطبع الورقة التي نجهّزها.",
        lines: ["طاولة 1", "طاولة 2", "طاولة 3"],
      },
      live: {
        title: "ابدأ التشغيل",
        body: "ابدأ في فرع واحد بجلسة قصيرة لكل دور — الكاشير، والمطبخ، والرانرز — ثم وسّع الباقي.",
        lines: ["مباشر", "أول تذكرة", "#001 · طاولة 4", "جاهز", "٢× قهوة تركي"],
      },
    },
    cta: {
      title: "انقل مطعمك إلى كويكو.",
      placeholder: "اسم المطعم",
      button: "احجز عرضًا",
      branch: "فرع واحد في كل مرة",
      menu: "منيوك وأسعارك",
      languages: "الإنجليزية والعربية",
    },
    partner: {
      eyebrow: "عرض مجاني",
      title: "احجز عرضك المجاني.",
      body: "احكِ لنا عن مطعمك. نرد خلال يوم عمل واحد ونجهز لك فرعًا تجريبيًا بالمنيو الخاص بك.",
      askEyebrow: "لست جاهزًا بعد؟",
      askTitle: "اسأل كويكو.",
      askBody: "المزايا والأسعار والتجهيز والمنيو العربي — إجابات فورية عن كويكو فقط.",
      askOpen: "ابدأ المحادثة",
      talkTitle: "تفضّل الكلام؟",
      talkBody: "راسلنا على واتساب أو اتصل أو ابعت إيميل. نرد خلال يوم عمل واحد.",
      whatsapp: "واتساب",
      call: "اتصال",
      email: "البريد",
      waMessage: "أهلًا كويكو، أريد عرضًا مجانيًا لمطعمي."
    },
    backOffice: {
      eyebrow: "خلف الكاونتر",
      title: "الإدارة تعمل على نفس النظام.",
      body: "المخزون والفريق والتوصيل والأرقام تشارك نفس المنيو ونفس الطلبات — فترى تكلفة الأكل والنقدية وساعات العمل بدون جداول.",
      items: {
        stock: {
          tag: "المخزون",
          title: "المخزون وتكلفة الأكل",
          body: "الخامات والوصفات والتحضير والجرد والهالك — والتحويل بين الفروع والمطبخ المركزي."
        },
        purchasing: {
          tag: "المشتريات",
          title: "الموردون وأوامر الشراء",
          body: "اطلب من مورديك، واستلم في المخزون، واعرف ما استهلكه كل فرع."
        },
        attendance: {
          tag: "الفريق",
          title: "الحضور والورديات",
          body: "تسجيل الحضور برمز PIN على الكاشير، وتخطيط وردية كل شخص، وتعديل سجلات الدوام من المدير."
        },
        reports: {
          tag: "التقارير",
          title: "تقارير أرقامها مضبوطة",
          body: "المبيعات والأصناف والفروع والمدفوعات والضرائب والقنوات والخصومات — مقارنة بالأسبوع أو الشهر الماضي، مع تصدير CSV."
        },
        delivery: {
          tag: "التوصيل",
          title: "سائقوك أنت",
          body: "لوحة توصيل من «في انتظار السائق» حتى «تم التوصيل»، مع رسوم حسب المحافظة والمنطقة."
        },
        brands: {
          tag: "الملاك",
          title: "فروع كثيرة وعلامات كثيرة",
          body: "أدوار لكل مستوى — الفرع والمنطقة والعلامة — وسجل يوضح من غيّر ماذا."
        }
      }
    },
    pricing: {
      eyebrow: "الأسعار",
      title: "باقة واحدة. كل المزايا. السعر لكل فرع.",
      body: "الأسعار بالجنيه المصري لكل فرع شهريًا، ولا تشمل ضريبة القيمة المضافة 14%. التجهيز وإدخال المنيو وتدريب الفريق مجانًا.",
      currency: "جنيه",
      tiers: [
        {
          name: "فرع واحد",
          price: "4,000",
          note: "للفرع / شهريًا"
        },
        {
          name: "2–4 فروع",
          price: "3,600",
          note: "للفرع / شهريًا · وفّر 10%"
        },
        {
          name: "5–9 فروع",
          price: "3,200",
          note: "للفرع / شهريًا · وفّر 20%"
        },
        {
          name: "10 فروع أو أكثر",
          price: "سعر خاص",
          note: "تواصل معنا لسعر المجموعة"
        }
      ],
      popular: "الأنسب للسلاسل",
      includesTitle: "كل باقة تشمل",
      includes: [
        "طلب الطاولات بالـQR ودفع الضيف",
        "الكاشير والعمل دون اتصال ودرج النقدية",
        "شاشة المطبخ والتجميع",
        "المخزون والوصفات والمشتريات",
        "الحضور والورديات",
        "التقارير وتصدير CSV",
        "اسأل كويكو للمديرين",
        "العربية والإنجليزية"
      ],
      terms: [
        "ادفع سنويًا واحصل على شهرين مجانًا",
        "بدون عمولة على الدفع بالبطاقة — فقط رسوم Paymob",
        "اشتراك شهري وإلغاء في أي وقت",
        "بياناتك ملكك ويمكنك تصديرها"
      ],
      founding: {
        badge: "الشركاء المؤسسون",
        title: "أول 20 مطعمًا يحصلون على 3 أشهر مجانًا.",
        body: "بعدها تحتفظ بخصم 20% مدى الحياة، مقابل ملاحظاتك والسماح لنا بمشاركة قصتك. معك كود خصم؟ اكتبه في نموذج العرض.",
        cta: "احجز مكانك كشريك مؤسس",
        limited: "متاح لأول 20 مطعمًا فقط"
      },
      cta: "احجز عرضًا مجانيًا"
    },
    faq: {
      eyebrow: "أسئلة شائعة",
      title: "أسئلة يسألها أصحاب المطاعم.",
      items: [
        {
          q: "ما الأجهزة التي أحتاجها؟",
          a: "التابلت والموبايل والكمبيوتر الموجودة عندك بمتصفح حديث. طابعة الإيصالات اختيارية. نحن لا نبيع أجهزة ولا نربطك بعلامة معينة."
        },
        {
          q: "ماذا يحدث لو انقطع الإنترنت؟",
          a: "يستمر الكاشير في أخذ الطلبات النقدية للتيك أواي والصالة. تتم مزامنتها عند عودة الاتصال، ويراجع المدير ما يحتاج مراجعة."
        },
        {
          q: "هل يحتاج الضيف لتثبيت تطبيق؟",
          a: "لا. يمسح الضيف رمز الطاولة فيفتح المنيو في متصفح موبايله بالعربي أو الإنجليزي."
        },
        {
          q: "كيف يعمل الدفع بالبطاقة؟",
          a: "يدفع الضيف أو الكاشير بالبطاقة أو المحفظة عبر حساب Paymob الخاص بك. الفلوس تذهب لك مباشرة، وكويكو لا يأخذ عمولة."
        },
        {
          q: "كم يستغرق التجهيز؟",
          a: "نبدأ بفرع واحد: ندخل المنيو باللغتين، ونجهز ورقة رموز QR للطاولات، وندرب كل دور في جلسة قصيرة. بعدها تضيف باقي الفروع."
        },
        {
          q: "هل يوجد عقد طويل؟",
          a: "لا. تدفع شهريًا ويمكنك الإلغاء في أي وقت. والدفع السنوي يمنحك شهرين مجانًا."
        },
        {
          q: "لمن تعود ملكية بياناتي؟",
          a: "لك. يمكنك تصدير تقاريرك بصيغة CSV في أي وقت."
        },
        {
          q: "هل أستطيع إدارة عدة فروع أو علامات؟",
          a: "نعم. منيو واحد للعلامة بأسعار لكل فرع، وتقارير عبر الفروع، وأدوار لمديري الفروع والمناطق وأصحاب العلامات."
        }
      ]
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
      launcherShort: "اسأل كويكو",
      status: "إجابات فورية بالعربية أو الإنجليزية",
      greeting: "أهلًا! ماذا تحب أن تعرف عن كويكو؟",
      greetingBody: "اسأل عن الطلب بالـ QR من الطاولة، والكاشير، وشاشات المطبخ، والأسعار، أو كيف تبدأ.",
      tryAsking: "أسئلة شائعة",
      newChat: "محادثة جديدة",
      nudge: "عندك أسئلة؟ اسأل كويكو بالعربية أو الإنجليزية.",
      nudgeDismiss: "إغلاق",
      demoTitle: "شاهده بقائمة مطعمك",
      demoBody: "نرد خلال يوم عمل واحد ونجهّز لك فرعًا تجريبيًا بقائمتك.",
      moreQuestions: "أسئلة أخرى",
      disclaimer: "الإجابات عن كويكو فقط. يرجى عدم مشاركة بيانات شخصية هنا.",
      becomePartner: "كن شريكاً",
      close: "إغلاق",
      starters: {
        capabilities: "ماذا يمكن أن يقدمه كويكو لمطعمي؟",
        pricing: "كم سعر كويكو؟",
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
      promo: "كود الخصم (اختياري)",
      privacyNote: "نستخدم هذه البيانات فقط للتواصل معك بخصوص كويكو.",
      privacyLink: "سياسة الخصوصية",
      errors: {
        name: "اكتب اسمك.",
        restaurant: "اكتب اسم المطعم.",
        contact: "اكتب رقم هاتف أو بريدًا إلكترونيًا.",
        city: "اكتب مدينتك.",
        branches: "اكتب رقمًا من 1 إلى 500.",
        message: "اجعل الرسالة أقل من 1,000 حرف."
      },
    },
    footer: {
      rights: "جميع الحقوق محفوظة",
      dashboard: "تسجيل الدخول",
      signInLabel: "تسجيل الدخول",
      blurb: "نظام تشغيل المطعم للطاولة والمطبخ والمكتب الخلفي.",
      made: "صُنع في القاهرة.",
      product: "المنتج",
      company: "الشركة",
      language: "اللغة",
      qr: "رمز الطاولة",
      pos: "نقطة البيع والدُرج دون اتصال",
      kitchen: "المطبخ والتجميع",
      drive: "الدرايف ثرو",
      contact: "تواصل",
      backOffice: "الإدارة",
      pricing: "الأسعار",
      faq: "أسئلة شائعة",
      privacy: "الخصوصية",
      terms: "الشروط",
      whatsapp: "واتساب",
    },
} satisfies LandingCopy;

export const landingCopy = defineDictionary(landingEn, landingAr);
