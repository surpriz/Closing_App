import type { Metadata } from "next";
import { Bricolage_Grotesque, Newsreader } from "next/font/google";

import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.clozer.club"),
  title: "Clozer — savoir qui lit vraiment votre devis",
  description:
    "Envoyez votre proposition commerciale en lien suivi : page lue, temps passé, retour sur les tarifs. Clozer prépare la relance au bon moment.",
  openGraph: {
    title: "Clozer — savoir qui lit vraiment votre devis",
    description:
      "Envoyez votre proposition commerciale en lien suivi. Clozer prépare la relance au bon moment.",
    url: "https://www.clozer.club",
    siteName: "Clozer",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${bricolage.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full font-body">{children}</body>
    </html>
  );
}
