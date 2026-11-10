import localFont from "next/font/local";

/** Staff body font. Page titles use Fraunces, already loaded by the root layout. */
// Self-hosted (see src/app/layout.tsx): builds don't fetch Google Fonts.
const staffBody = localFont({ src: "../../../fonts/inter.woff2", variable: "--font-staff-body", weight: "100 900", display: "swap" });

export const staffFontClassName = staffBody.variable;
