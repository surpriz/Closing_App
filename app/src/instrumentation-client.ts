import { initSentry } from "@/lib/sentry";

// Viewer included: a broken proposal page is the error that matters most
initSentry(process.env.NEXT_PUBLIC_VERCEL_ENV);
