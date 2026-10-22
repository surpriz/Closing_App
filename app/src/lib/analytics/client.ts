import type { PostHog } from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

// Pages a prospect opens (a proposal, an unsubscribe link): never measured
const PROSPECT_PATH = /^\/(v|u)(\/|$)/;

export function isProspectPath(pathname: string) {
  return PROSPECT_PATH.test(pathname);
}

function fromProspectPage(url: unknown) {
  try {
    return isProspectPath(new URL(String(url)).pathname);
  } catch {
    return false;
  }
}

let loading: Promise<PostHog | null> | undefined;

/**
 * PostHog, loaded on first use so the viewer never ships it. No cookie, no
 * storage: an anonymous id per page load, tied to the seller once identified.
 * Sent through /ingest on our own domain (rewrites in next.config.ts).
 */
export function loadAnalytics() {
  if (!KEY) return Promise.resolve(null);
  loading ??= import("posthog-js").then(({ default: posthog }) => {
    posthog.init(KEY, {
      api_host: "/ingest",
      ui_host: "https://eu.posthog.com",
      persistence: "memory",
      person_profiles: "identified_only",
      capture_pageview: "history_change",
      // Buttons carry prospect names and companies: only pageviews and named events
      autocapture: false,
      disable_session_recording: true,
      before_send: (event) => (event && fromProspectPage(event.properties.$current_url) ? null : event),
    });
    return posthog;
  });
  return loading;
}
