import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  writeFile,
  mkdir,
  cp,
  rm,
  stat,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
// CLI modules intentionally use the same Node runtime as setup, with no network in these tests.
// @ts-expect-error The CLI modules are JavaScript and exercised directly.
import * as setupCore from "../scripts/setup/core.mjs";
// @ts-expect-error The CLI modules are JavaScript and exercised directly.
import * as setupContent from "../scripts/setup/content.mjs";
const { validateAnswers, freeConfig, doctor, provision, CloudflareClient, saveJSON } = setupCore;
const { preparePhotos, applyContent } = setupContent;
import { runtimeFeatures } from "../src/runtimeFeatures.ts";
const input = {
  name: "Alex Example",
  workerName: "remembering-alex",
  privacyEmail: "privacy@family.test",
  managers: ["Parent@family.test"],
  accountId: "a".repeat(32),
  birth: "2000-02-29",
  death: "2025-05-01",
  timeZone: "America/New_York",
  photos: [],
  portrait: null,
};
const answers = () => validateAnswers(input);
test("onboarding validates exact emails, life dates, account targets, and free-only profiles", () => {
  assert.equal(answers().managers[0], "parent@family.test");
  for (const invalid of [
    { profile: "paid" },
    { managers: ["*@family.test"] },
    { managers: [], notes: true },
    { birth: "2001-02-29" },
    { death: "1999-01-01" },
    { timeZone: "not-a-zone" },
    { accountId: "bad" },
    { workerName: "../../another-worker" },
    { photos: [{ file: "photo.jpg", date: "2026-02-30" }] },
  ])
    assert.throws(() => validateAnswers({ ...input, ...invalid }));
  assert.equal(
    validateAnswers({
      ...input,
      birth: "",
      death: "",
      notes: false,
      managers: [],
    }).notes,
    false,
  );
});
test("free configuration excludes subscriptions, email delivery, purchased domains, and manager addresses", async () => {
  const base = JSON.parse(
    await readFile(
      new URL("../config/wrangler.uploads.jsonc", import.meta.url),
      "utf8",
    ),
  );
  const config = freeConfig(
    { ...base, routes: [{ pattern: "private.test" }] },
    answers(),
    { databaseId: "db-id" },
  );
  for (const key of ["r2_buckets", "images", "send_email", "routes", "secrets"])
    assert.equal(config[key], undefined);
  assert.equal(config.vars.PHOTO_UPLOADS_ENABLED, "false");
  assert.equal(config.workers_dev, true);
  assert.equal(config.d1_databases[0].database_id, "db-id");
  assert.ok(!JSON.stringify(config).includes("parent@family.test"));
});
test("doctor refuses missing protection, changed targets, and billable optional bindings", async () => {
  const a = answers(),
    base = JSON.parse(
      await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    );
  const state = {
    accountId: a.accountId,
    workerName: a.workerName,
    databaseId: "db-id",
    applicationId: "app",
    subdomain: "family",
    hostname: "remembering-alex.family.workers.dev",
  };
  const config = freeConfig(base, a, state),
    secrets = {
      ACCESS_AUD: "aud",
      ACCESS_TEAM_DOMAIN: "https://family.cloudflareaccess.com",
      MODERATOR_EMAILS: "parent@family.test",
      TURNSTILE_SECRET: "secret",
      TURNSTILE_SITEKEY: "0x-real-key",
      TURNSTILE_HOSTNAMES: state.hostname,
    };
  assert.ok(
    doctor(a, config, state, secrets).every((c: { ok: boolean }) => c.ok),
  );
  assert.ok(doctor(a, config, state, {}).some((c: { ok: boolean }) => !c.ok));
  assert.ok(
    doctor(a, { ...config, r2_buckets: [{}] }, state, secrets).some(
      (c: { ok: boolean }) => !c.ok,
    ),
  );
  assert.ok(
    doctor(a, { ...config, account_id: "b".repeat(32) }, state, secrets).some(
      (c: { ok: boolean }) => !c.ok,
    ),
  );
});
function fakeClient(
  options: {
    noOrg?: boolean;
    existingWorker?: boolean;
    sharedPolicy?: boolean;
  } = {},
) {
  const calls: { method: string; resource: string; body?: unknown }[] = [];
  const request = async (
    method: string,
    resource: string,
    body: Record<string, unknown>,
  ) => {
    calls.push({ method, resource, body });
    let result: unknown;
    if (resource === "/workers/subdomain") result = { subdomain: "family" };
    else if (resource === "/access/organizations") {
      if (options.noOrg)
        throw Object.assign(new Error("Not configured"), { status: 404 });
      result = { auth_domain: "family.cloudflareaccess.com" };
    } else if (resource === "/d1/database") result = { uuid: "db-id" };
    else if (resource === "/challenges/widgets")
      result = { sitekey: "0x-real-key", secret: "widget-secret" };
    else if (resource === "/access/identity_providers") result = { id: "otp" };
    else if (resource === "/access/policies") result = { id: "policy" };
    else if (resource === "/access/policies/policy")
      result = {
        name: "remembering-alex family",
        app_count: options.sharedPolicy ? 2 : 1,
      };
    else if (resource === "/access/apps" || resource === "/access/apps/app")
      result = {
        id: "app",
        aud: "aud",
        name: "remembering-alex family",
        domain: "remembering-alex.family.workers.dev/family",
      };
    else throw new Error("Unexpected resource " + resource);
    return { success: true, result };
  };
  return {
    calls,
    request,
    list: async (resource: string) => {
      calls.push({ method: "GET", resource });
      return resource === "/workers/scripts" && options.existingWorker
        ? [{ id: "remembering-alex" }]
        : [];
    },
  };
}
test("provisioning creates only the free resources, resumes without duplicates, and synchronizes managers", async () => {
  const client = fakeClient(),
    state: Record<string, unknown> = {},
    secrets: Record<string, string> = {},
    a = answers();
  let saves = 0;
  await provision(client, a, state, secrets, async () => {
    saves++;
  });
  assert.ok(saves >= 5);
  assert.equal(secrets.MODERATOR_EMAILS, "parent@family.test");
  assert.equal(state.hostname, "remembering-alex.family.workers.dev");
  assert.ok(
    client.calls.every(
      (c) =>
        !["r2", "images", "email", "billing", "subscriptions"].some((v) =>
          c.resource.includes(v),
        ),
    ),
  );
  const posts = client.calls.filter((c) => c.method === "POST").length;
  await provision(
    client,
    { ...a, managers: ["parent@family.test", "sibling@family.test"] },
    state,
    secrets,
    async () => {},
  );
  assert.equal(client.calls.filter((c) => c.method === "POST").length, posts);
  assert.equal(
    secrets.MODERATOR_EMAILS,
    "parent@family.test,sibling@family.test",
  );
  assert.ok(!JSON.stringify(secrets).includes("api-token"));
});
test("setup fails safely before modifying an existing worker or a missing Access organization", async () => {
  for (const options of [{ existingWorker: true }, { noOrg: true }]) {
    const client = fakeClient(options);
    await assert.rejects(provision(client, answers(), {}, {}, async () => {}));
    assert.equal(
      client.calls.some((c) => c.method !== "GET"),
      false,
    );
  }
  const client = fakeClient();
  await assert.rejects(
    provision(
      client,
      answers(),
      { accountId: "b".repeat(32), workerName: "other" },
      {},
      async () => {},
    ),
  );
  assert.equal(client.calls.length, 0);
});
test("resuming setup refuses to change a policy shared with another application", async () => {
  const state = {
      accountId: input.accountId,
      workerName: input.workerName,
      databaseId: "db-id",
      widgetId: "0x-key",
      identityProviderId: "otp",
      policyId: "policy",
      applicationId: "app",
    },
    client = fakeClient({ sharedPolicy: true });
  await assert.rejects(
    provision(
      client,
      answers(),
      state,
      { TURNSTILE_SECRET: "secret" },
      async () => {},
    ),
  );
  assert.equal(
    client.calls.some((c) => c.method === "PUT"),
    false,
  );
});
test("Cloudflare API errors never echo tokens, response bodies, or secret values", async () => {
  const token = "sensitive-token";
  const client = new CloudflareClient(
    input.accountId,
    token,
    async () =>
      new Response(
        JSON.stringify({ success: false, errors: [{ message: token }] }),
        { status: 403 },
      ),
  );
  await assert.rejects(
    client.request("GET", "/access/apps"),
    (error: Error) =>
      !error.message.includes(token) && error.message.includes("403"),
  );
});
test("unconfigured templates close submissions and optional uploads require real bindings", () => {
  assert.deepEqual(runtimeFeatures({}), {
    shareMemory: false,
    photoUploads: false,
  });
  const ready = {
    NOTES: {} as D1Database,
    ACCESS_AUD: "a",
    ACCESS_TEAM_DOMAIN: "https://family.cloudflareaccess.com",
    MODERATOR_EMAILS: "parent@family.test",
    TURNSTILE_SITEKEY: "key",
    TURNSTILE_SECRET: "s",
    TURNSTILE_HOSTNAMES: "family.test",
  };
  assert.deepEqual(runtimeFeatures(ready), {
    shareMemory: true,
    photoUploads: false,
  });
  assert.equal(
    runtimeFeatures({ ...ready, SUBMISSIONS_ENABLED: "false" }).shareMemory,
    false,
  );
});
test("local photo preparation removes metadata and generates only public content; secrets are private", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openmemorial-setup-"));
  try {
    await mkdir(path.join(root, "src"));
    await cp(
      new URL("../src/memorial.ts", import.meta.url),
      path.join(root, "src/memorial.ts"),
    );
    for (const file of ["photoWallData.ts", "sitePolicy.ts", "wallSettings.ts"])
      await cp(
        new URL("../src/" + file, import.meta.url),
        path.join(root, "src", file),
      );
    await cp(
      new URL("../index.html", import.meta.url),
      path.join(root, "index.html"),
    );
    const file = path.join(root, "photo.jpg");
    await sharp({
      create: { width: 160, height: 100, channels: 3, background: "#ead9bc" },
    })
      .withMetadata({ exif: { IFD0: { Artist: "Private camera owner" } } })
      .jpeg()
      .toFile(file);
    const a = validateAnswers({
      ...input,
      name: 'Alex "Example" <&>',
      photos: [
        {
          file,
          caption: "Alex and family",
          people: ["Alex", "Aunt Example"],
          date: "2014-10",
          city: "Portland",
          state: "OR",
          country: "US",
        },
      ],
      portrait: 0,
    });
    const photos = await preparePhotos(a.photos, root);
    const meta = await sharp(photos[0].bytes).metadata();
    assert.equal(meta.exif, undefined);
    assert.equal(meta.xmp, undefined);
    assert.equal(meta.width, 160);
    await applyContent(root, a, photos, {
      hostname: "remembering-alex.family.workers.dev",
    });
    const publicFiles = await Promise.all(
      [
        "src/memorial.ts",
        "src/photoWallData.ts",
        "src/sitePolicy.ts",
        "index.html",
      ].map((file) => readFile(path.join(root, file), "utf8")),
    );
    assert.ok(!publicFiles.join().includes("parent@family.test"));
    assert.ok(!publicFiles.join().includes("Private camera owner"));
    assert.ok(publicFiles[3].includes("&lt;&amp;&gt;"));
    assert.ok(publicFiles[1].includes("2014-10"));
    const secretFile = path.join(root, ".openmemorial/secrets.json");
    await saveJSON(secretFile, { secret: "private" });
    if (process.platform !== "win32")
      assert.equal((await stat(secretFile)).mode & 0o077, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
