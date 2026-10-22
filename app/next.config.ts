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

// Enforced now: what can't break the app. The full policy runs report-only until staging shows no violation.
// Iframes: own document previews (self), seller web pages, Calendly/Cal.com and video players (any https).
const CSP_ENFORCED = "frame-ancestors 'self'; base-uri 'self'; object-src 'none'";
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  // Direct uploads to Blob; browser errors to Sentry (PostHog goes through /ingest, same origin)
  "connect-src 'self' https://vercel.com https://*.blob.vercel-storage.com https://*.sentry.io",
  "frame-src 'self' https:",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera and mic: pitch videos (seller) and voice comments (prospect viewer)
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()" },
  { key: "Content-Security-Policy", value: CSP_ENFORCED },
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
