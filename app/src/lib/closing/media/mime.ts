export type MediaKind = "VIDEO" | "AUDIO";

/**
 * Recorder formats by preference. MP4 first: Safari only records MP4, and
 * an MP4 plays everywhere, while WebM does not play on older iPhones.
 */
const RECORDER_CANDIDATES: Record<MediaKind, string[]> = {
  VIDEO: ["video/mp4;codecs=avc1,mp4a", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"],
  AUDIO: ["audio/mp4", "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"],
};

/** Base types the server accepts, without codecs. */
export const ALLOWED_MEDIA_TYPES: Record<MediaKind, readonly string[]> = {
  VIDEO: ["video/mp4", "video/webm"],
  AUDIO: ["audio/mp4", "audio/webm", "audio/ogg"],
};

/** First format the browser can record, or null when MediaRecorder picks one itself. */
export function pickMimeType(kind: MediaKind, isSupported: (type: string) => boolean) {
  return RECORDER_CANDIDATES[kind].find((type) => isSupported(type)) ?? null;
}

/** "video/webm;codecs=vp9,opus" → "video/webm" */
export function baseMime(type: string) {
  return type.split(";")[0].trim().toLowerCase();
}

export function isAllowedMedia(kind: MediaKind, type: string) {
  return ALLOWED_MEDIA_TYPES[kind].includes(baseMime(type));
}

export function extensionFor(type: string) {
  const base = baseMime(type);
  if (base.endsWith("/mp4")) return base.startsWith("audio") ? "m4a" : "mp4";
  if (base.endsWith("/ogg")) return "ogg";
  return "webm";
}

/** Container read from the first bytes, so a declared type cannot hide another file. */
export function sniffContainer(bytes: Uint8Array): "webm" | "mp4" | "ogg" | null {
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm";
  if (bytes.length >= 8 && ascii(bytes, 4, 8) === "ftyp") return "mp4";
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === "OggS") return "ogg";
  return null;
}

/** The bytes match the declared type. */
export function matchesContainer(type: string, bytes: Uint8Array) {
  const container = sniffContainer(bytes);
  return container !== null && container === baseMime(type).split("/")[1];
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end));
}
