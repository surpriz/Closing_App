import { describe, expect, it } from "vitest";

import { parseReplyAddress, replyAddress } from "./address";
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
