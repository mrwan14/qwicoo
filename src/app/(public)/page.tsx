import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  ClipboardList,
  LayoutGrid,
  Monitor,
  QrCode,
  Receipt,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const metadata: Metadata = {
  title: { absolute: "Qwicoo · Run your restaurant from the table to the kitchen" },
  description:
    "Qwicoo gives restaurants QR table ordering, POS, kitchen displays, floor management, payments, and analytics in one system.",
};

const PROBLEMS: { title: string; body: string; fix: string }[] = [
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
];

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: QrCode, title: "QR table ordering", body: "Table presence by location or PIN, a shared table cart, bilingual menus, and live order tracking." },
  { icon: Receipt, title: "Point of sale", body: "Fast ticket building with price validation, modifiers, checkout, and cancellations." },
  { icon: Monitor, title: "Kitchen display and expo", body: "Station tickets with bump buttons sized for a busy line, plus a pass view for expo." },
  { icon: LayoutGrid, title: "Floor and service requests", body: "Live table states and a queue of guest requests for waiters and runners." },
  { icon: Wallet, title: "Payments and cash control", body: "Cash and online payments, pending payment approvals, drawer sessions, and Z reports." },
  { icon: Truck, title: "Drive-thru and delivery", body: "Pickup orders with vehicle details and delivery fees by governorate and zone." },
  { icon: BarChart3, title: "Analytics", body: "Dashboards for sales, menu performance, and branch comparison." },
  { icon: ClipboardList, title: "Staff and attendance", body: "Role-based accounts, check-in and check-out logs, and an audit trail." },
];

const STEPS: { title: string; body: string }[] = [
  { title: "Tell us about your brand", body: "Number of branches, table count, and the menu you run today." },
  { title: "We set up your workspace", body: "Brand, branches, tables with QR codes, menu, and staff accounts." },
  { title: "Go live in a branch", body: "Start with one branch, then roll out to the rest with the same menu and settings." },
];

export default function HomePage() {
  return (
    <main className="bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <p className="text-sm font-semibold">Qwicoo</p>
        <nav aria-label="Site" className="flex items-center gap-2 text-sm">
          <a href="#features" className="hidden rounded-lg px-3 py-2 hover:bg-muted sm:inline-flex">
            Features
          </a>
          <a href="#partner" className="hidden rounded-lg px-3 py-2 hover:bg-muted sm:inline-flex">
            Become a partner
          </a>
          <Link
            href="/restaurant-dashboard"
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-medium text-primary-foreground"
          >
            Restaurant sign in
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-16 sm:py-24">
        <p className="text-sm font-medium text-muted-foreground">Who we are</p>
        <h1 className="font-display max-w-3xl text-[length:var(--text-40)] leading-none font-semibold sm:text-6xl">
          Orders for the floor, the kitchen, and the table.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Qwicoo is an operating system for restaurants. Guests order from a QR at the table, the kitchen sees every
          ticket on a screen, cashiers close out a clean drawer, and owners see every branch from one dashboard.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="#partner"
            className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            Become a partner
          </a>
          <a href="#problems" className="inline-flex min-h-12 items-center rounded-xl border px-5 text-sm font-medium">
            See how it works
          </a>
        </div>
      </section>

      <section id="problems" className="border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16">
          <div className="grid gap-2">
            <p className="text-sm font-medium text-muted-foreground">Restaurant problems, and how we solve them</p>
            <h2 className="text-[length:var(--text-28)] font-semibold">The day-to-day problems we built Qwicoo for</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {PROBLEMS.map((item) => (
              <article key={item.title} className="grid gap-3 rounded-2xl border bg-background p-5">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.body}</p>
                <p className="text-sm">
                  <span className="font-medium">With Qwicoo: </span>
                  {item.fix}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto grid max-w-6xl gap-8 px-6 py-16">
        <div className="grid gap-2">
          <p className="text-sm font-medium text-muted-foreground">Features</p>
          <h2 className="text-[length:var(--text-28)] font-semibold">Everything a branch needs, in one system</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article key={title} className="grid gap-3 rounded-2xl border p-5">
              <Icon aria-hidden className="size-6" />
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="partner" className="border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16">
          <div className="grid gap-2">
            <p className="text-sm font-medium text-muted-foreground">Become a partner</p>
            <h2 className="text-[length:var(--text-28)] font-semibold">Bring your restaurant onto Qwicoo</h2>
            <p className="max-w-2xl text-muted-foreground">
              We onboard brands one branch at a time. You keep your menu, your prices, and your staff. We handle the setup.
            </p>
          </div>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="grid gap-2 rounded-2xl border bg-background p-5">
                <span className="text-sm font-semibold text-muted-foreground">Step {index + 1}</span>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="mailto:partners@qwicoo.com?subject=Partner%20with%20Qwicoo"
              className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground"
            >
              Talk to us
            </a>
            <p className="text-sm text-muted-foreground">Already a partner? Sign in below.</p>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">© {new Date().getFullYear()} Qwicoo</p>
        <nav aria-label="Sign in" className="flex flex-wrap gap-2">
          <Link href="/restaurant-dashboard" className="inline-flex min-h-11 items-center rounded-lg border px-4 font-medium">
            Restaurant dashboard
          </Link>
          <Link href="/admin" className="inline-flex min-h-11 items-center rounded-lg px-4 text-muted-foreground hover:bg-muted">
            Platform admin
          </Link>
        </nav>
      </footer>
    </main>
  );
}
