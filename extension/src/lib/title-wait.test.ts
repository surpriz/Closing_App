import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { waitForTitle } from "./title-wait";

type Doc = { id: string; titled?: boolean };

const titled: Doc = { id: "d1", titled: true };
const untitled: Doc = { id: "d1", titled: false };

describe("waitForTitle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns right away when the title is there", async () => {
    const fetch = vi.fn().mockResolvedValue(titled);
    const onWait = vi.fn();
    await expect(waitForTitle(fetch, { onWait })).resolves.toEqual(titled);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(onWait).not.toHaveBeenCalled();
  });

  it("treats a document without the flag as titled", async () => {
    const fetch = vi.fn().mockResolvedValue({ id: "d1" });
    await expect(waitForTitle(fetch)).resolves.toEqual({ id: "d1" });
  });

  it("polls until the title arrives, telling the caller once", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(untitled).mockResolvedValueOnce(untitled).mockResolvedValue(titled);
    const onWait = vi.fn();
    const result = waitForTitle(fetch, { pollMs: 1000, timeoutMs: 15_000, onWait });
    await vi.advanceTimersByTimeAsync(0);
    expect(onWait).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toEqual(titled);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(onWait).toHaveBeenCalledTimes(1);
  });

  it("gives up at the timeout with the last document", async () => {
    const fetch = vi.fn().mockResolvedValue(untitled);
    const onWait = vi.fn();
    const result = waitForTitle(fetch, { pollMs: 1000, timeoutMs: 3000, onWait });
    await vi.advanceTimersByTimeAsync(3000);
    await expect(result).resolves.toEqual(untitled);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(onWait).toHaveBeenCalledTimes(1);
  });

  it("starts from a document already in hand and survives a failed poll", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(titled);
    const result = waitForTitle(fetch, { initial: untitled, pollMs: 1000, timeoutMs: 15_000 });
    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toEqual(titled);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
