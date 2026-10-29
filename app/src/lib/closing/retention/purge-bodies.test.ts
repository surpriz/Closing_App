import { beforeEach, describe, expect, it, vi } from "vitest";

const messageFindMany = vi.fn();
const messageUpdateMany = vi.fn();
const eventFindMany = vi.fn();
const eventDeleteMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    campaignMessage: { findMany: messageFindMany, updateMany: messageUpdateMany },
    mailboxInboundEvent: { findMany: eventFindMany, deleteMany: eventDeleteMany },
  },
}));

const now = new Date("2026-10-28T12:00:00Z");
const cutoff = new Date("2026-07-30T12:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("messageBodyCutoff", () => {
  it("keeps bodies 90 days", async () => {
    const { messageBodyCutoff, MESSAGE_BODY_RETENTION_DAYS } = await import("./purge");
    expect(MESSAGE_BODY_RETENTION_DAYS).toBe(90);
    expect(messageBodyCutoff(now)).toEqual(cutoff);
  });
});

describe("purgeCampaignMessageBodies", () => {
  it("blanks the bodies of old sent messages and of old failed, cancelled or skipped ones", async () => {
    const { purgeCampaignMessageBodies } = await import("./purge");
    messageFindMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    messageUpdateMany.mockResolvedValue({ count: 2 });

    expect(await purgeCampaignMessageBodies(now, 50)).toBe(2);

    expect(messageFindMany).toHaveBeenCalledWith({
      where: {
        body: { not: "" },
        OR: [
          { sentAt: { lt: cutoff } },
          { status: { in: ["FAILED", "CANCELLED", "SKIPPED"] }, updatedAt: { lt: cutoff } },
        ],
      },
      select: { id: true },
      take: 50,
    });
    expect(messageUpdateMany).toHaveBeenCalledWith({ where: { id: { in: ["a", "b"] } }, data: { body: "" } });
  });

  it("does nothing when there is nothing to purge", async () => {
    const { purgeCampaignMessageBodies } = await import("./purge");
    messageFindMany.mockResolvedValue([]);
    expect(await purgeCampaignMessageBodies(now)).toBe(0);
    expect(messageUpdateMany).not.toHaveBeenCalled();
  });
});

describe("purgeInboundEvents", () => {
  it("deletes events received before the cutoff, in batches", async () => {
    const { purgeInboundEvents } = await import("./purge");
    eventFindMany.mockResolvedValue([{ id: "e1" }]);
    eventDeleteMany.mockResolvedValue({ count: 1 });

    expect(await purgeInboundEvents(now)).toBe(1);

    expect(eventFindMany).toHaveBeenCalledWith({
      where: { receivedAt: { lt: cutoff } },
      select: { id: true },
      take: 500,
    });
    expect(eventDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["e1"] } } });
  });

  it("does nothing when nothing is old enough", async () => {
    const { purgeInboundEvents } = await import("./purge");
    eventFindMany.mockResolvedValue([]);
    expect(await purgeInboundEvents(now)).toBe(0);
    expect(eventDeleteMany).not.toHaveBeenCalled();
  });
});
