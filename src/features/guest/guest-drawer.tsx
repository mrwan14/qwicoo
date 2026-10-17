"use client";

import Link from "next/link";
import { useState } from "react";

import { Logo } from "@/components/ops/logo";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useGuestCopy } from "@/features/guest/shell";
import { mediaUrl } from "@/lib/media";
import { useGuest } from "@/stores/guest";

export type GuestDrawerAction = "menu" | "orders" | "waiter" | "bill" | "about";

export function GuestDrawer({
  open,
  onOpenChange,
  onAction,
  placeLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: GuestDrawerAction) => void;
  placeLabel: string;
}) {
  const { t, dir, locale, setLocale } = useGuestCopy();
  const branding = useGuest((state) => state.branding);
  const [logoFailed, setLogoFailed] = useState(false);
  const logo = branding?.logoUrl && !logoFailed ? mediaUrl(branding.logoUrl) : null;
  const brandName = branding?.name;
  const side = dir === "rtl" ? "right" : "left";

  const links: { action: GuestDrawerAction; label: string; href?: string }[] = [
    { action: "menu", label: t.menu, href: "/order" },
    { action: "orders", label: t.myTableOrders, href: "/order/track" },
    { action: "waiter", label: t.callWaiterTitle },
    { action: "bill", label: t.askBill },
    { action: "about", label: t.about },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        showCloseButton={false}
        className="guest-theme flex w-[min(100%,20rem)] flex-col gap-0 border-0 border-e border-[var(--guest-line)] bg-[var(--guest-canvas)] p-0 shadow-[var(--guest-shadow)] sm:max-w-sm"
      >
        <div className="flex items-start justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <SheetTitle className="sr-only">{t.openMenu}</SheetTitle>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={brandName ?? "Qwicoo"}
                className="h-10 w-auto max-w-[10rem] object-contain"
                onError={() => setLogoFailed(true)}
              />
            ) : brandName ? (
              <p className="guest-display text-2xl text-[var(--guest-ink)]">{brandName}</p>
            ) : (
              <Logo markClassName="size-7 text-[var(--guest-orange)]" wordClassName="text-2xl" />
            )}
          </div>
          <SheetClose
            className="guest-btn guest-btn-secondary guest-motion !h-11 !w-11 !min-h-11 shrink-0 !p-0 text-xl leading-none"
            aria-label={t.close}
          >
            ×
          </SheetClose>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5 px-3 py-2" aria-label={t.openMenu}>
          {links.map((link) => {
            const className =
              "guest-btn guest-btn-secondary guest-motion !justify-start !px-4 text-start !font-semibold";
            if (link.href) {
              return (
                <Link
                  key={link.action}
                  href={link.href}
                  className={className}
                  onClick={() => {
                    onAction(link.action);
                    onOpenChange(false);
                  }}
                >
                  {link.label}
                </Link>
              );
            }
            return (
              <button
                key={link.action}
                type="button"
                className={className}
                onClick={() => {
                  onAction(link.action);
                  onOpenChange(false);
                }}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto grid gap-3 px-4 py-4 text-sm text-[var(--guest-quiet)]">
          <button
            type="button"
            className="guest-btn guest-btn-secondary guest-motion !h-11 !min-h-11"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
          >
            {t.language}
          </button>
          <div>
            <p className="font-medium text-[var(--guest-ink)]">{placeLabel}</p>
            <p className="mt-1">{t.poweredBy}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function GuestAboutPanel({ placeLabel }: { placeLabel: string }) {
  const { t } = useGuestCopy();
  const branding = useGuest((state) => state.branding);
  const branchName = useGuest((state) => state.session?.branchName);
  return (
    <div className="grid gap-3 p-4">
      <h2 className="guest-display guest-display-lg">{t.about}</h2>
      <p className="guest-body">{t.aboutBody}</p>
      {branding?.name || branchName ? (
        <p className="text-base font-medium">{branding?.name ?? branchName}</p>
      ) : null}
      <p className="text-sm">{placeLabel}</p>
      <p className="text-sm text-[var(--guest-quiet)]">{t.poweredBy}</p>
    </div>
  );
}
