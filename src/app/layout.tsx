import type { Metadata } from "next";
import localFont from "next/font/local";

import { AppProviders } from "@/components/ops/app-providers";

import "./globals.css";

// Fonts are self-hosted from src/fonts (Latin, plus Arabic where needed) so builds never fetch
// Google Fonts: Next 15's next/font/google breaks on Google's extensionless /l/font URLs.
const geistSans = localFont({ src: "../fonts/geist.woff2", variable: "--font-geist-sans", weight: "100 900", display: "swap" });

const geistMono = localFont({ src: "../fonts/geist-mono.woff2", variable: "--font-geist-mono", weight: "100 900", display: "swap" });

const fraunces = localFont({ src: "../fonts/fraunces.woff2", variable: "--font-fraunces", weight: "100 900", display: "swap" });

const archivo = localFont({ src: "../fonts/archivo-black-regular.woff2", variable: "--font-archivo", weight: "400", display: "swap" });

const plexArabic = localFont({
  src: [
    { path: "../fonts/plex-sans-arabic-regular.woff2", weight: "400" },
    { path: "../fonts/plex-sans-arabic-medium.woff2", weight: "500" },
    { path: "../fonts/plex-sans-arabic-semibold.woff2", weight: "600" },
    { path: "../fonts/plex-sans-arabic-bold.woff2", weight: "700" },
  ],
  variable: "--font-plex-arabic",
  display: "swap",
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
