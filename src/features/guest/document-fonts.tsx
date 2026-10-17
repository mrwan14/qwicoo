"use client";

import { useEffect, type ReactNode } from "react";

/** Puts guest font variables on `body` so portaled toasts can use Cairo and Inter. */
export function GuestDocumentFonts({ className, children }: { className: string; children: ReactNode }) {
  useEffect(() => {
    const names = className.split(/\s+/).filter(Boolean);
    document.body.classList.add(...names);
    return () => {
      document.body.classList.remove(...names);
    };
  }, [className]);

  return <div className={className}>{children}</div>;
}
