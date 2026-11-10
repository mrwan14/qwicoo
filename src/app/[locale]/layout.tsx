import localFont from "next/font/local";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

// Self-hosted (see src/app/layout.tsx): builds don't fetch Google Fonts.
const guestDisplay = localFont({ src: "../../fonts/nunito.woff2", variable: "--font-guest-display", weight: "200 1000", display: "swap" });

const guestArabic = localFont({ src: "../../fonts/baloo-bhaijaan-2.woff2", variable: "--font-guest-arabic", weight: "400 800", display: "swap" });

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
