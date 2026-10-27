import { Inter } from "next/font/google";

/** Staff body font. Page titles use Fraunces, already loaded by the root layout. */
const staffBody = Inter({
  variable: "--font-staff-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const staffFontClassName = staffBody.variable;
