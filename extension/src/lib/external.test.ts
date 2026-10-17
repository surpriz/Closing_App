import { describe, expect, it, vi } from "vitest";

import { answerExternal } from "./external";
import { ClozerError, type Account } from "./messages";

const me = { user: { name: "Ada", email: "ada@acme.fr" } } as Account;

function deps(account: () => Promise<Account | null>) {
  return {
    version: "1.2.0",
    account,
    startConnect: vi.fn(async () => null),
    update: vi.fn(async () => "updating" as const),
  };
}

describe("answerExternal", () => {
  it("reports the signed-in seller and the version", async () => {
    expect(await answerExternal("clozer:status", deps(async () => me))).toEqual({
      ok: true,
      version: "1.2.0",
      signedIn: true,
      email: "ada@acme.fr",
    });
  });

  it("reports signed out without a token or after a 401", async () => {
    expect(await answerExternal("clozer:status", deps(async () => null))).toMatchObject({ signedIn: false });
    const rejected = deps(() => Promise.reject(new ClozerError("unauthorized", "")));
    expect(await answerExternal("clozer:status", rejected)).toMatchObject({ signedIn: false });
  });

  it("keeps the seller signed in when Clozer is unreachable", async () => {
    const offline = deps(() => Promise.reject(new ClozerError("network", "")));
    expect(await answerExternal("clozer:status", offline)).toMatchObject({ signedIn: true, email: null });
  });

  it("answers in time when Clozer is slow, from the token alone", async () => {
    vi.useFakeTimers();
    const answer = answerExternal("clozer:status", deps(() => new Promise(() => {})));
    await vi.advanceTimersByTimeAsync(800);
    expect(await answer).toMatchObject({ signedIn: true, email: null });
    vi.useRealTimers();
  });

  it("opens the connect page and asks Chrome for an update", async () => {
    const d = deps(async () => me);
    expect(await answerExternal("clozer:start-connect", d)).toEqual({ ok: true });
    expect(d.startConnect).toHaveBeenCalled();
    expect(await answerExternal("clozer:update", d)).toEqual({ ok: true, data: "updating" });
  });

  it("ignores anything else", () => {
    expect(answerExternal("clozer:connect", deps(async () => me))).toBeUndefined();
  });
});
