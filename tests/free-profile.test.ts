import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
test("the starter runs without optional photo/email bindings and fails closed on all submissions", async () => {
  const bundled = await build({
    entryPoints: [new URL("../src/videoWorker.ts", import.meta.url).pathname],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
  });
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: bundled.outputFiles[0].text,
      compatibilityDate: "2026-11-06",
      d1Databases: ["NOTES"],
      bindings: {
        SUBMISSIONS_ENABLED: "false",
        PHOTO_UPLOADS_ENABLED: "false",
      },
    }),
  );
  try {
    const config = await runtime.dispatchFetch(
      "https://wall.example/api/config",
    );
    assert.equal(config.status, 200);
    assert.deepEqual(await config.json(), {
      turnstileSitekey: "",
      features: { shareMemory: false, photoUploads: false },
    });
    const post = await runtime.dispatchFetch("https://wall.example/api/notes", {
      method: "POST",
      headers: {
        Origin: "https://wall.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "A", body: "Private memory" }),
    });
    assert.equal(post.status, 503);
    const family = await runtime.dispatchFetch(
      "https://wall.example/family/api/content/curated",
    );
    assert.equal(family.status, 401);
  } finally {
    await runtime.dispose();
  }
});
