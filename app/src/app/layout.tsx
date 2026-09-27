import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: { default: "Clozer", template: "%s · Clozer" },
  description: "Suivez qui lit vos devis et relancez au bon moment.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${instrumentSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider delay={200}>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
