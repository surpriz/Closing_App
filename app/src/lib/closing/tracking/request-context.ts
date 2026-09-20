import { createHash } from "node:crypto";

export type RequestContext = {
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  locale: string | null;
  deviceType: "desktop" | "mobile" | "tablet";
  browser: string | null;
  os: string | null;
  referrer: string | null;
  userAgent: string | null;
  isBot: boolean;
  ipHash: string | null;
};

const BOT_PATTERN =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|curl|wget|python-requests/i;

function decode(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toNumber(value: string | null) {
  if (!value) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function parseDevice(ua: string): RequestContext["deviceType"] {
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

function parseBrowser(ua: string) {
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\//i.test(ua)) return "Opera";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/chrome\//i.test(ua)) return "Chrome";
  if (/safari\//i.test(ua)) return "Safari";
  return null;
}

function parseOs(ua: string) {
  if (/windows/i.test(ua)) return "Windows";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/mac os x/i.test(ua)) return "macOS";
  if (/android/i.test(ua)) return "Android";
  if (/linux/i.test(ua)) return "Linux";
  return null;
}

export function parseAcceptLanguage(header: string | null) {
  if (!header) return null;
  const first = header.split(",")[0]?.split(";")[0]?.trim();
  return first || null;
}

export function isValidTimeZone(timeZone: string | undefined | null) {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function hashIp(ip: string | null) {
  const salt = process.env.IP_HASH_SALT;
  if (!ip || !salt) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

// Geo headers are only set on Vercel; they are null in local dev
export function getRequestContext(headers: Headers): RequestContext {
  const ua = headers.get("user-agent") ?? "";
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip");
  const timezone = headers.get("x-vercel-ip-timezone");

  return {
    country: headers.get("x-vercel-ip-country"),
    region: headers.get("x-vercel-ip-country-region"),
    city: decode(headers.get("x-vercel-ip-city")),
    latitude: toNumber(headers.get("x-vercel-ip-latitude")),
    longitude: toNumber(headers.get("x-vercel-ip-longitude")),
    timezone: isValidTimeZone(timezone) ? timezone : null,
    locale: parseAcceptLanguage(headers.get("accept-language")),
    deviceType: parseDevice(ua),
    browser: parseBrowser(ua),
    os: parseOs(ua),
    referrer: headers.get("referer"),
    userAgent: ua || null,
    isBot: !ua || BOT_PATTERN.test(ua),
    ipHash: hashIp(ip),
  };
}
