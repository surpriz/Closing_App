import { describe, expect, it } from "vitest";

import { WatchedSeconds } from "./watched";

function play(watched: WatchedSeconds, from: number, to: number, duration = 100) {
  for (let t = from; t <= to; t += 0.5) watched.update(t, duration);
}

describe("WatchedSeconds", () => {
  it("counts continuous playback", () => {
    const watched = new WatchedSeconds();
    play(watched, 0, 50);
    expect(watched.ratio).toBe(0.5);
  });

  it("ignores a jump to the end", () => {
    const watched = new WatchedSeconds();
    play(watched, 0, 10);
    watched.update(95, 100);
    play(watched, 95, 100);
    expect(watched.ratio).toBe(0.15);
  });

  it("counts a part watched twice once", () => {
    const watched = new WatchedSeconds();
    play(watched, 0, 20);
    watched.reset();
    play(watched, 0, 20);
    expect(watched.ratio).toBe(0.2);
  });

  it("is zero before the duration is known", () => {
    const watched = new WatchedSeconds();
    watched.update(5, 0);
    watched.update(6, 0);
    expect(watched.ratio).toBe(0);
  });
});
