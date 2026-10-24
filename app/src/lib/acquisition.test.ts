import { describe, expect, it } from "vitest";

import { appendSource, parseSource, serializeSource, signupOffer, sourceFromParams } from "./acquisition";
import { trialEndsAtFor } from "./billing/plans";

const at = (iso: string) => new Date(iso);
const src = (requested: string, offer = "cold-2026-11") =>
  sourceFromParams(new URLSearchParams({ offer }), at(requested))!;

describe("signupOffer", () => {
  it("honours a request made before the deadline, even if signup lands after it", () => {
    expect(signupOffer(src("2026-11-30T22:58:00Z"), at("2026-11-30T23:05:00Z"))?.code).toBe("cold-2026-11");
  });

  it("refuses a request made after the deadline", () => {
    expect(signupOffer(src("2026-11-30T23:01:00Z"), at("2026-11-30T23:02:00Z"))).toBeNull();
  });

  it("refuses a source older than 24 h", () => {
    expect(signupOffer(src("2026-11-10T10:00:00Z"), at("2026-11-11T10:00:01Z"))).toBeNull();
    expect(signupOffer(src("2026-11-10T10:00:00Z"), at("2026-11-11T10:00:00Z"))?.code).toBe("cold-2026-11");
  });

  it("refuses a forged code or no source", () => {
    expect(signupOffer(src("2026-11-10T10:00:00Z", "forged"), at("2026-11-10T10:01:00Z"))).toBeNull();
    expect(signupOffer(null, at("2026-11-10T10:01:00Z"))).toBeNull();
  });
});

describe("sourceFromParams / serialize / parse", () => {
  it("trims and cuts values to 100 chars, and round-trips", () => {
    const long = sourceFromParams(new URLSearchParams({ utm_campaign: "x".repeat(300) }), at("2026-11-10T10:00:00Z"))!;
    expect(long.utmCampaign).toHaveLength(100);
    expect(parseSource(serializeSource(long))).toEqual(long);
  });

  it("ignores unrelated params", () => {
    expect(sourceFromParams(new URLSearchParams({ email: "a@b.fr" }), at("2026-11-10T10:00:00Z"))).toBeNull();
  });

  it("rejects garbage, undefined and a missing or non-numeric timestamp", () => {
    expect(parseSource("garbage")).toBeNull();
    expect(parseSource(undefined)).toBeNull();
    expect(parseSource("offer=cold-2026-11")).toBeNull();
    expect(parseSource("offer=cold-2026-11&t=abc")).toBeNull();
  });
});

describe("appendSource", () => {
  it("adds the offer to a bare path", () => {
    expect(appendSource("/dashboard", src("2026-11-10T10:00:00Z"))).toBe("/dashboard?offer=cold-2026-11");
  });

  it("merges with an existing query and never emits t", () => {
    const full = sourceFromParams(
      new URLSearchParams({ offer: "cold-2026-11", utm_source: "lemlist", utm_content: "a b" }),
      at("2026-11-10T10:00:00Z"),
    )!;
    const out = appendSource("/dashboard?tab=x", full);
    expect(out).toBe("/dashboard?tab=x&offer=cold-2026-11&utm_source=lemlist&utm_content=a+b");
    expect(out).not.toContain("t=2");
  });

  it("emits only params present in the source", () => {
    const utmOnly = sourceFromParams(new URLSearchParams({ utm_medium: "email" }), at("2026-11-10T10:00:00Z"))!;
    expect(appendSource("/x", utmOnly)).toBe("/x?utm_medium=email");
  });
});

describe("trialEndsAtFor", () => {
  it("takes an optional number of days", () => {
    expect(trialEndsAtFor(at("2026-11-10T00:00:00Z"), 30).toISOString()).toBe("2026-12-10T00:00:00.000Z");
    expect(trialEndsAtFor(at("2026-11-10T00:00:00Z")).toISOString()).toBe("2026-11-24T00:00:00.000Z");
  });
});
