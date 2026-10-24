import { describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: (...args: unknown[]) => queryRaw(...args) } }));
const report = vi.fn();
vi.mock("@/lib/security-events", () => ({ reportSecurityEvent: (...args: unknown[]) => report(...args) }));

const { clientIp, consumeLimit, limitKey, LIMITS, perLink } = await import("./rate-limit");

describe("clientIp", () => {
  it("prefers the header Vercel sets itself", () => {
    expect(clientIp(new Headers({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }))).toBe("1.2.3.4");
  });

  it("falls back to the first forwarded address", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
  });
});

describe("perLink", () => {
  it("keeps colleagues behind one IP apart, link by link", () => {
    const headers = new Headers({ "x-real-ip": "1.2.3.4" });
    expect(perLink(headers, "linkA")).not.toBe(perLink(headers, "linkB"));
  });
});

describe("limitKey", () => {
  it("never keeps the raw subject", () => {
    const key = limitKey("gate", "1.2.3.4");
    expect(key).toMatch(/^gate:[0-9a-f]{32}$/);
    expect(key).not.toContain("1.2.3.4");
  });
});

describe("consumeLimit", () => {
  it("lets requests through up to the max", async () => {
    queryRaw.mockResolvedValueOnce([{ count: LIMITS.gate.max }]);
    expect(await consumeLimit("gate", new Headers())).toBe(true);
  });

  it("refuses past the max", async () => {
    queryRaw.mockResolvedValueOnce([{ count: LIMITS.gate.max + 1 }]);
    expect(await consumeLimit("gate", new Headers())).toBe(false);
  });

  it("reports once, on the first refused request of the window", async () => {
    report.mockClear();
    queryRaw.mockResolvedValueOnce([{ count: LIMITS.gate.max + 1 }]);
    await consumeLimit("gate", new Headers());
    queryRaw.mockResolvedValueOnce([{ count: LIMITS.gate.max + 2 }]);
    await consumeLimit("gate", new Headers());
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith("rate_limit_crossed", expect.objectContaining({ scope: "gate" }));
  });

  it("lets the request through when the database fails", async () => {
    queryRaw.mockRejectedValueOnce(new Error("down"));
    expect(await consumeLimit("gate", new Headers())).toBe(true);
  });
});
