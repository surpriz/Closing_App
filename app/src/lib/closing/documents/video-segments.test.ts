import { describe, expect, it } from "vitest";

import { reachedLabel, segmentAt, segmentLabel, splitTranscript, VIDEO_SEGMENTS } from "./video-segments";

describe("segmentAt", () => {
  const duration = 100_000;

  it("maps a position to its tenth, 1-based", () => {
    expect(segmentAt(0, duration)).toBe(1);
    expect(segmentAt(9_999, duration)).toBe(1);
    expect(segmentAt(10_000, duration)).toBe(2);
    expect(segmentAt(55_000, duration)).toBe(6);
  });

  it("keeps the end and beyond in the last tenth", () => {
    expect(segmentAt(duration, duration)).toBe(VIDEO_SEGMENTS);
    expect(segmentAt(duration * 2, duration)).toBe(VIDEO_SEGMENTS);
  });

  it("stays on the first tenth when the length is unknown", () => {
    expect(segmentAt(5_000, 0)).toBe(1);
    expect(segmentAt(5_000, Number.NaN)).toBe(1);
    expect(segmentAt(-1, duration)).toBe(1);
  });
});

describe("labels", () => {
  it("names a tenth by its share of the video", () => {
    expect(segmentLabel(1)).toBe("0–10 %");
    expect(segmentLabel(3)).toBe("20–30 %");
    expect(segmentLabel(10)).toBe("90–100 %");
  });

  it("says how far the prospect watched", () => {
    expect(reachedLabel(4)).toBe("jusqu'à 40 % de la vidéo");
    expect(reachedLabel(10)).toBe("jusqu'au bout de la vidéo");
  });
});

describe("splitTranscript", () => {
  const seg = (text: string, startSecond: number, endSecond: number) => ({ text, startSecond, endSecond });

  it("puts each timed segment in the tenth holding its middle", () => {
    const parts = splitTranscript({
      text: "",
      segments: [seg("Bonjour Marc,", 0, 4), seg("voici notre offre.", 6, 16), seg("À bientôt.", 95, 100)],
      durationMs: 100_000,
    });
    expect(parts).toHaveLength(VIDEO_SEGMENTS);
    expect(parts[0]).toBe("Bonjour Marc,");
    // 6-16 s straddles two tenths: its middle (11 s) decides
    expect(parts[1]).toBe("voici notre offre.");
    expect(parts[2]).toBeNull();
    expect(parts[9]).toBe("À bientôt.");
  });

  it("joins segments of the same tenth and cleans the spaces", () => {
    const parts = splitTranscript({
      text: "",
      segments: [seg("  Un  ", 0, 2), seg("deux", 2, 4)],
      durationMs: 100_000,
    });
    expect(parts[0]).toBe("Un deux");
  });

  it("trusts the audio's end when it runs past the recorder's clock", () => {
    const parts = splitTranscript({ text: "", segments: [seg("fin", 108, 110)], durationMs: 100_000 });
    expect(parts[9]).toBe("fin");
  });

  it("splits by word count when the model gives no timing", () => {
    const words = Array.from({ length: 20 }, (_, i) => `m${i + 1}`).join(" ");
    const parts = splitTranscript({ text: words, segments: [], durationMs: 60_000 });
    expect(parts[0]).toBe("m1 m2");
    expect(parts[9]).toBe("m19 m20");
  });

  it("leaves later tenths empty when there are fewer words than tenths", () => {
    const parts = splitTranscript({ text: "Oui merci", segments: [], durationMs: 60_000 });
    expect(parts.filter(Boolean)).toEqual(["Oui", "merci"]);
    expect(parts).toHaveLength(VIDEO_SEGMENTS);
  });

  it("gives only empty tenths for an empty transcript", () => {
    expect(splitTranscript({ text: "   ", segments: [], durationMs: 60_000 }).every((part) => part === null)).toBe(true);
  });
});
