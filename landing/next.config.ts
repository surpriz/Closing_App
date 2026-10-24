import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// The French pages lived at the root before the site went bilingual. Those URLs are in emails,
// the app and the store listings, so they move for good to their /fr equivalent.
const LEGACY_FRENCH_PAGES = ["/cgu", "/confidentialite", "/mentions-legales", "/sous-traitants", "/support"];

// The full policy runs report-only until production shows no violation
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
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
