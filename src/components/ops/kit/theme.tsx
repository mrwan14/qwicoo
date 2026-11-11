"use client";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { cn } from "cn";
import { useEffect, type CSSProperties, type ReactNode } from "react";

import { useStaffBrandAccent } from "@/components/ops/kit/brand-accent";
import { staffFontClassName } from "@/components/ops/kit/fonts";
import { useLocale } from "@/lib/i18n/locale-store";
import { useStaffDark } from "@/stores/staff-appearance";

/**
 * Scopes the staff tokens and puts the Inter variable on `body` so portaled panels and toasts use it.
 * Also tells Base UI the reading direction, so menus and keyboard arrows mirror in Arabic.
 */
export function StaffTheme({ className, children }: { className?: string; children: ReactNode }) {
  const { dir } = useLocale();
  const dark = useStaffDark();
  const accent = useStaffBrandAccent(dark);
  // Portaled menus, dialogs and toasts read the mode from body.
  useEffect(() => {
    document.body.dataset.staffMode = dark ? "dark" : "light";
    return () => {
      delete document.body.dataset.staffMode;
    };
  }, [dark]);
  useEffect(() => {
    const names = staffFontClassName.split(/\s+/).filter(Boolean);
    document.body.classList.add(...names);
    return () => {
      document.body.classList.remove(...names);
    };
  }, []);

  return (
    <DirectionProvider direction={dir}>
      <div className={cn("staff-theme", staffFontClassName, className)} data-mode={dark ? "dark" : "light"} style={(accent ?? undefined) as CSSProperties | undefined}>
        {children}
      </div>
    </DirectionProvider>
  );
}
