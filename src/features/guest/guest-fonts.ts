import localFont from "next/font/local";

import "./guest-fonts.css";

// Self-hosted copies of the Google Fonts files (see src/fonts/README.md). All three are variable fonts.
const guestDisplay = localFont({
  src: "../../fonts/fraunces-latin.woff2",
  weight: "500 700",
  variable: "--font-guest-display",
  fallback: ["Fraunces Fallback"],
  adjustFontFallback: false,
});

const guestBody = localFont({
  src: "../../fonts/inter-latin.woff2",
  weight: "400 700",
  variable: "--font-guest-body",
  fallback: ["Inter Fallback"],
  adjustFontFallback: false,
});

// Google ships Cairo as an Arabic file and a Latin file. next/font/local cannot give each its own
// unicode-range, so they load as two faces and guest-fonts.css joins them into --font-guest-arabic.
const guestArabicScript = localFont({
  src: "../../fonts/cairo-arabic.woff2",
  weight: "400 700",
  variable: "--font-guest-arabic-script",
  // No fallback here: Latin characters must fall through to the Latin face, not to Arial.
  adjustFontFallback: false,
});

const guestArabicLatin = localFont({
  src: "../../fonts/cairo-latin.woff2",
  weight: "400 700",
  variable: "--font-guest-arabic-latin",
  fallback: ["Cairo Fallback"],
  adjustFontFallback: false,
});

/** Shared by the guest layout and the Paymob result page, which lives outside that layout. */
export const guestFontClassName = `guest-fonts ${guestDisplay.variable} ${guestBody.variable} ${guestArabicScript.variable} ${guestArabicLatin.variable}`;
