import localFont from "next/font/local";

/** Qwicoo's guest type: IBM Plex Sans for Latin, IBM Plex Sans Arabic for Arabic (same family as the landing page). */
// Self-hosted (see src/app/layout.tsx): builds don't fetch Google Fonts.
const guestLatin = localFont({ src: "../../fonts/plex-sans.woff2", variable: "--font-guest-body", weight: "100 700", display: "swap" });

const guestArabic = localFont({
  src: [
    { path: "../../fonts/plex-sans-arabic-regular.woff2", weight: "400" },
    { path: "../../fonts/plex-sans-arabic-medium.woff2", weight: "500" },
    { path: "../../fonts/plex-sans-arabic-semibold.woff2", weight: "600" },
    { path: "../../fonts/plex-sans-arabic-bold.woff2", weight: "700" },
  ],
  variable: "--font-guest-arabic",
  display: "swap",
});

/** Shared by the guest layout and the Paymob result page, which lives outside that layout. */
export const guestFontClassName = `${guestLatin.variable} ${guestArabic.variable}`;
