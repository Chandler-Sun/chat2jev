"use client";

import { ThemeProvider } from "next-themes";
import { LocaleProvider } from "@/components/locale-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <LocaleProvider>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
