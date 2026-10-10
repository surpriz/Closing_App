import { headPrivateBlob, readPrivateBlob, streamPrivateBlob, streamPrivateBlobRange } from "@/lib/blob";

import { parseRange } from "./range";

const BASE_HEADERS = {
  "Accept-Ranges": "bytes",
  "Content-Disposition": "inline",
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

/**
 * Streams a private recording to an <audio>/<video> element. Safari asks for
 * byte ranges before playing anything, so ranges are answered with a 206:
 * forwarded to the store, or cut from the whole file when the store ignores
 * them (recordings are a few MB at most).
 */
export async function mediaResponse(request: Request, input: { pathname: string; contentType: string }) {
  const rangeHeader = request.headers.get("range");
  if (!rangeHeader) {
    const blob = await streamPrivateBlob(input.pathname);
    if (!blob) return new Response("Not found", { status: 404 });
    return new Response(blob.stream, {
      headers: { ...BASE_HEADERS, "Content-Type": input.contentType, "Content-Length": String(blob.blob.size) },
    });
  }

  const head = await headPrivateBlob(input.pathname).catch(() => null);
  if (!head) return new Response("Not found", { status: 404 });
  const range = parseRange(rangeHeader, head.size);
  if (range === "unsatisfiable") {
    return new Response(null, { status: 416, headers: { ...BASE_HEADERS, "Content-Range": `bytes */${head.size}` } });
  }
  if (!range) return mediaResponse(new Request(request.url), input);

  const partial = {
    ...BASE_HEADERS,
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
