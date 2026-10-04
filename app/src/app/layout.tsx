import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans } from "next/font/google";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Clozer", template: "%s · Clozer" },
  description: "Suivez qui consulte vos documents et relancez au bon moment.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${instrumentSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <TooltipProvider delay={200}>{children}</TooltipProvider>
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
