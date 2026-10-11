/** Longest clip, cut by the recorder and checked again by the server: time to introduce a whole document. */
export const CAPSULE_MAX_MS = 90_000;
export const VOICE_COMMENT_MAX_MS = 60_000;

/** Recorder bitrates: ~7 MB for a 90 s video (plenty for a 340px player), ~0.5 MB for a 60 s voice comment. */
export const VIDEO_BITS_PER_SECOND = 600_000;
export const AUDIO_BITS_PER_SECOND = 64_000;

/** Upload ceilings, with room above the bitrates (browsers overshoot). */
export const CAPSULE_VIDEO_MAX_BYTES = 32 * 1024 * 1024;
export const CAPSULE_AUDIO_MAX_BYTES = 4 * 1024 * 1024;
export const VOICE_COMMENT_MAX_BYTES = 1.5 * 1024 * 1024;
/** Still frame shown in the bubble instead of playing the video: a small JPEG. */
export const CAPSULE_POSTER_TYPE = "image/jpeg";
export const CAPSULE_POSTER_MAX_BYTES = 512 * 1024;

/** Video pitch: the video is the document, long enough for a real pitch or a screen walkthrough. */
export const PITCH_MAX_MS = 180_000;
/** ~28 MB for 3 min of 720p webcam; a shared screen needs more for text to stay legible (~58 MB). */
export const PITCH_CAMERA_VIDEO_BPS = 1_200_000;
export const PITCH_SCREEN_VIDEO_BPS = 2_500_000;
export const PITCH_AUDIO_IN_VIDEO_BPS = 96_000;
/** The mic alone, recorded next to the video for the transcription: ~1 MB, far under Whisper's 25 MB. */
export const PITCH_TRANSCRIPT_AUDIO_BPS = 48_000;
/** Some browsers (Safari) ignore the bitrate: room above it. */
export const PITCH_VIDEO_MAX_BYTES = 150 * 1024 * 1024;
export const PITCH_AUDIO_MAX_BYTES = 10 * 1024 * 1024;
/** 16:9 still, larger than the bubble's. */
export const PITCH_POSTER_MAX_BYTES = 1024 * 1024;
/** Above this, the browser uploads in parts. */
export const MULTIPART_THRESHOLD_BYTES = 5 * 1024 * 1024;

/** "Sur cette partie, laisse-moi t'expliquer…" shown next to the bubble. */
export const CAPSULE_HOOK_MAX = 120;

/** Voice comments per browser session per hour, per browser per day, per network per hour. */
export const VOICE_VIEW_HOURLY_MAX = 5;
export const VOICE_VISITOR_DAILY_MAX = 15;
export const VOICE_IP_HOURLY_MAX = 10;
/** Voice comments alerted per link per hour, beyond that the deal page is enough. */
export const VOICE_ALERTS_PER_LINK_HOUR = 6;
