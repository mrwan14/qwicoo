import { Baloo_Bhaijaan_2, Nunito } from "next/font/google";
import { notFound } from "next/navigation";
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
