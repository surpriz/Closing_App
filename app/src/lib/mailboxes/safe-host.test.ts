import { beforeEach, describe, expect, it, vi } from "vitest";

const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup }));

import { assertSafeMailHost } from "./safe-host";

beforeEach(() => {
  lookup.mockReset();
  vi.unstubAllEnvs();
});

describe("assertSafeMailHost", () => {
  it.each(["10.0.0.1", "127.0.0.1", "169.254.169.254", "192.168.1.5", "::1", "localhost", "mail.localhost"])(
    "rejects %s",
    async (host) => {
      await expect(assertSafeMailHost({ host, port: 993, kind: "imap" })).rejects.toMatchObject({ code: "CONFIG" });
    },
  );

  it("rejects ports outside the allowlist", async () => {
    await expect(assertSafeMailHost({ host: "8.8.8.8", port: 22, kind: "imap" })).rejects.toMatchObject({ code: "CONFIG" });
    await expect(assertSafeMailHost({ host: "8.8.8.8", port: 993, kind: "smtp" })).rejects.toMatchObject({ code: "CONFIG" });
  });

  it("accepts a public host in production and pins the resolved address", async () => {
    vi.stubEnv("NODE_ENV", "production");
    lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    await expect(assertSafeMailHost({ host: "imap.example.com", port: 993, kind: "imap" })).resolves.toEqual({
      address: "93.184.216.34",
      servername: "imap.example.com",
    });
  });

  it("rejects a hostname that resolves to a private address in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.9", family: 4 }]);
    await expect(assertSafeMailHost({ host: "evil.example.com", port: 587, kind: "smtp" })).rejects.toMatchObject({ code: "CONFIG" });
  });

  it("accepts a public IP literal", async () => {
    await expect(assertSafeMailHost({ host: "8.8.8.8", port: 465, kind: "smtp" })).resolves.toMatchObject({ address: "8.8.8.8" });
  });
});
