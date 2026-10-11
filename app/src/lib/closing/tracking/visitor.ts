// Shared by proxy.ts, so keep this file free of Node-only imports

// Anonymous id identifying a browser across views of any link
export const VISITOR_COOKIE = "cv_vid";
// Matches the 12 months the tracking data is kept (retention/purge.ts)
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// Email entered on a link's gate, scoped per link
export function emailCookieName(linkId: string) {
  return `cv_em_${linkId}`;
}
export const EMAIL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
