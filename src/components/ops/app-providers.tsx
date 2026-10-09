"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { LocaleSync } from "@/lib/i18n/locale-sync";
import { getQueryClient } from "@/lib/query-client";

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(getQueryClient);

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>
        <LocaleSync />
        {children}
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
