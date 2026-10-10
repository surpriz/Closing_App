import {
  CAPSULE_AUDIO_MAX_BYTES,
  CAPSULE_MAX_MS,
  CAPSULE_VIDEO_MAX_BYTES,
  VOICE_COMMENT_MAX_BYTES,
  VOICE_COMMENT_MAX_MS,
} from "./limits";
import { isAllowedMedia, type MediaKind } from "./mime";

export type MediaUse = "capsule" | "voice_comment";
export type MediaError = "type" | "too_large" | "empty" | "too_long";

/** Recorders stop on a timer, give them a second of slack. */
const DURATION_SLACK_MS = 1_500;

function limitsFor(use: MediaUse, kind: MediaKind) {
  if (use === "voice_comment") return { maxBytes: VOICE_COMMENT_MAX_BYTES, maxMs: VOICE_COMMENT_MAX_MS };
  return { maxBytes: kind === "VIDEO" ? CAPSULE_VIDEO_MAX_BYTES : CAPSULE_AUDIO_MAX_BYTES, maxMs: CAPSULE_MAX_MS };
}

/** Checks a recording against what this use accepts. Pure. */
export function validateMedia(input: {
  use: MediaUse;
  kind: MediaKind;
  contentType: string;
  size: number;
  durationMs: number;
}): MediaError | null {
  if (input.use === "voice_comment" && input.kind !== "AUDIO") return "type";
  if (!isAllowedMedia(input.kind, input.contentType)) return "type";
  const { maxBytes, maxMs } = limitsFor(input.use, input.kind);
  if (input.size <= 0) return "empty";
  if (input.size > maxBytes) return "too_large";
  if (!(input.durationMs > 0) || input.durationMs > maxMs + DURATION_SLACK_MS) return "too_long";
  return null;
}
