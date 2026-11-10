import localFont from "next/font/local";

// Self-hosted (see src/app/layout.tsx): builds don't fetch Google Fonts.
const guestDisplay = localFont({ src: "../../fonts/fraunces.woff2", variable: "--font-guest-display", weight: "100 900", display: "swap" });

const guestBody = localFont({ src: "../../fonts/inter.woff2", variable: "--font-guest-body", weight: "100 900", display: "swap" });

const guestArabic = localFont({ src: "../../fonts/cairo.woff2", variable: "--font-guest-arabic", weight: "200 1000", display: "swap" });

/** Shared by the guest layout and the Paymob result page, which lives outside that layout. */
export const guestFontClassName = `${guestDisplay.variable} ${guestBody.variable} ${guestArabic.variable}`;
