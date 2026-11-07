import assert from "node:assert/strict";
import test from "node:test";
import { createExport, escapeHtml, formatDate, initialMemorial, isMemorial, preparePortableMemorial, upgradeFamilyMedia, familyPhotos } from "../src/memorial.ts";

const textOnly = { ...initialMemorial, portrait: "", photos: [], videos: [] };

test("family dates display without a local timezone shift", () => {
  assert.equal(formatDate("2000-01-02"), "January 2, 2000");
  assert.equal(formatDate("2020-03-04"), "March 4, 2020");
  assert.equal(formatDate(""), "");
});

test("backups round-trip complete records and allow optional dates", () => {
  const memorial = { ...textOnly, name: "María 李", birth: "", death: "", memories: [{ id: "1", author: "A friend", text: "A story\nwith two lines." }] };
  const backup = JSON.parse(JSON.stringify(memorial));
  assert.ok(isMemorial(backup));
  assert.deepEqual(backup, memorial);
});

test("malformed backup fields and impossible or reversed dates are rejected", () => {
  for (const patch of [{ name: " " }, { birth: "2026-02-30" }, { birth: "not-a-date" }, { birth: "2027-01-01", death: "2020-03-04" }, { photos: {} }, { memories: [{ author: "a" }] }, { theme: "javascript" }]) {
    assert.equal(isMemorial({ ...textOnly, ...patch }), false, JSON.stringify(patch));
  }
  assert.equal(isMemorial(null), false);
  assert.equal(isMemorial({}), false);
});

test("backups reject remote images and SVG payloads", () => {
  for (const image of ["https://example.com/tracker.jpg", "javascript:alert(1)", "data:image/svg+xml;base64,PHN2Zz4=", 'data:image/jpeg;base64,abc" onerror="alert(1)']) {
    assert.equal(isMemorial({ ...textOnly, portrait: image }), false);
    assert.equal(isMemorial({ ...textOnly, photos: [image] }), false);
  }
  assert.ok(isMemorial({ ...textOnly, photos: ["data:image/png;base64,aGVsbG8="] }));
});

test("offline export escapes hostile text in names, stories, service and memories", () => {
  const hostile = '<script>alert("x")</script><img src=x onerror=alert(1)>';
  const html = createExport({ ...textOnly, name: hostile, story: hostile, quote: hostile, attribution: hostile, service: hostile, memories: [{ id: "1", author: hostile, text: hostile }] });
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("default-src 'none'"));
  assert.ok(!html.includes("https://"));
  assert.equal(escapeHtml("<&\"'>"), "&lt;&amp;&quot;&#39;&gt;");
});

test("export contains a portrait, gallery, memories and gathering details without scripts", () => {
  const image = "data:image/png;base64,aGVsbG8=";
  const html = createExport({ ...textOnly, portrait: image, photos: [image], memories: [{ id: "1", author: "Family", text: "Remembered with love." }], service: "Details from the family." });
  assert.ok(html.includes("Someone you love"));
  assert.ok(html.includes("Remembered with love."));
  assert.ok(html.includes("Details from the family."));
  assert.equal(html.match(/<img /g)?.length, 2);
  assert.ok(!html.includes("<script"));
});


