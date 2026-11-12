"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Menu, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/ops/logo";
import { Money } from "@/components/ops/money";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { guestCopy } from "@/features/guest/copy";
import { GuestAboutPanel, GuestDrawer, type GuestDrawerAction } from "@/features/guest/guest-drawer";
import { PayBillSheet, useTableBill } from "@/features/guest/pay-bill-sheet";
import { refreshGuestToken } from "@/features/guest/visit-api";
import { WaiterSheet } from "@/features/guest/service-sheets";
import { GuestSkeleton, OrderingPausedNotice, isGuestUnreachable, useOrderingPaused } from "@/features/guest/ordering-status";
import { themeFor, themeStyle, useGuestThemeProps } from "@/features/guest/theme-style";
import { guestTableToken, isGuestSessionGone, markVisitEnded, recoverGuestSession } from "@/features/guest/session";
import { brandDisplayName, mergeGuestBranding, sameBranding } from "@/lib/guest/branding";
import type { GuestTheme } from "@/lib/guest/theme";
import { mediaUrl } from "@/lib/media";
import { useGuest } from "@/stores/guest";

import "./guest.css";

export const guestField = "guest-field guest-motion";
export const guestPrimaryButton = "guest-btn guest-btn-primary guest-motion";
export const guestSecondaryButton = "guest-btn guest-btn-secondary guest-motion";
export const guestGhostButton = "guest-btn guest-btn-ghost guest-motion";
export const guestIconButton = "guest-btn guest-btn-icon guest-motion";

const OpenDrawerContext = createContext<() => void>(() => {});

export function useOpenGuestDrawer() {
  return useContext(OpenDrawerContext);
}

const MenuChromeContext = createContext({ searchOpen: false, toggleSearch: () => {} });

export function useMenuChrome() {
  return useContext(MenuChromeContext);
}

function MenuTopBar() {
  const { t, locale, setLocale } = useGuestCopy();
  const openDrawer = useOpenGuestDrawer();
  const { searchOpen, toggleSearch } = useMenuChrome();
  const placeLabel = useGuestPlaceLabel();
  const branding = useGuest((state) => state.branding);
  const brandName = useBrandName();
  const branchName = useGuest((state) => state.session?.branchName ?? state.tablePreview?.branchName ?? null);
  const tableNumber = useGuest((state) => state.session?.tableNumber ?? state.tablePreview?.tableNumber);
  const sessionId = useGuest((state) => state.session?.sessionId ?? null);
  // Once the table has ordered, the table chip leads back to the table: rounds, bill and paying.
  const bill = useTableBill({ enabled: Boolean(sessionId && tableNumber), refetchInterval: 30_000 });
  const ordered = Boolean(bill.data?.rounds.some((round) => round.status !== "CANCELLED"));
  const [logoFailed, setLogoFailed] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const logo = branding?.logoUrl && !logoFailed ? mediaUrl(branding.logoUrl) : null;
  const cover = branding?.coverUrl && !coverFailed ? mediaUrl(branding.coverUrl) : null;
  const name = brandName || branchName || t.restaurant;
  const initials = name.trim().slice(0, 1).toUpperCase();

  return (
    <header className="guest-hero" data-cover={cover ? "true" : "false"}>
      <div className="guest-hero-band" aria-hidden>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" onError={() => setCoverFailed(true)} />
        ) : null}
      </div>
      <div className="guest-hero-actions">
        <button type="button" className="guest-hero-btn guest-motion" aria-label={t.openMenu} onClick={openDrawer}>
          <Menu className="size-5" aria-hidden />
        </button>
        <span className="flex-1" />
        <button
          type="button"
          className="guest-hero-btn guest-hero-lang guest-motion"
          aria-label={t.changeLanguage}
          onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
        >
          {t.language}
        </button>
        <button
          type="button"
          className="guest-hero-btn guest-motion"
          aria-label={searchOpen ? t.closeSearch : t.openSearch}
          aria-pressed={searchOpen}
          onClick={toggleSearch}
        >
          {searchOpen ? <X className="size-5" aria-hidden /> : <Search className="size-5" aria-hidden />}
        </button>
      </div>
      <div className="guest-hero-id">
        <span className="guest-hero-logo">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" onError={() => setLogoFailed(true)} />
          ) : (
            <span aria-hidden>{initials}</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="guest-hero-name" dir="auto">
            {name}
          </h1>
          <p className="guest-hero-meta">
            {branchName && branchName !== name ? <span className="truncate">{branchName}</span> : null}
            {tableNumber && ordered && bill.data ? (
              <Link href="/order/track" className="guest-hero-table guest-motion" aria-label={t.openTable}>
                <Users className="size-3.5" aria-hidden />
                {placeLabel}
                <span aria-hidden>·</span>
                {Number(bill.data.remaining) > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    {t.billChip}
                    <span dir="ltr">
                      <Money amount={bill.data.remaining} currency={bill.data.currency} locale={locale} />
                    </span>
                  </span>
                ) : (
                  <span>{t.billChipPaid}</span>
                )}
                <ChevronRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
              </Link>
            ) : tableNumber ? (
              <span className="guest-hero-table">
                <Users className="size-3.5" aria-hidden />
                {placeLabel}
              </span>
            ) : null}
          </p>
        </div>
      </div>
    </header>
  );
}

/** The restaurant's theme as CSS variables, also mirrored on body so portaled sheets match. */
export function useGuestTheme(): GuestTheme {
  const branding = useGuest((state) => state.branding);
  const theme = useMemo(() => themeFor(branding), [branding]);
  useEffect(() => {
    const body = document.body;
    for (const [name, value] of Object.entries(theme.vars)) body.style.setProperty(name, value);
    body.dataset.guestDark = theme.dark ? "true" : "false";
    return () => {
      for (const name of Object.keys(theme.vars)) body.style.removeProperty(name);
      delete body.dataset.guestDark;
    };
  }, [theme]);
  return theme;
}

/** Restaurant name in the guest's language. */
export function useBrandName(): string | null {
  const locale = useGuest((state) => state.locale);
  const branding = useGuest((state) => state.branding);
  return brandDisplayName(branding, locale);
}

export function useGuestCopy() {
  const locale = useGuest((state) => state.locale);
  const setLocale = useGuest((state) => state.setLocale);
  const dir = locale === "ar" ? "rtl" : "ltr";
  return { t: guestCopy[locale], locale, dir, setLocale };
}

export function useGuestPlaceLabel() {
  const { t } = useGuestCopy();
  const tableNumber = useGuest((state) => state.session?.tableNumber ?? state.tablePreview?.tableNumber);
  return useMemo(() => {
    if (tableNumber) return t.tableLabel.replace("{n}", tableNumber);
    return t.driveThruLabel;
  }, [t.driveThruLabel, t.tableLabel, tableNumber]);
}

/** Fold any branding a guest-safe response carries into the guest store. */
export function useAbsorbBranding(payload: unknown) {
  useEffect(() => {
    if (!payload) return;
    const { branding, setBranding } = useGuest.getState();
    const next = mergeGuestBranding(branding, payload);
    if (!sameBranding(branding, next)) setBranding(next);
  }, [payload]);
}

/** Quiet note when presence was not verified for this diner (rare after harden join). */
export function PresenceNote() {
  const { t } = useGuestCopy();
  const unverified = useGuest((state) => state.session?.presenceVerified === false);
  if (!unverified) return null;
  return (
    <p role="status" className="guest-card px-4 py-3 text-sm">
      {t.locationNote}
    </p>
  );
}

export function LineDetails({ modifiers, note }: { modifiers: readonly string[]; note?: string | null }) {
  const { t } = useGuestCopy();
  const names = modifiers.filter(Boolean);
  const text = note?.trim();
  if (names.length === 0 && !text) return null;
  return (
    <div className="mt-1 grid gap-1 text-sm">
      {names.length > 0 ? <p className="text-[var(--guest-quiet)]">+ {names.join(", ")}</p> : null}
      {text ? (
        <p className="break-words rounded-[var(--guest-radius-thumb)] bg-[var(--secondary)] px-2 py-1">
          <span className="font-medium">{t.note}:</span> {text}
        </p>
      ) : null}
    </div>
  );
}

function BrandHeader() {
  const branding = useGuest((state) => state.branding);
  const brandName = useBrandName();
  const branchName = useGuest((state) => state.session?.branchName ?? null);
  const [logoFailed, setLogoFailed] = useState(false);
  const name = brandName ?? branchName;
  const branchCaption = branding?.name && branchName && branchName !== branding.name ? branchName : null;
  if (!name) {
    return <Logo markClassName="size-7 text-[var(--guest-orange)]" wordClassName="text-2xl" />;
  }

  const logo = branding?.logoUrl && !logoFailed ? mediaUrl(branding.logoUrl) : null;
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      {logo ? (
        <span className="guest-brand-logo size-9">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" onError={() => setLogoFailed(true)} />
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="guest-display block truncate text-[1.25rem]" dir="auto">
          {name}
        </span>
        {branchCaption ? <span className="guest-caption block truncate">{branchCaption}</span> : null}
      </span>
    </span>
  );
}

export function RejoinTable({ message }: { message?: string }) {
  const { t } = useGuestCopy();
  const token = useGuest((state) => state.tableToken) ?? (typeof window === "undefined" ? null : guestTableToken());
  const [pending, setPending] = useState(false);

  async function rejoin() {
    if (!token) return;
    setPending(true);
    const ok = await recoverGuestSession();
    setPending(false);
    if (ok) {
      window.location.assign("/order");
      return;
    }
    window.location.assign(`/t/${encodeURIComponent(token)}`);
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm">{message ?? t.sessionGone}</p>
      {token ? (
        <button type="button" className={guestPrimaryButton} disabled={pending} onClick={() => void rejoin()}>
          {pending ? t.rejoining : t.rejoin}
        </button>
      ) : (
        <p className="text-sm text-[var(--guest-quiet)]">{t.scanAgain}</p>
      )}
    </div>
  );
}

/**
 * Recovers a dropped guest cookie using the stored table token. With allowPreview, a guest who
 * scanned a QR but hasn't joined yet still sees the page (the menu browses without a session).
 */
/** The visit closed: the table page shows thanks and the receipt; other pages go there. */
function EndedVisitRedirect({ children }: { children: ReactNode }) {
  const { t } = useGuestCopy();
  const onTablePage = typeof window !== "undefined" && window.location.pathname === "/order/track";
  useEffect(() => {
    if (!onTablePage) window.location.replace("/order/track");
  }, [onTablePage]);
  return onTablePage ? children : <GuestSkeleton label={t.loading} />;
}

export function GuestResume({ children, allowPreview = false }: { children: ReactNode; allowPreview?: boolean }) {
  const { t } = useGuestCopy();
  const session = useGuest((state) => state.session);
  const endedVisit = useGuest((state) => state.endedVisit);
  const [ready, setReady] = useState(() => Boolean(useGuest.getState().session));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(useGuest.persist.rehydrate()).then(async () => {
      if (cancelled) return;
      if (useGuest.getState().session) setReady(true);
      const ok = await recoverGuestSession();
      if (cancelled) return;
      if (!ok && (useGuest.getState().tableToken ?? guestTableToken())) setFailed(true);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <GuestSkeleton label={t.rejoining} />;
  if (session) return children;
  if (allowPreview && (useGuest.getState().tableToken ?? guestTableToken())) return children;
  if (endedVisit) return <EndedVisitRedirect>{children}</EndedVisitRedirect>;
  return <RejoinTable message={failed ? t.sessionGone : undefined} />;
}

export function GuestQueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useGuestCopy();
  const gone = isGuestSessionGone(error);
  const paused = useOrderingPaused();
  const token = useGuest((state) => state.tableToken);
  /** null while a session-gone error is being checked against the live cookie. */
  const [sessionLive, setSessionLive] = useState<boolean | null>(null);
  const checked = useRef(false);

  useEffect(() => {
    if (!gone || checked.current) return;
    checked.current = true;
    let cancelled = false;
    void recoverGuestSession().then((ok) => {
      if (!cancelled) setSessionLive(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [gone]);

  if (gone) {
    if (sessionLive === null && token) return <GuestSkeleton label={t.rejoining} />;
    if (sessionLive !== true) return <RejoinTable />;
  }

  if (isGuestUnreachable(error)) {
    if (paused) {
      return (
        <button type="button" className={guestSecondaryButton} onClick={onRetry}>
          {t.retry}
        </button>
      );
    }
    return <OrderingPausedNotice onRetry={onRetry} retryLabel={t.retry} />;
  }

  return (
    <div role="alert" className="guest-alert guest-alert-error grid gap-3">
      <h2 className="guest-display text-xl">{t.oopsTitle}</h2>
      <p className="guest-body">{gone && sessionLive ? t.oops : error instanceof Error ? error.message : t.oops}</p>
      <button type="button" className={guestPrimaryButton} onClick={onRetry}>
        {t.retry}
      </button>
    </div>
  );
}

/** Renew well before the 3-hour guest token runs out. */
const GUEST_TOKEN_REFRESH_MS = 40 * 60 * 1000;

export function GuestShell({
  children,
  neutral = false,
  resume = !neutral,
  header = true,
  menu = false,
}: {
  children: ReactNode;
  neutral?: boolean;
  /** Recover a dropped table session. Off for pickup and the join form. */
  resume?: boolean;
  /** The join flow draws its own top bar. Menu and order keep this one. */
  header?: boolean;
  /** Menu screen draws the Palette F header itself. */
  menu?: boolean;
}) {
  const { t, locale, dir, setLocale } = useGuestCopy();
  const theme = useGuestTheme();
  const portalTheme = useGuestThemeProps();
  const paused = useOrderingPaused();
  const placeLabel = useGuestPlaceLabel();
  const tableNumber = useGuest((state) => state.session?.tableNumber);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [waiterOpen, setWaiterOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);

  useEffect(() => {
    void useGuest.persist.rehydrate();
  }, []);

  // The guest login lasts a few hours; renew it while the table visit is open so long dinners stay signed in.
  const liveSessionId = useGuest((state) => state.session?.sessionId ?? null);
  useEffect(() => {
    if (!liveSessionId) return;
    const timer = window.setInterval(() => {
      void refreshGuestToken().then((result) => {
        if (result === "ended") markVisitEnded();
      });
    }, GUEST_TOKEN_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [liveSessionId]);

  function onDrawerAction(action: GuestDrawerAction) {
    if (action === "about") {
      setAboutOpen(true);
      return;
    }
    if (action === "waiter") {
      setWaiterOpen(true);
      return;
    }
    if (action === "bill") {
      setBillOpen(true);
      return;
    }
  }

  return (
    <MenuChromeContext.Provider value={{ searchOpen, toggleSearch: () => setSearchOpen((open) => !open) }}>
      <OpenDrawerContext.Provider value={() => setDrawerOpen(true)}>
        <div dir={dir} lang={locale} className="guest-theme min-h-dvh" data-dark={theme.dark ? "true" : "false"} style={themeStyle(theme)}>
          <div className="guest-phone">
            {menu ? <MenuTopBar /> : null}
            {header && !menu ? (
              <header className="flex items-center justify-between gap-2.5 px-5 pb-1.5 pt-3">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  {!neutral ? (
                    <button type="button" className="guest-icon-btn guest-motion shrink-0" aria-label={t.openMenu} onClick={() => setDrawerOpen(true)}>
                      <span aria-hidden className="flex flex-col gap-[5px]">
                        <span className="block h-[2px] w-4 rounded-full bg-current" />
                        <span className="block h-[2px] w-4 rounded-full bg-current" />
                        <span className="block h-[2px] w-4 rounded-full bg-current" />
                      </span>
                    </button>
                  ) : null}
                  {neutral ? <Logo markClassName="size-7 text-[var(--guest-orange)]" wordClassName="text-xl" /> : <BrandHeader />}
                </div>
                {!neutral && tableNumber ? <span className="guest-badge guest-badge-place shrink-0">{placeLabel}</span> : null}
                <button type="button" className="guest-lang guest-motion shrink-0" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>
                  {t.language}
                </button>
              </header>
            ) : null}
            <div
              className={
                menu
                  ? "grid min-w-0 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))]"
                  : header
                    ? "grid min-w-0 gap-3 px-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-1"
                    : "flex min-h-dvh flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4"
              }
            >
              {paused ? <OrderingPausedNotice /> : null}
              <div className={header ? undefined : "flex min-h-0 flex-1 flex-col"}>
                {resume ? <GuestResume allowPreview={menu}>{children}</GuestResume> : children}
              </div>
            </div>
          </div>
          {!neutral ? (
            <>
              <GuestDrawer open={drawerOpen} onOpenChange={setDrawerOpen} onAction={onDrawerAction} placeLabel={placeLabel} />
              <Sheet open={aboutOpen} onOpenChange={setAboutOpen}>
                <SheetContent
                  side="bottom"
                  showCloseButton={false}
                  {...portalTheme}
                  className="guest-theme guest-sheet guest-phone mx-auto max-h-[90dvh] w-full border-0 p-0"
                >
                  <div className="flex justify-center pt-3">
                    <div className="guest-sheet-handle" aria-hidden />
                  </div>
                  <SheetTitle className="sr-only">{t.about}</SheetTitle>
                  <GuestAboutPanel placeLabel={placeLabel} />
                  <div className="guest-sheet-footer">
                    <button type="button" className={guestSecondaryButton} onClick={() => setAboutOpen(false)}>
                      {t.close}
                    </button>
                  </div>
                </SheetContent>
              </Sheet>
              <WaiterSheet open={waiterOpen} onOpenChange={setWaiterOpen} />
              <PayBillSheet open={billOpen} onOpenChange={setBillOpen} />
            </>
          ) : null}
        </div>
      </OpenDrawerContext.Provider>
    </MenuChromeContext.Provider>
  );
}
