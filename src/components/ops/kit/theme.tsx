"use client";

import { cn } from "cn";
import { useEffect, type ReactNode } from "react";

import { staffFontClassName } from "@/components/ops/kit/fonts";

/** Scopes the staff tokens and puts the Inter variable on `body` so portaled panels and toasts use it. */
export function StaffTheme({ className, children }: { className?: string; children: ReactNode }) {
  useEffect(() => {
    const names = staffFontClassName.split(/\s+/).filter(Boolean);
    document.body.classList.add(...names);
    return () => {
      document.body.classList.remove(...names);
    };
  }, []);

  return <div className={cn("staff-theme", staffFontClassName, className)}>{children}</div>;
}
