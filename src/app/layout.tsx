import type { Metadata } from "next";
import { Archivo_Black, Fraunces, Geist, Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";

import { AppProviders } from "@/components/ops/app-providers";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const archivo = Archivo_Black({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: "400",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
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
