import * as Sentry from "@sentry/nextjs";

/**
 * Errors only, server and browser. Nothing about people: Sentry collects cookies,
 * headers, bodies and stack variables by default, and those carry prospects' data.
 * No-op without a DSN (dev, tests).
 */
export function initSentry(environment: string | undefined) {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: 0,
    // Not our code: blob: workers come from extensions wrapping Worker (we create none,
    // pdf.js falls back to its fake worker), _next-live/feedback is the Vercel Toolbar
    denyUrls: [/^blob:/, /\/_next-live\/feedback\//],
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
      genAI: { inputs: false, outputs: false },
    },
  });
}
