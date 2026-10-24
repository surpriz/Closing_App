import { describe, expect, it } from "vitest";

import { appendSource, mergeSource, parseSource, serializeSource, signupOffer, sourceFromParams, workspaceSourceData, workspaceSourceEvent } from "./acquisition";
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

describe("mergeSource", () => {
  it("keeps the request time when the callback lands after the deadline", () => {
    const merged = mergeSource(src("2026-11-30T22:58:00Z"), src("2026-11-30T23:05:00Z"));
    expect(merged.requestedAt).toBe(at("2026-11-30T22:58:00Z").getTime());
    expect(signupOffer(merged, at("2026-11-30T23:05:00Z"))?.code).toBe("cold-2026-11");
  });

  it("lets a returning visitor start a fresh 24 h window", () => {
    const merged = mergeSource(src("2026-11-10T10:00:00Z"), src("2026-11-11T09:00:00Z"));
    expect(merged.requestedAt).toBe(at("2026-11-11T09:00:00Z").getTime());
    expect(signupOffer(merged, at("2026-11-11T10:30:00Z"))?.code).toBe("cold-2026-11");
  });

  it("takes utm values from the incoming source", () => {
    const incoming = { ...src("2026-11-30T23:05:00Z"), utmSource: "new" };
    expect(mergeSource({ ...src("2026-11-30T22:58:00Z"), utmSource: "old" }, incoming).utmSource).toBe("new");
  });

  it("takes the incoming source for another offer, an unknown offer or no cookie", () => {
    const incoming = src("2026-11-30T23:05:00Z");
    expect(mergeSource(src("2026-11-30T22:58:00Z", "other"), incoming)).toEqual(incoming);
    expect(mergeSource(null, incoming)).toEqual(incoming);
    const unknown = src("2026-11-30T23:05:00Z", "nope");
    expect(mergeSource(src("2026-11-30T22:58:00Z", "nope"), unknown)).toEqual(unknown);
  });
});

describe("workspaceSourceData", () => {
  const now = at("2026-11-10T10:00:00Z");

  it("gives a campaign signup its offer, its trial length and its source", () => {
    const cold = sourceFromParams(new URLSearchParams({ offer: "cold-2026-11", utm_source: "lemlist" }), now);
    expect(workspaceSourceData(cold, now)).toMatchObject({
      offerCode: "cold-2026-11",
      acquisitionSource: "lemlist",
      trialEndsAt: at("2026-12-10T10:00:00Z"),
    });
  });

  it("falls back to the standard trial without a source", () => {
    expect(workspaceSourceData(null, now)).toEqual({
      trialEndsAt: at("2026-11-24T10:00:00Z"),
      offerCode: null,
      acquisitionSource: null,
      acquisitionMedium: null,
      acquisitionCampaign: null,
      acquisitionContent: null,
    });
  });

  it("keeps the source but drops the offer once it is over", () => {
    const later = at("2026-12-01T10:00:00Z");
    const late = sourceFromParams(new URLSearchParams({ offer: "cold-2026-11", utm_source: "lemlist" }), later);
    expect(workspaceSourceData(late, later)).toMatchObject({
      offerCode: null,
      acquisitionSource: "lemlist",
      trialEndsAt: trialEndsAtFor(later),
    });
  });
});

describe("workspaceSourceEvent", () => {
  const now = at("2026-11-10T10:00:00Z");

  it("reports the granted offer and tags the person", () => {
    const source = sourceFromParams(new URLSearchParams({ offer: "cold-2026-11", utm_source: "lemlist", utm_campaign: "nov" }), now)!;
    expect(workspaceSourceEvent(source, now)).toEqual({
      offer: "cold-2026-11",
      utm_source: "lemlist",
      utm_medium: null,
      utm_campaign: "nov",
      utm_content: null,
      $set: { offer: "cold-2026-11", acquisition_source: "lemlist", acquisition_campaign: "nov" },
    });
  });

  it("sends a null offer once it is over but keeps the utm values", () => {
    const later = at("2026-12-01T10:00:00Z");
    const late = sourceFromParams(new URLSearchParams({ offer: "cold-2026-11", utm_source: "lemlist" }), later)!;
    expect(workspaceSourceEvent(late, later)).toMatchObject({
      offer: null,
      utm_source: "lemlist",
      $set: { offer: null, acquisition_source: "lemlist" },
    });
  });
});
