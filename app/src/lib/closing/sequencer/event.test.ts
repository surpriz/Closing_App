import { describe, expect, it } from "vitest";

import { parseSequencerEvent, sequencerToken, verifySequencerToken } from "./event";

const none = new URLSearchParams();
const kindOf = (result: ReturnType<typeof parseSequencerEvent>) => (result && result !== "ignored" ? result.kind : result);

describe("parseSequencerEvent", () => {
  it("reads the documented shape", () => {
    expect(parseSequencerEvent({ email: "Paul@Acme.fr", event: "replied", text: "Oui, appelons-nous" }, none)).toEqual({
      email: "paul@acme.fr",
      kind: "replied",
      excerpt: "Oui, appelons-nous",
    });
  });

  it("reads the nested lead objects tools post, and takes no event as a reply", () => {
    expect(kindOf(parseSequencerEvent({ lead: { email: "paul@acme.fr" } }, none))).toBe("replied");
    expect(kindOf(parseSequencerEvent({ contact: { email: "paul@acme.fr" }, type: "emailsBounced" }, none))).toBe("bounced");
    expect(kindOf(parseSequencerEvent({ email: "paul@acme.fr", event: "Opt-Out" }, none))).toBe("unsubscribed");
  });

  it("falls back on the query string for tools that only call a URL", () => {
    expect(kindOf(parseSequencerEvent(null, new URLSearchParams("email=paul@acme.fr&event=unsubscribed")))).toBe(
      "unsubscribed",
    );
  });

  it("takes the reply's sender, never its recipient (the seller)", () => {
    expect(parseSequencerEvent({ from: "paul@acme.fr", to: "seller@clozer.club" }, none)).toMatchObject({
      email: "paul@acme.fr",
    });
    expect(parseSequencerEvent({ to: "seller@clozer.club", event: "replied" }, none)).toBeNull();
  });

  it("ignores events Clozer does not act on, and needs an address", () => {
    expect(parseSequencerEvent({ email: "paul@acme.fr", event: "opened" }, none)).toBe("ignored");
    expect(parseSequencerEvent({ event: "replied" }, none)).toBeNull();
    expect(parseSequencerEvent({ email: "{{email}}" }, none)).toBeNull();
  });
});

describe("sequencerToken", () => {
  const secret = "s".repeat(32);

  it("gives back the workspace and version it was made for", () => {
    expect(verifySequencerToken(sequencerToken("org_1", 3, secret), secret)).toEqual({ organizationId: "org_1", version: 3 });
  });

  it("refuses this signature on another workspace or another version", () => {
    const [, , signature] = sequencerToken("org_1", 0, secret).split(".");
    expect(verifySequencerToken(`org_2.0.${signature}`, secret)).toBeNull();
    expect(verifySequencerToken(`org_1.1.${signature}`, secret)).toBeNull();
    expect(verifySequencerToken("org_1", secret)).toBeNull();
  });
});
