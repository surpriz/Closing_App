import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SIGNUP_SOURCE_COOKIE, parseSource, serializeSource } from "@/lib/acquisition";
import { LOCALE_COOKIE } from "@/i18n/locale";

import { proxy } from "./proxy";

const rewriteOf = (path: string) =>
  proxy(new NextRequest(`https://app.clozer.club${path}`)).headers.get("x-middleware-rewrite");

describe("proxy", () => {
  it("reads a worded address as its slug", () => {
    expect(rewriteOf("/v/acme-devis-renovation-mHiTw7Wdh4uT")).toBe("https://app.clozer.club/v/mHiTw7Wdh4uT");
  });

  it("keeps the query", () => {
    expect(rewriteOf("/v/acme-mHiTw7Wdh4uT?r=abc")).toBe("https://app.clozer.club/v/mHiTw7Wdh4uT?r=abc");
  });

  it("leaves an older address alone", () => {
    expect(rewriteOf("/v/mHiTw7Wdh4uT")).toBeNull();
  });

  it("still gives the reader a visitor id", () => {
    const response = proxy(new NextRequest("https://app.clozer.club/v/acme-mHiTw7Wdh4uT"));
    expect(response.cookies.getAll().length).toBe(1);
  });

  it("leaves utm params on a proposal link and gives no source cookie", () => {
    const response = proxy(new NextRequest("https://app.clozer.club/v/acme-mHiTw7Wdh4uT?utm_source=x"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://app.clozer.club/v/mHiTw7Wdh4uT?utm_source=x");
    expect(response.cookies.get(SIGNUP_SOURCE_COOKIE)).toBeUndefined();
  });

  it("still takes lang off a proposal link, keeping its utm params", () => {
    const response = proxy(new NextRequest("https://app.clozer.club/v/acme-mHiTw7Wdh4uT?lang=en&utm_source=x"));
    expect(response.headers.get("location")).toBe("https://app.clozer.club/v/acme-mHiTw7Wdh4uT?utm_source=x");
    expect(response.cookies.get(LOCALE_COOKIE)?.value).toBe("en");
    expect(response.cookies.get(SIGNUP_SOURCE_COOKIE)).toBeUndefined();
  });
});

describe("proxy signup source", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("remembers the source params and drops them from the URL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-10T10:00:00Z"));
    const response = proxy(
      new NextRequest("https://app.clozer.club/sign-up?offer=cold-2026-11&utm_source=lemlist&utm_campaign=nov&lang=fr"),
    );
    expect(response.headers.get("location")).toBe("https://app.clozer.club/sign-up");
    expect(parseSource(response.cookies.get(SIGNUP_SOURCE_COOKIE)?.value)).toEqual({
      offer: "cold-2026-11",
      requestedAt: Date.parse("2026-11-10T10:00:00Z"),
      utmSource: "lemlist",
      utmMedium: null,
      utmCampaign: "nov",
      utmContent: null,
    });
    expect(response.cookies.get(LOCALE_COOKIE)?.value).toBe("fr");
  });

  it("keeps the first request time when the callback lands after the deadline", () => {
    const requestedAt = Date.parse("2026-11-30T22:00:00Z");
    const cookie = serializeSource({
      offer: "cold-2026-11",
      requestedAt,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-30T23:30:00Z"));
    const response = proxy(
      new NextRequest("https://app.clozer.club/sign-up?offer=cold-2026-11", {
        headers: { cookie: `${SIGNUP_SOURCE_COOKIE}=${encodeURIComponent(cookie)}` },
      }),
    );
    expect(parseSource(response.cookies.get(SIGNUP_SOURCE_COOKIE)?.value)?.requestedAt).toBe(requestedAt);
  });
});
