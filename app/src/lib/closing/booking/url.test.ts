import { describe, expect, it } from "vitest";

import { buildBookingTarget, detectBookingProvider, parseBookingUrl, parseOptionalBookingUrl } from "./url";

const HOST = "app.clozer.club";

describe("parseBookingUrl", () => {
  it("accepts https and adds it to a bare domain", () => {
    expect(parseBookingUrl("https://calendly.com/jean/30min")).toBe("https://calendly.com/jean/30min");
    expect(parseBookingUrl("  cal.com/jean ")).toBe("https://cal.com/jean");
  });

  it("refuses anything that is not https", () => {
    expect(parseBookingUrl("http://calendly.com/jean")).toBeNull();
    expect(parseBookingUrl("javascript:alert(1)")).toBeNull();
    expect(parseBookingUrl("ftp://cal.com/jean")).toBeNull();
  });

  it("refuses text, credentials and very long values", () => {
    expect(parseBookingUrl("")).toBeNull();
    expect(parseBookingUrl("mon agenda")).toBeNull();
    expect(parseBookingUrl("agenda")).toBeNull();
    expect(parseBookingUrl("https://user:pass@calendly.com/jean")).toBeNull();
    expect(parseBookingUrl(`https://calendly.com/${"a".repeat(600)}`)).toBeNull();
  });
});

describe("detectBookingProvider", () => {
  const detect = (value: string) => detectBookingProvider(new URL(value));

  it("recognises Calendly and Cal.com cloud", () => {
    expect(detect("https://calendly.com/jean/30min")).toBe("calendly");
    expect(detect("https://www.calendly.com/jean")).toBe("calendly");
    expect(detect("https://cal.com/jean")).toBe("calcom");
    expect(detect("https://app.cal.com/jean/30")).toBe("calcom");
    expect(detect("https://cal.eu/jean")).toBe("calcom");
  });

  it("opens everything else in a tab", () => {
    expect(detect("https://meetings.hubspot.com/jean")).toBe("external");
    expect(detect("https://calendar.app.google/abc")).toBe("external");
    expect(detect("https://cal.acme.com/jean")).toBe("external");
    expect(detect("https://evilcalendly.com/jean")).toBe("external");
    expect(detect("https://calendly.com/")).toBe("external");
  });
});

describe("parseOptionalBookingUrl", () => {
  it("clears on empty, refuses what is not https", () => {
    expect(parseOptionalBookingUrl("  ")).toBeNull();
    expect(parseOptionalBookingUrl("cal.com/jean")).toBe("https://cal.com/jean");
    expect(parseOptionalBookingUrl("http://cal.com/jean")).toBeUndefined();
  });
});

describe("buildBookingTarget", () => {
  const prospect = { name: "Léa Martin", email: "lea@acme.fr" };

  it("frames Calendly with prefill and the embed domain", () => {
    const target = buildBookingTarget("https://calendly.com/jean/30min", prospect, HOST)!;
    expect(target.mode).toBe("embed");
    const url = new URL(target.src);
    expect(url.searchParams.get("name")).toBe("Léa Martin");
    expect(url.searchParams.get("email")).toBe("lea@acme.fr");
    expect(url.searchParams.get("embed_domain")).toBe(HOST);
    expect(url.searchParams.get("embed_type")).toBe("Inline");
    expect(target.tabSrc).toBe("https://calendly.com/jean/30min?name=L%C3%A9a+Martin&email=lea%40acme.fr");
  });

  it("frames Cal.com in our embed namespace", () => {
    const target = buildBookingTarget("https://cal.com/jean/30min", prospect, HOST)!;
    const url = new URL(target.src);
    expect(target).toMatchObject({ provider: "calcom", mode: "embed" });
    expect(url.searchParams.get("name")).toBe("Léa Martin");
    expect(url.searchParams.get("email")).toBe("lea@acme.fr");
    expect(url.searchParams.get("embed")).toBe("clozer");
    expect(url.searchParams.get("embedType")).toBe("inline");
  });

  it("keeps what the seller put in the link", () => {
    const target = buildBookingTarget("https://calendly.com/jean?name=Contact&month=2026-11", prospect, HOST)!;
    const url = new URL(target.src);
    expect(url.searchParams.get("name")).toBe("Contact");
    expect(url.searchParams.get("month")).toBe("2026-11");
    expect(url.searchParams.get("email")).toBe("lea@acme.fr");
  });

  it("skips prefill the gate did not give", () => {
    const url = new URL(buildBookingTarget("https://cal.com/jean", { name: null, email: "  " }, HOST)!.src);
    expect(url.searchParams.has("name")).toBe(false);
    expect(url.searchParams.has("email")).toBe(false);
  });

  it("opens other tools untouched in a new tab", () => {
    expect(buildBookingTarget("https://meetings.hubspot.com/jean", prospect, HOST)).toEqual({
      provider: "external",
      mode: "tab",
      src: "https://meetings.hubspot.com/jean",
      tabSrc: "https://meetings.hubspot.com/jean",
    });
  });

  it("returns null for an invalid stored value", () => {
    expect(buildBookingTarget("http://calendly.com/jean", prospect, HOST)).toBeNull();
  });
});
