import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { mailbox: { updateMany: (...a: unknown[]) => updateMany(...a) } } }));

const { disconnectMemberMailboxes } = await import("./disconnect-member");

describe("disconnectMemberMailboxes", () => {
  beforeEach(() => updateMany.mockReset());

  it("disconnects the member's live mailboxes of the workspace and wipes the credentials", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await disconnectMemberMailboxes("org1", "user1");
    const arg = updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ organizationId: "org1", userId: "user1", status: { not: "DISCONNECTED" } });
    expect(arg.data).toMatchObject({ status: "DISCONNECTED", credentials: "" });
    expect(arg.data.disconnectedAt).toBeInstanceOf(Date);
  });
});
