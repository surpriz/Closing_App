import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { COPY } from "./copy";
import { requestUpdate } from "./messages";

// The background answers "update" with what Chrome said about the Web Store
function backgroundSays(response: unknown) {
  vi.spyOn(fakeBrowser.runtime, "sendMessage").mockResolvedValue(response as never);
}

describe("requestUpdate", () => {
  afterEach(() => vi.restoreAllMocks());

  it("tells the seller to reload once the new version is coming", async () => {
    backgroundSays({ ok: true, data: "updating" });
    expect(await requestUpdate()).toBe(COPY.updating);
  });

  it("asks to try again later when Chrome has nothing new yet", async () => {
    backgroundSays({ ok: true, data: "no_update" });
    expect(await requestUpdate()).toBe(COPY.updateNotYet);
    backgroundSays({ ok: true, data: "throttled" });
    expect(await requestUpdate()).toBe(COPY.updateNotYet);
  });

  it("does not throw when the background is gone", async () => {
    backgroundSays(undefined);
    expect(await requestUpdate()).toBe(COPY.updateNotYet);
  });
});
