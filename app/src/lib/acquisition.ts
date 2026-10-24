import { DAY_MS } from "@/lib/closing/constants";
import { trialEndsAtFor } from "@/lib/billing/plans";
import { offerFor, type Offer } from "@/lib/billing/offers";

export type SignupSource = {
  offer: string | null;
  /** When the visitor landed with the offer, ms since epoch. */
  requestedAt: number;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
};

export const SIGNUP_SOURCE_COOKIE = "clozer_signup_source";
export const SIGNUP_SOURCE_MAX_AGE = 86400;

export const SOURCE_PARAMS = ["offer", "utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

const MAX_VALUE_LENGTH = 100;

const FIELD_BY_PARAM = {
  offer: "offer",
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_content: "utmContent",
} as const;

function clean(value: string | null): string | null {
  const trimmed = value?.trim().slice(0, MAX_VALUE_LENGTH);
  return trimmed ? trimmed : null;
}

/** The offer code is kept as given: signupOffer decides whether it is real. */
export function sourceFromParams(params: URLSearchParams, now: Date): SignupSource | null {
  const source: SignupSource = {
    offer: null,
    requestedAt: now.getTime(),
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
  };
  let found = false;
  for (const param of SOURCE_PARAMS) {
    const value = clean(params.get(param));
    if (value) {
      source[FIELD_BY_PARAM[param]] = value;
      found = true;
    }
  }
  return found ? source : null;
}

export function serializeSource(source: SignupSource): string {
  const params = new URLSearchParams();
  for (const param of SOURCE_PARAMS) {
    const value = source[FIELD_BY_PARAM[param]];
    if (value) params.set(param, value);
  }
  params.set("t", String(source.requestedAt));
  return params.toString();
}

export function parseSource(value: string | undefined): SignupSource | null {
  if (!value) return null;
  const params = new URLSearchParams(value);
  const t = params.get("t");
  if (!t || !/^\d+$/.test(t)) return null;
  const source: SignupSource = {
    offer: null,
    requestedAt: Number(t),
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
  };
  for (const param of SOURCE_PARAMS) source[FIELD_BY_PARAM[param]] = clean(params.get(param));
  return source;
}

/**
 * Rescues one case: requested before the offer deadline, callback landing after it.
 * Anything else, including a returning visitor, takes the incoming source whole.
 */
export function mergeSource(existing: SignupSource | null, incoming: SignupSource): SignupSource {
  const offer = offerFor(incoming.offer);
  if (
    existing &&
    offer &&
    existing.offer === incoming.offer &&
    existing.requestedAt <= offer.signupDeadline.getTime() &&
    incoming.requestedAt > offer.signupDeadline.getTime()
  ) {
    return { ...incoming, requestedAt: existing.requestedAt };
  }
  return incoming;
}

/** Carries the source through a redirect on a relative path; never emits the timestamp. */
export function appendSource(path: string, source: SignupSource): string {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  for (const param of SOURCE_PARAMS) {
    const value = source[FIELD_BY_PARAM[param]];
    if (value) params.set(param, value);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** The offer is judged on when it was requested, so a signup can finish just after the deadline. */
export function signupOffer(source: SignupSource | null, now: Date): Offer | null {
  if (!source) return null;
  const offer = offerFor(source.offer);
  if (!offer) return null;
  if (source.requestedAt > offer.signupDeadline.getTime()) return null;
  if (now.getTime() - source.requestedAt > DAY_MS) return null;
  return offer;
}

/** What a new workspace stores from its source: the trial it gets and where it came from. */
export function workspaceSourceData(source: SignupSource | null, now: Date) {
  const offer = signupOffer(source, now);
  return {
    trialEndsAt: trialEndsAtFor(now, offer?.trialDays),
    offerCode: offer?.code ?? null,
    acquisitionSource: source?.utmSource ?? null,
    acquisitionMedium: source?.utmMedium ?? null,
    acquisitionCampaign: source?.utmCampaign ?? null,
    acquisitionContent: source?.utmContent ?? null,
  };
}
