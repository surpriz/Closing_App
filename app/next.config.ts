import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Routes had French names before the app went bilingual: old links (emails, bookmarks) keep working
const FRENCH_ROUTES: [string, string][] = [
  ["/comment-ca-marche", "/how-it-works"],
  ["/equipe", "/team"],
  ["/prospection", "/prospecting"],
  ["/suspendu", "/suspended"],
];

const nextConfig: NextConfig = {
  // PostHog through our own domain (/ingest): its endpoints end with a slash
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://eu.i.posthog.com/:path*" },
    ];
  },
  async redirects() {
    return [
      {
        source: "/bienvenue",
        has: [{ type: "query", key: "etape", value: "outil" }],
        destination: "/welcome?step=tool",
        permanent: true,
      },
      { source: "/bienvenue/:path*", destination: "/welcome/:path*", permanent: true },
      {
        source: "/equipe",
        has: [{ type: "query", key: "vendeur", value: "(?<seller>.+)" }],
        destination: "/team?seller=:seller",
        permanent: true,
      },
      ...FRENCH_ROUTES.map(([source, destination]) => ({ source, destination, permanent: true })),
    ];
  },
};

export default withNextIntl(nextConfig);
