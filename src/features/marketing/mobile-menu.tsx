"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { href: string; label: string };

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Phone-width navigation: the section links, sign in and WhatsApp in one sheet under the header. */
export function MobileMenu({
  items,
  signIn,
  whatsapp,
  menuLabel,
  closeLabel,
}: {
  items: Item[];
  signIn: Item;
  whatsapp: Item;
  menuLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-[901px]:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="qw-mobile-menu"
        aria-label={open ? closeLabel : menuLabel}
        className={`grid size-10 place-items-center ${FOCUS}`}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
      </button>
      {open ? (
        <nav
          id="qw-mobile-menu"
          aria-label={menuLabel}
          className="absolute inset-x-0 top-[68px] grid gap-1 border-b border-qw-line bg-canvas px-5 pt-2 pb-5 shadow-[0_18px_30px_rgb(0_0_0/0.08)]"
        >
          {items.map((item) => (
            <a key={item.href} href={item.href} className={`flex min-h-12 items-center text-lg font-semibold ${FOCUS}`} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href={signIn.href} className={`inline-flex min-h-12 items-center justify-center border-2 border-ink text-sm font-semibold ${FOCUS}`}>
              {signIn.label}
            </Link>
            <a
              href={whatsapp.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex min-h-12 items-center justify-center bg-[#1f7a4d] text-sm font-semibold text-white ${FOCUS}`}
            >
              {whatsapp.label}
            </a>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
