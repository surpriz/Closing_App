import { beforeEach, describe, expect, it, vi } from "vitest";

const suppressionFindFirst = vi.fn();
const suppressionFindMany = vi.fn();
const suppressionCreateMany = vi.fn();
const prospectFindFirst = vi.fn();
const prospectFindMany = vi.fn();
const suppressionCount = vi.fn();
const suppressionDeleteMany = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    suppression: {
      findFirst: (...a: unknown[]) => suppressionFindFirst(...a),
      findMany: (...a: unknown[]) => suppressionFindMany(...a),
      createMany: (...a: unknown[]) => suppressionCreateMany(...a),
      count: (...a: unknown[]) => suppressionCount(...a),
      deleteMany: (...a: unknown[]) => suppressionDeleteMany(...a),
    },
    prospect: {
      findFirst: (...a: unknown[]) => prospectFindFirst(...a),
      findMany: (...a: unknown[]) => prospectFindMany(...a),
    },
  },
}));

const {
  addSuppression,
  allSuppressions,
  countSuppressions,
  isSuppressed,
  listSuppressions,
  removeManualSuppression,
  suppressedAmong,
} = await import("./suppression");

beforeEach(() => {
  vi.clearAllMocks();
  suppressionFindFirst.mockResolvedValue(null);
  suppressionFindMany.mockResolvedValue([]);
  prospectFindFirst.mockResolvedValue(null);
  prospectFindMany.mockResolvedValue([]);
});

describe("isSuppressed", () => {
  it("is true when the table has the address (lowercased)", async () => {
    suppressionFindFirst.mockResolvedValue({ id: "s1" });
    expect(await isSuppressed("org", "Ana@Acme.com")).toBe(true);
    expect(suppressionFindFirst.mock.calls[0][0].where).toMatchObject({ organizationId: "org", email: "ana@acme.com" });
  });

  it("is true when a prospect of the org unsubscribed, bounced or complained", async () => {
    prospectFindFirst.mockResolvedValue({ id: "p1" });
    expect(await isSuppressed("org", "ana@acme.com")).toBe(true);
    const where = prospectFindFirst.mock.calls[0][0].where;
    expect(where.link).toEqual({ organizationId: "org" });
    expect(where.email).toEqual({ equals: "ana@acme.com", mode: "insensitive" });
    expect(where.OR).toEqual([
      { unsubscribedAt: { not: null } },
      { bouncedAt: { not: null } },
      { complainedAt: { not: null } },
    ]);
  });

  it("is false otherwise", async () => {
    expect(await isSuppressed("org", "ana@acme.com")).toBe(false);
  });
});

describe("suppressedAmong", () => {
  it("merges both sources with lowercase emails", async () => {
    suppressionFindMany.mockResolvedValue([{ email: "a@x.com" }]);
    prospectFindMany.mockResolvedValue([{ email: "B@x.com" }]);
    const out = await suppressedAmong("org", ["A@x.com", "b@x.com", "c@x.com"]);
    expect([...out].sort()).toEqual(["a@x.com", "b@x.com"]);
  });

  it("skips the queries for an empty list", async () => {
    expect((await suppressedAmong("org", [])).size).toBe(0);
    expect(suppressionFindMany).not.toHaveBeenCalled();
  });
});

describe("addSuppression", () => {
  it("lowercases the email and reports creation", async () => {
    suppressionCreateMany.mockResolvedValue({ count: 1 });
    expect(await addSuppression({ organizationId: "org", email: " Ana@Acme.COM ", reason: "UNSUBSCRIBE", source: "link" })).toBe(true);
    expect(suppressionCreateMany.mock.calls[0][0]).toEqual({
      data: [{ organizationId: "org", email: "ana@acme.com", reason: "UNSUBSCRIBE", source: "link", detail: null }],
      skipDuplicates: true,
    });
  });

  it("returns false for a duplicate", async () => {
    suppressionCreateMany.mockResolvedValue({ count: 0 });
    expect(await addSuppression({ organizationId: "org", email: "a@b.c", reason: "MANUAL", source: "ui" })).toBe(false);
  });
});

describe("removeManualSuppression", () => {
  it("only targets MANUAL rows of the workspace, so an unsubscribe is refused", async () => {
    suppressionDeleteMany.mockResolvedValue({ count: 0 });
    expect(await removeManualSuppression("org1", "s1")).toBe(false);
    expect(suppressionDeleteMany).toHaveBeenCalledWith({ where: { id: "s1", organizationId: "org1", reason: "MANUAL" } });
  });

  it("says true when a manual row went away", async () => {
    suppressionDeleteMany.mockResolvedValue({ count: 1 });
    expect(await removeManualSuppression("org1", "s1")).toBe(true);
  });
});

describe("lists", () => {
  it("lists the latest rows first, 20 by default", async () => {
    await listSuppressions("org1");
    expect(suppressionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org1" }, orderBy: { createdAt: "desc" }, take: 20 }),
    );
  });

  it("exports everything oldest first, without a limit", async () => {
    await allSuppressions("org1");
    const arg = suppressionFindMany.mock.calls[0][0];
    expect(arg.orderBy).toEqual({ createdAt: "asc" });
    expect(arg).not.toHaveProperty("take");
  });

  it("counts the workspace's rows", async () => {
    suppressionCount.mockResolvedValue(7);
    expect(await countSuppressions("org1")).toBe(7);
    expect(suppressionCount).toHaveBeenCalledWith({ where: { organizationId: "org1" } });
  });
});
