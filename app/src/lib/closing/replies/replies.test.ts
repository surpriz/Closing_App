import { describe, expect, it } from "vitest";

import { parseReplyAddress, replyAddress } from "./address";
import { isProspectSide, senderAuthenticated } from "./inbound";
import { isAutoReply, replyExcerpt } from "./text";

const secret = "a-test-secret-that-is-long-enough-123";

describe("reply relay addresses", () => {
  it("round-trips the follow-up id, whatever the case the mail server keeps", () => {
    const address = replyAddress("cmabc123def456ghi789", "reply.clozer.club", secret);
    expect(address).toMatch(/^r-cmabc123def456ghi789\.[0-9a-f]{12}@reply\.clozer\.club$/);
    expect(parseReplyAddress(address, "reply.clozer.club", secret)).toBe("cmabc123def456ghi789");
    expect(parseReplyAddress(address.toUpperCase(), "reply.clozer.club", secret)).toBe("cmabc123def456ghi789");
  });

  it("rejects a forged or foreign address", () => {
    const address = replyAddress("cmabc123def456ghi789", "reply.clozer.club", secret);
    expect(parseReplyAddress(address.replace("cmabc", "cmxyz"), "reply.clozer.club", secret)).toBeNull();
    expect(parseReplyAddress(address, "other.club", secret)).toBeNull();
    expect(parseReplyAddress("seller@acme.fr", "reply.clozer.club", secret)).toBeNull();
  });
});

describe("reply text", () => {
  it("keeps what the prospect wrote above the quoted history", () => {
    const text = "Bonjour,\n\nOn peut en parler jeudi ?\n\nMarie\n\nLe mar. 14 oct. 2026 à 09:12, Paul <paul@acme.fr> a écrit :\n> Bonjour Marie";
    expect(replyExcerpt(text)).toBe("Bonjour,\n\nOn peut en parler jeudi ?\n\nMarie");
  });

  it("cuts Outlook's header block and long answers", () => {
    expect(replyExcerpt("Ok pour moi\n________________________________\nDe : Paul")).toBe("Ok pour moi");
    expect(replyExcerpt("a".repeat(50), 10)).toBe("aaaaaaaaa…");
    expect(replyExcerpt("> only quoted")).toBeNull();
  });

  it("spots out-of-office answers", () => {
    expect(isAutoReply({ "auto-submitted": "auto-replied" }, "Re: Proposition")).toBe(true);
    expect(isAutoReply({}, "Réponse automatique : absent jusqu'au 20")).toBe(true);
    expect(isAutoReply({}, "Out of Office: Re: Proposal")).toBe(true);
    expect(isAutoReply({ "auto-submitted": "no" }, "Re: Proposition")).toBe(false);
    expect(isAutoReply({}, "Re: Proposition commerciale")).toBe(false);
  });
});

describe("who may count as the prospect answering", () => {
  const prospects = ["marie@client.fr"];
  const team = ["paul@acme.fr", "lea@acme.fr"];

  it("takes the contact and their colleagues", () => {
    expect(isProspectSide("Marie@Client.fr", prospects, team)).toBe(true);
    expect(isProspectSide("dg@client.fr", prospects, team)).toBe(true);
  });

  it("never takes the seller's team, nor strangers or free mail look-alikes", () => {
    expect(isProspectSide("paul@acme.fr", prospects, team)).toBe(false);
    expect(isProspectSide("boss@acme.fr", prospects, team)).toBe(false);
    expect(isProspectSide("someone@gmail.com", ["marie@gmail.com"], team)).toBe(false);
    expect(isProspectSide("x@other.fr", prospects, team)).toBe(false);
  });

  it("believes the From address only when SPF or DKIM passes and DMARC does not fail", () => {
    expect(senderAuthenticated({ spfVerdict: { status: "PASS" } })).toBe(true);
    expect(senderAuthenticated({ dkimVerdict: { status: "PASS" }, dmarcVerdict: { status: "GRAY" } })).toBe(true);
    expect(senderAuthenticated({ spfVerdict: { status: "PASS" }, dmarcVerdict: { status: "FAIL" } })).toBe(false);
    expect(senderAuthenticated({ spfVerdict: { status: "FAIL" }, dkimVerdict: { status: "FAIL" } })).toBe(false);
  });
});
