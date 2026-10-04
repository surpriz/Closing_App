import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans } from "next/font/google";

import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.clozer.club"),
  title: "Clozer — savoir qui lit vraiment votre devis",
  description:
    "Envoyez votre proposition en lien suivi : pages lues, temps passé, retour sur les tarifs. Clozer vous dit qui relancer, et prépare le message.",
  openGraph: {
    title: "Clozer — savoir qui lit vraiment votre devis",
    description:
      "Envoyez votre proposition en lien suivi. Clozer vous dit qui relancer, et prépare le message.",
    url: "https://www.clozer.club",
    siteName: "Clozer",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${instrumentSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
