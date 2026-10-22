const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

// Audience measurement with no cookie and no storage: an anonymous id per page load.
// Loaded after the page, through /ingest on our own domain (rewrites in next.config.ts).
if (key) {
  void import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: "/ingest",
      ui_host: "https://eu.posthog.com",
      persistence: "memory",
      person_profiles: "identified_only",
      capture_pageview: "history_change",
      disable_session_recording: true,
    });
  });
}
