import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: (...args: unknown[]) => queryRaw(...args) } }));

const { reserveSend } = await import("./counter");

describe("reserveSend", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("is true when the update returned a row", async () => {
    queryRaw.mockResolvedValue([{ sentCount: 3 }]);
    expect(await reserveSend("mb1", "2026-10-27", 12)).toBe(true);
  });

  it("is false when no row matched: the day is full", async () => {
    queryRaw.mockResolvedValue([]);
    expect(await reserveSend("mb1", "2026-10-27", 12)).toBe(false);
  });

  it("passes the mailbox, the day and the allowance to the query", async () => {
    queryRaw.mockResolvedValue([{ sentCount: 1 }]);
    await reserveSend("mb1", "2026-10-27", 12);
    expect(queryRaw.mock.calls[0].slice(1)).toEqual(["2026-10-27", "2026-10-27", "mb1", "2026-10-27", 12]);
  });

  it("is false without a query when the allowance is 0", async () => {
    expect(await reserveSend("mb1", "2026-10-28", 0)).toBe(false);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("throws on a database error: no send without a reservation", async () => {
    queryRaw.mockRejectedValue(new Error("db down"));
    await expect(reserveSend("mb1", "2026-10-27", 12)).rejects.toThrow("db down");
  });
});
