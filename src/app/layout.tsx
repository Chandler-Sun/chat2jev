import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader, Source_Sans_3 } from "next/font/google";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/shell";
import { cn } from "@/lib/utils";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source",
});

const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex",
});

export const metadata: Metadata = {
  title: "Chat2Jev",
  description: "Compare classic chat completion with TypeSafe Jev System One · 对照传统 Chat 与 Jev 判断",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={cn(sans.variable, serif.variable, mono.variable)}>
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
