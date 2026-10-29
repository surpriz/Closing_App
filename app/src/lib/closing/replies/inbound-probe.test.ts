import { beforeEach, describe, expect, it, vi } from "vitest";

const recordDkimProbe = vi.fn();
const findUnique = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { followup: { findUnique: (a: unknown) => findUnique(a) } } }));
vi.mock("@/lib/mailboxes/dns/probe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mailboxes/dns/probe")>()),
  recordDkimProbe: (a: unknown) => recordDkimProbe(a),
}));

import { probeAddress } from "@/lib/mailboxes/dns/probe";

import { handleInboundReply } from "./inbound";

const secret = "a-test-secret-that-is-long-enough-123";
const domain = "reply.clozer.club";

function notification(over: { recipient?: string; spam?: string } = {}) {
  return {
    notificationType: "Received",
    mail: {
      messageId: "m1",
      source: "paul@acme.fr",
      commonHeaders: { from: ["Paul <Paul@Acme.fr>"] },
      headers: [
        { name: "From", value: "Paul <Paul@Acme.fr>" },
        { name: "DKIM-Signature", value: "v=1; d=acme.fr; s=mine" },
        { name: "DKIM-Signature", value: "v=1; d=provider.net; s=theirs" },
      ],
    },
    receipt: {
      recipients: [over.recipient ?? probeAddress("cmbox123def456ghi789", domain, secret)],
      spamVerdict: { status: over.spam ?? "PASS" },
      virusVerdict: { status: "PASS" },
      spfVerdict: { status: "PASS" },
      dkimVerdict: { status: "PASS" },
      dmarcVerdict: { status: "GRAY" },
      action: { type: "SNS" },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("INBOUND_REPLY_DOMAIN", domain);
  vi.stubEnv("ENCRYPTION_KEY", secret);
  recordDkimProbe.mockResolvedValue("recorded");
});

describe("handleInboundReply, DKIM probe branch", () => {
  it("records the probe before any relay lookup and returns probe", async () => {
    expect(await handleInboundReply(notification())).toBe("probe");
    expect(findUnique).not.toHaveBeenCalled();
    expect(recordDkimProbe).toHaveBeenCalledTimes(1);
    expect(recordDkimProbe.mock.calls[0][0]).toMatchObject({
      mailboxId: "cmbox123def456ghi789",
      fromEmail: "paul@acme.fr",
      verdicts: { spf: "PASS", dkim: "PASS", dmarc: "GRAY" },
      dkimSignatures: ["v=1; d=acme.fr; s=mine", "v=1; d=provider.net; s=theirs"],
    });
  });

  it("rejects spam or virus without recording a verdict", async () => {
    expect(await handleInboundReply(notification({ spam: "FAIL" }))).toBe("rejected");
    expect(recordDkimProbe).not.toHaveBeenCalled();
  });
});
