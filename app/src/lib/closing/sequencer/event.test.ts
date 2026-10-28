import { describe, expect, it } from "vitest";

import { parseSequencerEvent, sequencerToken, verifySequencerToken } from "./event";

const none = new URLSearchParams();

describe("parseSequencerEvent", () => {
  it("reads the documented shape", () => {
    expect(parseSequencerEvent({ email: "Paul@Acme.fr", event: "replied", text: "Oui, appelons-nous" }, none)).toEqual({
      email: "paul@acme.fr",
      kind: "replied",
      excerpt: "Oui, appelons-nous",
    });
  });

  it("reads the nested lead objects tools post, and takes no event as a reply", () => {
    expect(parseSequencerEvent({ lead: { email: "paul@acme.fr" } }, none)?.kind).toBe("replied");
    expect(parseSequencerEvent({ contact: { email: "paul@acme.fr" }, type: "emailsBounced" }, none)?.kind).toBe("bounced");
    expect(parseSequencerEvent({ email: "paul@acme.fr", event: "Opt-Out" }, none)?.kind).toBe("unsubscribed");
  });

  it("falls back on the query string for tools that only call a URL", () => {
    expect(parseSequencerEvent(null, new URLSearchParams("email=paul@acme.fr&event=unsubscribed"))?.kind).toBe(
      "unsubscribed",
    );
  });

  it("ignores events Clozer does not act on, and a missing address", () => {
    expect(parseSequencerEvent({ email: "paul@acme.fr", event: "opened" }, none)).toBeNull();
    expect(parseSequencerEvent({ event: "replied" }, none)).toBeNull();
    expect(parseSequencerEvent({ email: "{{email}}" }, none)).toBeNull();
  });
});

describe("sequencerToken", () => {
  const secret = "s".repeat(32);

  it("gives back the workspace it was made for", () => {
    expect(verifySequencerToken(sequencerToken("org_1", secret), secret)).toBe("org_1");
  });

  it("refuses another workspace's id with this signature", () => {
    const [, signature] = sequencerToken("org_1", secret).split(".");
    expect(verifySequencerToken(`org_2.${signature}`, secret)).toBeNull();
    expect(verifySequencerToken("org_1", secret)).toBeNull();
  });
});
