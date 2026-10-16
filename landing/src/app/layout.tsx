import type { Metadata } from "next";
import { Archivo, Geist_Mono } from "next/font/google";

import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
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
  title: "Clozer · Sachez qui lit vos documents, relancez au bon moment",
  description:
    "Devis, factures, présentations, docs techniques : envoyez un lien suivi au lieu de la pièce jointe. Clozer voit les pages lues, vous dit qui relancer et écrit la relance.",
  openGraph: {
    title: "Clozer · Sachez qui lit vos documents, relancez au bon moment",
    description:
      "Devis, factures, présentations : envoyez un lien suivi. Clozer vous dit qui relancer et écrit la relance.",
    url: "https://www.clozer.club",
    siteName: "Clozer",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clozer · Sachez qui lit vos documents, relancez au bon moment",
    description:
      "Devis, factures, présentations : envoyez un lien suivi. Clozer vous dit qui relancer et écrit la relance.",
  },
  // "./" resolves against each route's own path, so the legal pages get their own canonical.
  alternates: { canonical: "./" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${archivo.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
