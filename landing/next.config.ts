import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// The French pages lived at the root before the site went bilingual. Those URLs are in emails,
// the app and the store listings, so they move for good to their /fr equivalent.
const LEGACY_FRENCH_PAGES = ["/cgu", "/confidentialite", "/mentions-legales", "/sous-traitants", "/support"];

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
        source: "/:path*",
        has: [{ type: "host", value: "clozer.club" }],
        destination: "https://www.clozer.club/:path*",
        permanent: true,
      },
      ...LEGACY_FRENCH_PAGES.map((source) => ({ source, destination: `/fr${source}`, statusCode: 301 as const })),
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
