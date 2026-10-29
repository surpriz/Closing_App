import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { mailbox: { findMany: (...a: unknown[]) => findMany(...a) } } }));
const disconnectMailbox = vi.fn();
vi.mock("./connect", () => ({ disconnectMailbox: (...a: unknown[]) => disconnectMailbox(...a) }));

const { disconnectMemberMailboxes } = await import("./disconnect-member");

describe("disconnectMemberMailboxes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("disconnects each live mailbox of the member through disconnectMailbox", async () => {
    findMany.mockResolvedValue([{ id: "m1" }, { id: "m2" }]);
    disconnectMailbox.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const res = await disconnectMemberMailboxes("org1", "user1");
    expect(findMany.mock.calls[0][0].where).toEqual({ organizationId: "org1", userId: "user1", status: { not: "DISCONNECTED" } });
    expect(disconnectMailbox).toHaveBeenCalledWith("org1", "user1", "m1");
    expect(disconnectMailbox).toHaveBeenCalledWith("org1", "user1", "m2");
    expect(res).toEqual({ count: 1 });
  });
});
