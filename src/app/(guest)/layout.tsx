import { Cairo, Fraunces, Inter } from "next/font/google";
import type { ReactNode } from "react";

import { GuestDocumentFonts } from "@/features/guest/document-fonts";

const guestDisplay = Fraunces({
  variable: "--font-guest-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const guestBody = Inter({
  variable: "--font-guest-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const guestArabic = Cairo({
  variable: "--font-guest-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

/** Guest-route fonts only — does not affect staff or landing. */
export default function GuestLayout({ children }: { children: ReactNode }) {
  const fonts = `${guestDisplay.variable} ${guestBody.variable} ${guestArabic.variable}`;
  return <GuestDocumentFonts className={fonts}>{children}</GuestDocumentFonts>;
}
