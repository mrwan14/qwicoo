"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { Logo } from "@/components/ops/logo";
import { guestCopy } from "@/features/guest/copy";
import { initials } from "@/lib/auth/scope";
import { accentForeground, mergeGuestBranding, sameBranding } from "@/lib/guest/branding";
import { mediaUrl } from "@/lib/media";
import { useGuest } from "@/stores/guest";

export function useGuestCopy() {
  const locale = useGuest((state) => state.locale);
  const setLocale = useGuest((state) => state.setLocale);
  const dir = locale === "ar" ? "rtl" : "ltr";
  return { t: guestCopy[locale], locale, dir, setLocale };
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

function BrandHeader() {
  const branding = useGuest((state) => state.branding);
  const branchName = useGuest((state) => state.session?.branchName ?? null);
  const [logoFailed, setLogoFailed] = useState(false);
  const name = branding?.name ?? branchName;
  if (!name) return <Logo markClassName="size-7 text-primary" wordClassName="text-2xl" />;

  const logo = branding?.logoUrl && !logoFailed ? mediaUrl(branding.logoUrl) : null;
  return (
    <span className="inline-flex min-w-0 items-center gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-sm font-semibold text-primary">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={name} className="size-full object-contain p-1" onError={() => setLogoFailed(true)} />
        ) : (
          <span aria-hidden>{initials(name)}</span>
        )}
      </span>
      <span className="truncate font-display text-2xl">{name}</span>
    </span>
  );
}

export function GuestShell({ children, neutral = false }: { children: ReactNode; neutral?: boolean }) {
  const { t, locale, dir, setLocale } = useGuestCopy();
  const accent = useGuest((state) => (neutral ? null : (state.branding?.accent ?? null)));

  useEffect(() => {
    void useGuest.persist.rehydrate();
  }, []);

  const style = accent
    ? ({
        "--primary": accent,
        "--primary-foreground": accentForeground(accent),
        "--ring": accent,
      } as CSSProperties)
    : undefined;

  return (
    <div dir={dir} lang={locale} style={style} className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <header className="flex items-center justify-between gap-3 px-4 py-4">
        {neutral ? <Logo markClassName="size-7 text-primary" wordClassName="text-2xl" /> : <BrandHeader />}
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-lg border px-3 text-sm"
          onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
        >
          {t.language}
        </button>
      </header>
      <div className="mx-auto w-full max-w-3xl px-4 py-4 pb-28">{children}</div>
    </div>
  );
}
