import { videoSizes } from "./videoSizes.ts";
import { notesResponse } from "./notesApi.ts";
import { reviewResponse } from "./reviewApi.ts";

type ByteRange = { start: number; end: number };

/** Undefined means ignore unsupported/malformed ranges; null means unsatisfiable. */
export function parseByteRange(value: string, size: number): ByteRange | null | undefined {
  if (value.length > 200 || !Number.isSafeInteger(size) || size <= 0) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return undefined;
  const total = BigInt(size);
  if (!match[1]) {
    const count = BigInt(match[2]);
    if (!count) return null;
    return { start: Number(count >= total ? 0n : total - count), end: size - 1 };
  }
  const start = BigInt(match[1]);
  const requestedEnd = match[2] ? BigInt(match[2]) : total - 1n;
  if (start >= total || requestedEnd < start) return null;
  return { start: Number(start), end: Number(requestedEnd >= total ? total - 1n : requestedEnd) };
}

function sliceStream(body: ReadableStream<Uint8Array>, start: number, end: number) {
  const reader = body.getReader();
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) { controller.close(); return; }
          const chunkStart = offset;
          offset += value.byteLength;
          if (offset <= start) continue;
          const selected = value.subarray(Math.max(0, start - chunkStart), Math.min(value.byteLength, end + 1 - chunkStart));
          if (selected.byteLength) controller.enqueue(selected);
          if (offset > end) { controller.close(); await reader.cancel(); }
          return;
        }
      } catch (error) { controller.error(error); }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
}

/** Preserve the asset headers while serving native players' byte-range requests. */
export async function videoResponse(request: Request, source: Response, fixedLength?: (length: number) => ReadableWritablePair<Uint8Array, Uint8Array>, knownSize?: number): Promise<Response> {
  if (source.status !== 200) return source;
  // The Assets binding can omit Content-Length until its response reaches the wire.
  const lengthHeader = source.headers.get("Content-Length");
  const size = lengthHeader ? Number(lengthHeader) : (knownSize ?? 0);
  if (!Number.isSafeInteger(size) || size <= 0) return source;
  const headers = new Headers(source.headers);
  headers.set("Accept-Ranges", "bytes");
  if (request.method === "HEAD") return new Response(null, { status: 200, headers });
  const value = request.headers.get("Range");
  const ifRange = request.headers.get("If-Range");
  const matches = !ifRange || (!ifRange.startsWith("W/") && (ifRange === source.headers.get("ETag") || ifRange === source.headers.get("Last-Modified")));
  const range = value && matches ? parseByteRange(value, size) : undefined;
  if (range === undefined || !source.body) return new Response(source.body, { status: 200, headers });
  if (range === null) {
    await source.body.cancel();
    headers.set("Content-Range", `bytes */${size}`);
    headers.set("Content-Length", "0");
    return new Response(null, { status: 416, headers });
  }
  headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
  headers.set("Content-Length", String(range.end - range.start + 1));
  const selected = sliceStream(source.body, range.start, range.end);
  const body = fixedLength ? selected.pipeThrough(fixedLength(range.end - range.start + 1)) : selected;
  return new Response(body, { status: 206, headers });
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    if (new URL(request.url).pathname.startsWith("/family/api/")) return reviewResponse(request, env);
    if (new URL(request.url).pathname === "/family" || new URL(request.url).pathname.startsWith("/family/")) {
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers); headers.set("Cache-Control", "private, no-store"); headers.set("X-Robots-Tag", "noindex, nofollow");
      return new Response(response.body, { status: response.status, headers });
    }
    if (new URL(request.url).pathname.startsWith("/api/")) return notesResponse(request, env);
    if (!new URL(request.url).pathname.endsWith(".mp4") || !["GET", "HEAD"].includes(request.method)) return env.ASSETS.fetch(request);
    const assetRequest = new Request(request);
    assetRequest.headers.delete("Range");
    assetRequest.headers.delete("If-Range");
    return videoResponse(request, await env.ASSETS.fetch(assetRequest), length => new FixedLengthStream(length), videoSizes[new URL(request.url).pathname]);
  },
};
