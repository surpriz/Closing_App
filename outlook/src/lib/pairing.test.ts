import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { waitForPairing } from "./pairing";
import { getToken, useSettingsStore, type SettingsStore } from "./settings";

function memoryStore(): SettingsStore {
  const values = new Map<string, unknown>();
  return {
    get: (name) => values.get(name),
    set: (name, value) => void values.set(name, value),
    remove: (name) => void values.delete(name),
    save: async () => undefined,
  };
}

const pairing = { poll: "p".repeat(43), code: "BCDF-GHJK", expiresAt: "" };

function respond(...bodies: [number, unknown][]) {
  const fetch = vi.fn();
  for (const [status, body] of bodies) fetch.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("waitForPairing", () => {
  beforeEach(() => useSettingsStore(memoryStore()));
  afterEach(() => {
    vi.unstubAllGlobals();
    useSettingsStore(null);
  });

  it("polls until the seller confirms, then keeps the token", async () => {
    const fetch = respond([200, { status: "pending" }], [200, { status: "done", token: "clz_ext_x" }]);
    await waitForPairing({ ...pairing, expiresAt: new Date(Date.now() + 60_000).toISOString() }, { sleep: async () => undefined });
    expect(getToken()).toBe("clz_ext_x");
    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/ext\/pair\/poll$/);
    expect(JSON.parse(init.body)).toEqual({ poll: pairing.poll });
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("stops when the code expired", async () => {
    respond([410, { error: "expired", message: "Le code a expiré." }]);
    await expect(
      waitForPairing({ ...pairing, expiresAt: new Date(Date.now() + 60_000).toISOString() }, { sleep: async () => undefined }),
    ).rejects.toMatchObject({ code: "expired" });
    expect(getToken()).toBeNull();
  });

  it("gives up at the deadline", async () => {
    respond();
    await expect(waitForPairing({ ...pairing, expiresAt: new Date(Date.now() - 1).toISOString() })).rejects.toMatchObject({
      code: "expired",
    });
  });
});
