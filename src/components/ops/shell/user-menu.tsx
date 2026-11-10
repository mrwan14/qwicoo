"use client";

import { Check, Languages, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ops/kit/confirm-dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ops/kit/menu";
import { useStaffSession } from "@/components/ops/staff-session";
import { roleLabel } from "@/lib/auth/roles";
import { initials } from "@/lib/auth/scope";
import { endStaffSession } from "@/lib/auth/session-client";
import { useLocale } from "@/lib/i18n/locale-store";
import { shellCopy } from "@/lib/i18n/staff/shell";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useStaffAppearance, type StaffAppearance } from "@/stores/staff-appearance";

/** Sign-out confirmation, shared by the admin user menu and the front-line bar. */
export function useLogOut() {
  const t = useStaffSection(shellCopy);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const dialog = (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title={t.logOutTitle}
      body={t.logOutBody}
      confirmLabel={t.logOut}
      pending={pending}
      onConfirm={() => {
        setPending(true);
        void endStaffSession();
      }}
    />
  );
  return { ask: () => setOpen(true), dialog };
}

/** "العربية" in English and "English" in Arabic, like the old header switch. */
export function useLocaleToggle() {
  const { locale, setLocale } = useLocale();
  return {
    label: locale === "ar" ? "English" : "العربية",
    lang: locale === "ar" ? "en" : "ar",
    toggle: () => setLocale(locale === "ar" ? "en" : "ar"),
  };
}

export function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-border text-xs font-semibold text-ink">
      {initials(name)}
    </span>
  );
}

export function UserMenu() {
  const t = useStaffSection(shellCopy);
  const me = useStaffSession();
  const locale = useLocaleToggle();
  const { ask, dialog } = useLogOut();
  if (!me) return null;
  return (
    <>
      <Menu>
        <MenuTrigger
          aria-label={`${t.account}: ${me.full_name}`}
          className="flex min-h-[42px] items-center gap-2.5 rounded-staff px-1.5 text-start outline-none hover:bg-well focus-visible:outline-2 focus-visible:outline-focus data-popup-open:bg-well"
        >
          <Avatar name={me.full_name} />
          <span className="hidden min-w-0 md:grid">
            <span className="truncate text-[13px] font-medium text-ink">{me.full_name}</span>
            <span className="truncate text-xs text-ink-secondary">{roleLabel(me.role)}</span>
          </span>
        </MenuTrigger>
        <MenuContent>
          <div className="grid gap-0.5 px-2.5 pt-2 pb-2">
            <span className="truncate text-sm font-semibold text-ink">{me.full_name}</span>
            <span className="truncate text-xs text-ink-secondary rtl:text-right" dir="ltr">
              {me.email}
            </span>
          </div>
          <MenuSeparator />
          <MenuItem onClick={locale.toggle}>
            <Languages aria-hidden />
            <span lang={locale.lang}>{locale.label}</span>
          </MenuItem>
          <MenuSeparator />
          <AppearanceItems />
          <MenuSeparator />
          <MenuItem onClick={ask}>
            <LogOut aria-hidden className="rtl:-scale-x-100" />
            {t.logOut}
          </MenuItem>
        </MenuContent>
      </Menu>
      {dialog}
    </>
  );
}

const APPEARANCE: { mode: StaffAppearance; icon: typeof Sun }[] = [
  { mode: "light", icon: Sun },
  { mode: "dark", icon: Moon },
  { mode: "system", icon: Monitor },
];

/** Light, dark or the device's own setting. Saved on this device for this person. */
function AppearanceItems() {
  const t = useStaffSection(shellCopy);
  const mode = useStaffAppearance((state) => state.mode);
  const setMode = useStaffAppearance((state) => state.setMode);
  const labels: Record<StaffAppearance, string> = { light: t.appearanceLight, dark: t.appearanceDark, system: t.appearanceSystem };
  return (
    <div role="group" aria-label={t.appearance}>
      <div className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-ink-secondary">{t.appearance}</div>
      {APPEARANCE.map(({ mode: value, icon: Icon }) => (
        <MenuItem key={value} closeOnClick={false} aria-checked={mode === value} role="menuitemradio" onClick={() => setMode(value)}>
          <Icon aria-hidden />
          <span className="flex-1">{labels[value]}</span>
          {mode === value ? <Check aria-hidden className="size-4" /> : null}
        </MenuItem>
      ))}
    </div>
  );
}
