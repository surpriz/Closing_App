// Pure helpers for the seller's booking page (Calendly, Cal.com, HubSpot, Google…).
// No network: the page is only framed or opened by the prospect's browser.

export type BookingProvider = "calendly" | "calcom" | "external";

export type BookingTarget = {
  provider: BookingProvider;
  // Framed in the viewer for Calendly and Cal.com, opened in a new tab otherwise
  mode: "embed" | "tab";
  src: string;
  /** Same page, pre-filled, outside the embed: the fallback when the frame stays blank. */
  tabSrc: string;
};

// Namespace given to the Cal.com embed: its messages carry it back
export const CAL_NAMESPACE = "clozer";

export const BOOKING_URL_MAX_LENGTH = 500;

const CALENDLY_HOSTS = ["calendly.com"];
// Cal.com cloud only: a self-hosted instance opens in a new tab
const CALCOM_HOSTS = ["cal.com", "app.cal.com", "cal.eu", "app.cal.eu"];

export const BOOKING_ORIGINS: Record<Exclude<BookingProvider, "external">, string[]> = {
  calendly: CALENDLY_HOSTS.map((h) => `https://${h}`),
  calcom: CALCOM_HOSTS.map((h) => `https://${h}`),
};

/**
 * Normalised booking URL, or null. https only ("calendly.com/x" gets https,
 * "http://…" is refused), no credentials, a real host.
 */
export function parseBookingUrl(input: string): string | null {
  const value = input.trim();
  if (!value || value.length > BOOKING_URL_MAX_LENGTH || /\s/.test(value)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes(".")) return null;
  return url.toString();
}

function host(url: URL) {
  return url.hostname.replace(/^www\./, "").toLowerCase();
}

export function detectBookingProvider(url: URL): BookingProvider {
  const h = host(url);
  // A bare domain is not a scheduling page
  if (url.pathname === "/" || url.pathname === "") return "external";
  if (CALENDLY_HOSTS.includes(h)) return "calendly";
  if (CALCOM_HOSTS.includes(h)) return "calcom";
  return "external";
}

export const BOOKING_URL_ERROR = "Lien de rendez-vous invalide : il doit commencer par https://";

/** A settings field: empty = null (no page), invalid = undefined. */
export function parseOptionalBookingUrl(input: string): string | null | undefined {
  return input.trim() ? (parseBookingUrl(input) ?? undefined) : null;
}

/**
 * URL to show the prospect, pre-filled with what the email gate gave us.
 * Parameters the seller put in the link are kept; ours only fill gaps.
 * `embedHost` is the viewer's host: Calendly only posts events to a page it knows.
 */
export function buildBookingTarget(
  bookingUrl: string,
  prospect: { name?: string | null; email?: string | null },
  embedHost: string,
): BookingTarget | null {
  const parsed = parseBookingUrl(bookingUrl);
  if (!parsed) return null;
  const url = new URL(parsed);
  const provider = detectBookingProvider(url);

  const set = (key: string, value: string | null | undefined) => {
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
  };
  if (provider === "external") return { provider, mode: "tab", src: url.toString(), tabSrc: url.toString() };

  // Calendly and Cal.com both read these
  set("name", prospect.name?.trim());
  set("email", prospect.email?.trim());
  const tabSrc = url.toString();
  if (provider === "calendly") {
    url.searchParams.set("embed_domain", embedHost);
    url.searchParams.set("embed_type", "Inline");
  } else {
    url.searchParams.set("embed", CAL_NAMESPACE);
    url.searchParams.set("embedType", "inline");
  }
  return { provider, mode: "embed", src: url.toString(), tabSrc };
}
