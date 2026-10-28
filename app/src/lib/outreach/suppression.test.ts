import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const count = vi.fn();
const deleteMany = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: { suppression: { findMany, count, deleteMany } } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("removeManualSuppression", () => {
  it("only targets MANUAL rows of the workspace, so an unsubscribe is refused", async () => {
    const { removeManualSuppression } = await import("./suppression");
    deleteMany.mockResolvedValue({ count: 0 });
    expect(await removeManualSuppression("org1", "s1")).toBe(false);
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "s1", organizationId: "org1", reason: "MANUAL" } });
  });

  it("says true when a manual row went away", async () => {
    const { removeManualSuppression } = await import("./suppression");
    deleteMany.mockResolvedValue({ count: 1 });
    expect(await removeManualSuppression("org1", "s1")).toBe(true);
  });
});

describe("lists", () => {
  it("lists the latest rows first, 20 by default", async () => {
    const { listSuppressions } = await import("./suppression");
    findMany.mockResolvedValue([]);
    await listSuppressions("org1");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org1" }, orderBy: { createdAt: "desc" }, take: 20 }),
    );
  });

  it("exports everything oldest first, without a limit", async () => {
    const { allSuppressions } = await import("./suppression");
    findMany.mockResolvedValue([]);
    await allSuppressions("org1");
    const arg = findMany.mock.calls[0][0];
    expect(arg.orderBy).toEqual({ createdAt: "asc" });
    expect(arg).not.toHaveProperty("take");
  });

  it("counts the workspace's rows", async () => {
    const { countSuppressions } = await import("./suppression");
    count.mockResolvedValue(7);
    expect(await countSuppressions("org1")).toBe(7);
    expect(count).toHaveBeenCalledWith({ where: { organizationId: "org1" } });
  });
});
