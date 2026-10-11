import { headPrivateBlob, readPrivateBlob, streamPrivateBlob, streamPrivateBlobRange } from "@/lib/blob";

import { CAPSULE_POSTER_TYPE } from "./limits";
import { parseRange } from "./range";

const BASE_HEADERS = {
  "Accept-Ranges": "bytes",
  "Content-Disposition": "inline",
  "X-Robots-Tag": "noindex, nofollow",
};

/**
 * A capsule never changes behind its URL (a new take gets a new id), so the
 * browser may keep it instead of downloading it on every page or replay.
 */
export const IMMUTABLE_MEDIA = "private, max-age=86400, immutable";

/**
 * Streams a private recording to an <audio>/<video> element. Safari asks for
 * byte ranges before playing anything, so ranges are answered with a 206:
 * forwarded to the store, or cut from the whole file when the store ignores
 * them (32 MB at most, a 90 s video).
 */
export async function mediaResponse(
  request: Request,
  input: { pathname: string; contentType: string; cacheControl?: string },
): Promise<Response> {
  const headers = { ...BASE_HEADERS, "Cache-Control": input.cacheControl ?? "private, no-store" };
  const rangeHeader = request.headers.get("range");
  if (!rangeHeader) {
    const blob = await streamPrivateBlob(input.pathname);
    if (!blob) return new Response("Not found", { status: 404 });
    return new Response(blob.stream, {
      headers: { ...headers, "Content-Type": input.contentType, "Content-Length": String(blob.blob.size) },
    });
  }

  const head = await headPrivateBlob(input.pathname).catch(() => null);
  if (!head) return new Response("Not found", { status: 404 });
  const range = parseRange(rangeHeader, head.size);
  if (range === "unsatisfiable") {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${head.size}` } });
  }
  if (!range) return mediaResponse(new Request(request.url), input);

  const partial = {
    ...headers,
    "Content-Type": input.contentType,
    "Content-Range": `bytes ${range.start}-${range.end}/${head.size}`,
    "Content-Length": String(range.end - range.start + 1),
  };

  const upstream = await streamPrivateBlobRange(input.pathname, `bytes=${range.start}-${range.end}`);
  if (upstream?.headers.get("content-range")) return new Response(upstream.stream, { status: 206, headers: partial });
  // The store sent the whole file (or nothing): drop it and cut the range ourselves
  void upstream?.stream.cancel();

  const bytes = await readPrivateBlob(input.pathname);
  return new Response(bytes.slice(range.start, range.end + 1), { status: 206, headers: partial });
}

/** A capsule's clip, or its still frame with `?poster`. */
export function capsuleMediaResponse(
  request: Request,
  capsule: { blobPathname: string; contentType: string; posterPathname: string | null },
) {
  if (!new URL(request.url).searchParams.has("poster")) {
    return mediaResponse(request, { pathname: capsule.blobPathname, contentType: capsule.contentType, cacheControl: IMMUTABLE_MEDIA });
  }
  if (!capsule.posterPathname) return new Response("Not found", { status: 404 });
  return mediaResponse(request, { pathname: capsule.posterPathname, contentType: CAPSULE_POSTER_TYPE, cacheControl: IMMUTABLE_MEDIA });
}
