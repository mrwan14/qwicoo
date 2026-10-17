import { Cairo, Fraunces, Inter } from "next/font/google";

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

/** Shared by the guest layout and the Paymob result page, which lives outside that layout. */
export const guestFontClassName = `${guestDisplay.variable} ${guestBody.variable} ${guestArabic.variable}`;
