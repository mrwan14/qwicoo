import localFont from "next/font/local";

/** Staff body font. Page titles use Fraunces, already loaded by the root layout. */
// Self-hosted copy of the Google Fonts file (see src/fonts/README.md). Inter is a variable font.
const staffBody = localFont({
  src: "../../../fonts/inter-latin.woff2",
  weight: "400 600",
  variable: "--font-staff-body",
  fallback: ["Inter Fallback"],
  adjustFontFallback: false,
});

export const staffFontClassName = staffBody.variable;
