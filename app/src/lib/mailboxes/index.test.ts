import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: { mailbox: { update: vi.fn() } } }));
const env: Record<string, string | undefined> = {};
vi.mock("@/lib/env", () => ({ getEnv: () => env }));
vi.mock("./credentials", () => ({ decodeCredentials: () => ({ v: 1, kind: "nylas", grantId: "g1" }) }));
const nylasConnector = vi.fn(() => ({ provider: "GOOGLE" }));
vi.mock("./gmail/nylas", () => ({ nylasConnector: (...a: unknown[]) => nylasConnector(...(a as [])) }));

const { connectorFor } = await import("./index");
const mailbox = { id: "mb1", provider: "GOOGLE", connector: "NYLAS", email: "a@b.io", displayName: null, credentials: "x" } as never;

beforeEach(() => {
  vi.clearAllMocks();
  delete env.NYLAS_API_KEY;
});

describe("connectorFor NYLAS", () => {
  it("refuses without NYLAS_API_KEY", () => {
    expect(() => connectorFor(mailbox)).toThrow(/not configured/);
    expect(nylasConnector).not.toHaveBeenCalled();
  });
  it("builds the connector once configured", () => {
    env.NYLAS_API_KEY = "k";
    expect(connectorFor(mailbox)).toEqual({ provider: "GOOGLE" });
  });
});
