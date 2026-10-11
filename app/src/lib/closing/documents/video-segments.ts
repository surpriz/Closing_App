/**
 * A video pitch is tracked like a document of VIDEO_SEGMENTS pages: page N is
 * the Nth tenth of the video. Reading time, "read to the end", the score, the
 * AI reading and the chat then work on it as on a PDF. Pure.
 */
export const VIDEO_SEGMENTS = 10;

/** The 1-based tenth playing at this position; the first one when the length is unknown. */
export function segmentAt(positionMs: number, durationMs: number, segments = VIDEO_SEGMENTS) {
  if (!(durationMs > 0) || !(positionMs > 0)) return 1;
  return Math.min(segments, Math.floor((positionMs / durationMs) * segments) + 1);
}

/** "20–30 %" */
export function segmentLabel(segment: number, segments = VIDEO_SEGMENTS) {
  const step = 100 / segments;
  return `${Math.round((segment - 1) * step)}–${Math.round(segment * step)} %`;
}

/** "jusqu'à 40 % de la vidéo" */
export function reachedLabel(maxSegment: number, segments = VIDEO_SEGMENTS) {
  if (maxSegment >= segments) return "jusqu'au bout de la vidéo";
  return `jusqu'à ${Math.round((maxSegment * 100) / segments)} % de la vidéo`;
}

type TimedSegment = { text: string; startSecond: number; endSecond: number };

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Cuts a transcript into one text per tenth of the video (null when nothing
 * was said there). Timed segments go to the tenth holding their middle;
 * without timing, words are spread evenly, as if spoken at a steady pace.
 */
export function splitTranscript({
  text,
  segments,
  durationMs,
  parts = VIDEO_SEGMENTS,
}: {
  text: string;
  segments: TimedSegment[];
  durationMs: number;
  parts?: number;
}): (string | null)[] {
  const buckets: string[][] = Array.from({ length: parts }, () => []);

  if (segments.length > 0) {
    // The audio track can run a little past the recorder's clock
    const lastEnd = Math.max(...segments.map((segment) => segment.endSecond)) * 1000;
    const length = Math.max(durationMs, lastEnd);
    for (const segment of segments) {
      const middleMs = ((segment.startSecond + segment.endSecond) / 2) * 1000;
      const words = clean(segment.text);
      if (words) buckets[segmentAt(middleMs, length, parts) - 1].push(words);
    }
  } else {
    const words = clean(text).split(" ").filter(Boolean);
    words.forEach((word, i) => buckets[Math.floor((i * parts) / words.length)].push(word));
  }

  return buckets.map((bucket) => (bucket.length > 0 ? bucket.join(" ") : null));
}
