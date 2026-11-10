import localFont from "next/font/local";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

// Self-hosted copies of the Google Fonts files (see src/fonts/README.md). Both are variable fonts.
const guestDisplay = localFont({
  src: "../../fonts/nunito-latin.woff2",
  weight: "600 800",
  variable: "--font-guest-display",
  fallback: ["Nunito Fallback"],
  adjustFontFallback: false,
});

const guestArabic = localFont({
  src: "../../fonts/baloo-bhaijaan-2-arabic.woff2",
  weight: "400 700",
  variable: "--font-guest-arabic",
  fallback: ["Baloo Bhaijaan 2 Fallback"],
  adjustFontFallback: false,
});

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "ar" }];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== "en" && locale !== "ar") notFound();
  return <div className={`${guestDisplay.variable} ${guestArabic.variable}`}>{children}</div>;
}
