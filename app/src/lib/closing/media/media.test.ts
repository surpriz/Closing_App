import { describe, expect, it } from "vitest";

import { CAPSULE_MAX_MS, CAPSULE_VIDEO_MAX_BYTES, VOICE_COMMENT_MAX_BYTES } from "./limits";
import { baseMime, extensionFor, matchesContainer, pickMimeType, sniffContainer } from "./mime";
import { parseRange } from "./range";
import { validateMedia } from "./validate";

const bytes = (...values: number[]) => new Uint8Array(values);
const WEBM = bytes(0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0);
const MP4 = bytes(0, 0, 0, 0x20, ...[..."ftypisom"].map((c) => c.charCodeAt(0)));
const OGG = bytes(...[..."OggS"].map((c) => c.charCodeAt(0)), 0, 0);

describe("pickMimeType", () => {
  it("prefers MP4 when the browser records it (Safari)", () => {
    expect(pickMimeType("VIDEO", () => true)).toBe("video/mp4;codecs=avc1,mp4a");
    expect(pickMimeType("AUDIO", () => true)).toBe("audio/mp4");
  });

  it("falls back to WebM/Opus in Chrome and Firefox", () => {
    const chrome = (type: string) => type.startsWith("video/webm") || type.startsWith("audio/webm");
    expect(pickMimeType("VIDEO", chrome)).toBe("video/webm;codecs=vp9,opus");
    expect(pickMimeType("AUDIO", chrome)).toBe("audio/webm;codecs=opus");
  });

  it("returns null when nothing listed is supported", () => {
    expect(pickMimeType("AUDIO", () => false)).toBeNull();
  });
});

describe("mime helpers", () => {
  it("strips codecs and picks a file extension", () => {
    expect(baseMime("Video/WebM; codecs=vp9")).toBe("video/webm");
    expect(extensionFor("audio/mp4")).toBe("m4a");
    expect(extensionFor("video/mp4")).toBe("mp4");
    expect(extensionFor("audio/webm;codecs=opus")).toBe("webm");
  });

  it("reads the container from the first bytes", () => {
    expect(sniffContainer(WEBM)).toBe("webm");
    expect(sniffContainer(MP4)).toBe("mp4");
    expect(sniffContainer(OGG)).toBe("ogg");
    expect(sniffContainer(bytes(0x25, 0x50, 0x44, 0x46))).toBeNull();
  });

  it("refuses bytes that do not match the declared type", () => {
    expect(matchesContainer("audio/webm;codecs=opus", WEBM)).toBe(true);
    expect(matchesContainer("audio/mp4", WEBM)).toBe(false);
  });
});

describe("validateMedia", () => {
  const capsule = { use: "capsule" as const, kind: "VIDEO" as const, contentType: "video/webm", size: 1000, durationMs: 20_000 };

  it("accepts a short capsule", () => {
    expect(validateMedia(capsule)).toBeNull();
  });

  it("refuses wrong types, empty, oversized and overlong clips", () => {
    expect(validateMedia({ ...capsule, contentType: "application/pdf" })).toBe("type");
    expect(validateMedia({ ...capsule, size: 0 })).toBe("empty");
    expect(validateMedia({ ...capsule, size: CAPSULE_VIDEO_MAX_BYTES + 1 })).toBe("too_large");
    expect(validateMedia({ ...capsule, durationMs: CAPSULE_MAX_MS + 5_000 })).toBe("too_long");
  });

  it("keeps voice comments audio only and small", () => {
    const voice = { use: "voice_comment" as const, kind: "AUDIO" as const, contentType: "audio/webm", size: 1000, durationMs: 45_000 };
    expect(validateMedia(voice)).toBeNull();
    expect(validateMedia({ ...voice, kind: "VIDEO", contentType: "video/webm" })).toBe("type");
    expect(validateMedia({ ...voice, size: VOICE_COMMENT_MAX_BYTES + 1 })).toBe("too_large");
  });
});

describe("parseRange", () => {
  it("reads open, closed and suffix ranges", () => {
    expect(parseRange("bytes=0-", 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=0-1", 100)).toEqual({ start: 0, end: 1 });
    expect(parseRange("bytes=50-500", 100)).toEqual({ start: 50, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
  });

  it("sends the whole file without a header or with several ranges", () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange("bytes=0-1,5-6", 100)).toBeNull();
  });

  it("flags ranges outside the file", () => {
    expect(parseRange("bytes=100-", 100)).toBe("unsatisfiable");
    expect(parseRange("bytes=5-2", 100)).toBe("unsatisfiable");
  });
});
