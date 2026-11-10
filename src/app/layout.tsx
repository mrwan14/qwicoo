import type { Metadata } from "next";
import localFont from "next/font/local";

import { AppProviders } from "@/components/ops/app-providers";

import "../fonts/fallbacks.css";
import "./globals.css";

// Self-hosted copies of the Google Fonts files (see src/fonts/README.md), so builds never fetch from Google.
// Each falls back to a face in src/fonts/fallbacks.css with the metrics next/font/google used.
const geistSans = localFont({
  src: "../fonts/geist-latin.woff2",
  weight: "100 900",
  variable: "--font-geist-sans",
  fallback: ["Geist Fallback"],
  adjustFontFallback: false,
});

const geistMono = localFont({
  src: "../fonts/geist-mono-latin.woff2",
  weight: "100 900",
  variable: "--font-geist-mono",
  fallback: ["Geist Mono Fallback"],
  adjustFontFallback: false,
});

const fraunces = localFont({
  src: "../fonts/fraunces-latin.woff2",
  weight: "100 900",
  variable: "--font-fraunces",
  fallback: ["Fraunces Fallback"],
  adjustFontFallback: false,
});

const archivo = localFont({
  src: "../fonts/archivo-black-latin-400.woff2",
  weight: "400",
  variable: "--font-archivo",
  fallback: ["Archivo Black Fallback"],
  adjustFontFallback: false,
});

const plexArabic = localFont({
  src: [
    { path: "../fonts/ibm-plex-sans-arabic-arabic-400.woff2", weight: "400" },
    { path: "../fonts/ibm-plex-sans-arabic-arabic-500.woff2", weight: "500" },
    { path: "../fonts/ibm-plex-sans-arabic-arabic-600.woff2", weight: "600" },
    { path: "../fonts/ibm-plex-sans-arabic-arabic-700.woff2", weight: "700" },
  ],
  variable: "--font-plex-arabic",
  fallback: ["IBM Plex Sans Arabic Fallback"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: {
    default: "Qwicoo",
    template: "%s · Qwicoo",
  },
  description: "Qwicoo staff tools and guest ordering.",
  appleWebApp: { capable: true, title: "Qwicoo", statusBarStyle: "default" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${archivo.variable} ${plexArabic.variable}`}
    >
      <body className="min-h-dvh antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var raw=localStorage.getItem("qwicoo-locale");if(!raw)return;var locale=JSON.parse(raw).state.locale;if(locale!=="ar"&&locale!=="en")return;var root=document.documentElement;root.lang=locale;root.dir=locale==="ar"?"rtl":"ltr";}catch(e){}})();`,
          }}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
