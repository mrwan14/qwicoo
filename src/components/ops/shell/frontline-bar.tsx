"use client";

import { cn } from "cn";
import { Check, ChevronDown, Languages, LogOut, Menu as MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ops/kit/badge";
import { buttonClass } from "@/components/ops/kit/button";
import { Menu, MenuContent, MenuHeading, MenuItem, MenuLinkItem, MenuSeparator, MenuTrigger } from "@/components/ops/kit/menu";
import { BranchSwitcher } from "@/components/ops/scope-header";
import { BrandMark, useScopeIdentity } from "@/components/ops/shell/sidebar";
import { useLocaleToggle, useLogOut } from "@/components/ops/shell/user-menu";
import { useStaffSession } from "@/components/ops/staff-session";
import { AlertControls } from "@/features/staff/alerts/alert-controls";
import { useMyAttendance } from "@/features/staff/attendance/clock";
import { ClockChip } from "@/features/staff/attendance/clock-panel";
import { cairoTime } from "@/features/staff/home/numbers";
import { roleLabel, type UserRole } from "@/lib/auth/roles";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { navCopy } from "@/lib/i18n/staff/nav";
import { shellCopy } from "@/lib/i18n/staff/shell";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { isNavActive, navKey, type NavItem } from "@/lib/nav";

type ScreenKey = keyof typeof shellCopy.en.screens;

const SCREEN_TITLES: Record<string, ScreenKey> = {
  "/app/pos": "pos",
  "/app/kds": "kds",
  "/app/kds/expo": "expo",
  "/app/floor": "floor",
  "/app/floor/requests": "requests",
  "/app/orders": "orders",
  "/app/orders/delivery": "delivery",
  "/app/orders/payments": "payments",
  "/app/stock": "stock",
  "/app/attendance": "attendance",
};

export function useScreenTitle() {
  const t = useStaffSection(shellCopy);
  const nav = useStaffSection(navCopy);
  return (item: NavItem, role: UserRole) => {
    const key = SCREEN_TITLES[item.href];
    if (key === "expo" && role === "RUNNER") return t.screens.ready;
    return key ? t.screens[key] : nav[item.labelKey];
  };
}

/**
 * Cashier, waiter, kitchen and runner: brand and branch, the current work screen
 * (a menu when the role has more than one), attendance, and log out. No sidebar.
 */
export function FrontlineBar({ screens, badges = {} }: { screens: readonly NavItem[]; badges?: Readonly<Record<string, number>> }) {
  const t = useStaffSection(shellCopy);
  const me = useStaffSession();
  const pathname = usePathname();
  const { locale } = useLocale();
  const identity = useScopeIdentity();
  const titleOf = useScreenTitle();
  const localeToggle = useLocaleToggle();
  const { ask, dialog } = useLogOut();
  const attendance = useMyAttendance({ enabled: screens.some((item) => item.href === "/app/attendance") });
  if (!me) return null;

  const canClock = screens.some((item) => item.href === "/app/attendance");
  // Orders tabs (delivery, history, payments) are not listed, so fall back to the parent screen.
  const current =
    screens.find((item) => isNavActive(pathname, item.href)) ??
    screens.find((item) => pathname.startsWith(`${item.href}/`)) ??
    null;
  const title = current ? titleOf(current, me.role) : null;
  const since = attendance.checkInAt ? fill(t.clockedIn, { time: cairoTime(attendance.checkInAt, locale) }) : null;
  const who = `${me.full_name} · ${roleLabel(me.role)}`;
  const place = identity.branchName ? `${identity.name} · ${identity.branchName}` : identity.name;
  const tillHref = "/app/attendance?till=1";
  const switcher = screens.length > 1;

  const screenItems = screens.map((item) => {
    const active = current ? navKey(item) === navKey(current) : false;
    const count = badges[navKey(item)];
    return (
      <MenuLinkItem key={navKey(item)} render={<Link href={item.href} />} aria-current={active ? "page" : undefined}>
        <span className={cn("min-w-0 flex-1 truncate", active && "font-semibold")}>{titleOf(item, me.role)}</span>
        {count ? <Badge tone="danger">{count}</Badge> : null}
        {active ? <Check aria-hidden className="text-ink!" /> : null}
      </MenuLinkItem>
    );
  });

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-subtle px-4 print:hidden md:h-[60px] md:px-5">
      {/* Phone: who and where on the left, everything else in one menu. */}
      <div className="flex min-w-0 items-center gap-2.5 md:hidden">
        <BrandMark name={identity.name} logoUrl={identity.logoUrl} size="sm" />
        <div className="grid min-w-0">
          <span className="truncate text-[15px] font-semibold text-ink">{who}</span>
          <span className="truncate text-[13px] text-ink-secondary">
            {[identity.branchName ?? identity.name, since].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 text-ink md:hidden">
        {canClock ? <ClockChip attendance={attendance} tillHref={tillHref} compact /> : null}
        <AlertControls />
        <Menu>
          <MenuTrigger
            aria-label={t.openNav}
            className="inline-flex size-11 items-center justify-center rounded-staff outline-none hover:bg-canvas focus-visible:outline-2 focus-visible:outline-focus"
          >
            <MenuIcon aria-hidden className="size-[22px]" />
          </MenuTrigger>
          <MenuContent className="min-w-64">
            {switcher ? (
              <>
                <MenuHeading>{t.switchScreen}</MenuHeading>
                {screenItems}
                <MenuSeparator />
              </>
            ) : null}
            <MenuItem onClick={localeToggle.toggle}>
              <Languages aria-hidden />
              <span lang={localeToggle.lang}>{localeToggle.label}</span>
            </MenuItem>
            <MenuItem onClick={ask}>
              <LogOut aria-hidden className="rtl:-scale-x-100" />
              {t.logOut}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      {/* Tablet and up: the full bar from the design. */}
      <div className="hidden min-w-0 items-center gap-3 md:flex">
        <BrandMark name={identity.name} logoUrl={identity.logoUrl} />
        <span className="truncate text-base font-semibold text-ink">{place}</span>
        <BranchSwitcher hideSingle />
        {title && switcher ? (
          <Menu>
            <MenuTrigger
              aria-label={`${t.switchScreen}: ${title}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-staff px-2 text-base text-ink-secondary outline-none hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-focus data-popup-open:bg-canvas"
            >
              <span className="truncate">{title}</span>
              <ChevronDown aria-hidden className="size-4 shrink-0" />
            </MenuTrigger>
            <MenuContent align="start">
              <MenuHeading>{t.switchScreen}</MenuHeading>
              {screenItems}
            </MenuContent>
          </Menu>
        ) : title ? (
          <span className="truncate text-base text-ink-secondary">{title}</span>
        ) : null}
      </div>
      <div className="hidden shrink-0 items-center gap-3 md:flex">
        {canClock ? <ClockChip attendance={attendance} tillHref={tillHref} /> : null}
        <div className="flex items-center text-ink">
          <AlertControls />
        </div>
        <span className="hidden max-w-48 truncate text-[15px] text-ink-secondary lg:inline">{who}</span>
        <button
          type="button"
          lang={localeToggle.lang}
          className={cn(buttonClass({ variant: "ghost", size: "sm" }), "min-h-10 px-3 text-sm")}
          onClick={localeToggle.toggle}
        >
          {localeToggle.label}
        </button>
        <button
          type="button"
          className={cn(buttonClass({ variant: "secondary", size: "sm" }), "min-h-10 px-3.5 text-sm")}
          onClick={ask}
        >
          <LogOut aria-hidden className="rtl:-scale-x-100" />
          {t.logOut}
        </button>
      </div>
      {dialog}
    </header>
  );
}
