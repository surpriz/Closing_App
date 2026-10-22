import { captureRequestError } from "@sentry/nextjs";

import { initSentry } from "@/lib/sentry";

export function register() {
  initSentry(process.env.VERCEL_ENV);
}

export const onRequestError = captureRequestError;
