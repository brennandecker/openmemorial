import assert from "node:assert/strict";
import test from "node:test";
import { parseByteRange, videoResponse } from "../src/videoWorker.ts";

function asset() {
  return new Response(new ReadableStream({ start(controller) { for (const chunk of ["012", "3456", "789"]) controller.enqueue(new TextEncoder().encode(chunk)); controller.close(); } }), {
    headers: { "Content-Type": "video/mp4", "Content-Length": "10", "ETag": '"one"', "X-Content-Type-Options": "nosniff" },
  });
}
const request = (range?: string, extra: Record<string, string> = {}) => new Request("https://memorial.example/share/video.mp4", { headers: { ...(range ? { Range: range } : {}), ...extra } });

test("native player probe returns the exact requested first bytes", async () => {
  const response = await videoResponse(request("bytes=0-1"), asset());
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("Content-Range"), "bytes 0-1/10");
  assert.equal(response.headers.get("Content-Length"), "2");
  assert.equal(response.headers.get("Accept-Ranges"), "bytes");
  assert.equal(response.headers.get("Content-Type"), "video/mp4");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(await response.text(), "01");
});

test("ranges cross stream chunks without reading beyond the selected bytes", async () => {
  const response = await videoResponse(request("bytes=2-7"), asset());
  assert.equal(await response.text(), "234567");
  assert.equal(response.headers.get("Content-Length"), "6");
});

test("open-ended, suffix and oversized end ranges are supported", async () => {
  for (const [header, expected] of [["bytes=7-", "789"], ["bytes=-3", "789"], ["bytes=-99", "0123456789"], ["bytes=7-99999999999999999999", "789"]]) {
    const response = await videoResponse(request(header), asset());
    assert.equal(response.status, 206);
    assert.equal(await response.text(), expected);
  }
});

test("unsatisfiable ranges produce 416 without a body", async () => {
  for (const header of ["bytes=10-", "bytes=7-2", "bytes=-0"]) {
    const response = await videoResponse(request(header), asset());
    assert.equal(response.status, 416);
    assert.equal(response.headers.get("Content-Range"), "bytes */10");
    assert.equal(await response.text(), "");
  }
});

test("unsupported and malformed ranges fall back to the complete asset", async () => {
  for (const header of ["bytes=0-1,4-5", "words=1-2", "bytes=-", "bytes=oops"]) {
    const response = await videoResponse(request(header), asset());
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "0123456789");
  }
  assert.equal(parseByteRange("bytes=0-1", 0), undefined);
});

test("If-Range validators prevent combining bytes from different versions", async () => {
  for (const [validator, status] of [['"one"', 206], ['"two"', 200], ['W/"one"', 200]] as const) {
    const response = await videoResponse(request("bytes=0-1", { "If-Range": validator }), asset());
    assert.equal(response.status, status);
    assert.equal(await response.text(), status === 206 ? "01" : "0123456789");
  }
});

test("HEAD and conditional asset responses keep their HTTP semantics", async () => {
  const head = await videoResponse(new Request("https://memorial.example/share/video.mp4", { method: "HEAD" }), new Response(null, { headers: { "Content-Length": "10" } }));
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("Content-Length"), "10");
  assert.equal(await head.text(), "");
  const unchanged = new Response(null, { status: 304 });
  assert.equal(await videoResponse(request("bytes=0-1"), unchanged), unchanged);
});


test("known asset sizes support range delivery when the Assets binding omits Content-Length", async () => {
  const source = asset();
  source.headers.delete("Content-Length");
  let declaredLength = 0;
  const response = await videoResponse(request("bytes=2-4"), source, length => { declaredLength = length; return new TransformStream(); }, 10);
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("Content-Range"), "bytes 2-4/10");
  assert.equal(declaredLength, 3);
  assert.equal(await response.text(), "234");
});
