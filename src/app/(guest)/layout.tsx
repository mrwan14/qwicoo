import { Nunito, Baloo_Bhaijaan_2 } from "next/font/google";
import type { ReactNode } from "react";

const guestDisplay = Nunito({
  variable: "--font-guest-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const guestArabic = Baloo_Bhaijaan_2({
  variable: "--font-guest-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

/** Guest-route fonts only — does not affect staff or landing. */
export default function GuestLayout({ children }: { children: ReactNode }) {
  return <div className={`${guestDisplay.variable} ${guestArabic.variable}`}>{children}</div>;
}
