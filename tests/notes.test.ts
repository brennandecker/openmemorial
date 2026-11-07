import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { ReadableStream as NodeReadableStream } from "node:stream/web";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { validateNote } from "../src/notesApi.ts";
let runtime: Miniflare; let identity: string; let secondIdentity: string; let wrongIdentity: string; let wrongAudience: string; let expired: string;
const issuer = "https://test-team.cloudflareaccess.com";
const tokens = new Set<string>();
before(async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJWK = { ...await exportJWK(publicKey), kid: "test-key", alg: "RS256", use: "sig" };
  const sign = (email: string, audience = "family-review", expiration = "1h") => new SignJWT({ email }).setProtectedHeader({ alg: "RS256", kid: "test-key" }).setIssuer(issuer).setAudience(audience).setSubject(email).setIssuedAt().setExpirationTime(expiration).sign(privateKey);
  identity = await sign("reviewer1@example.test"); secondIdentity = await sign("reviewer2@example.test"); wrongIdentity = await sign("stranger@example.test"); wrongAudience = await sign("reviewer1@example.test", "another-app"); expired = await sign("reviewer1@example.test", "family-review", "-1h");
  const bundled = await build({ stdin: { contents: 'import { notesResponse } from "./notesApi.ts"; import { reviewResponse } from "./reviewApi.ts"; export default { fetch(request,env) { return new URL(request.url).pathname.startsWith("/family/") ? reviewResponse(request,env) : notesResponse(request,env); } };', resolveDir: new URL("../src/", import.meta.url).pathname }, bundle: true, write: false, format: "esm", platform: "browser", target: "es2022" });
  runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundled.outputFiles[0].text, compatibilityDate: "2026-11-06", d1Databases: ["NOTES"], bindings: { TURNSTILE_SECRET: "test-secret", TURNSTILE_SITEKEY: "test-sitekey", TURNSTILE_HOSTNAMES: "wall.example", ACCESS_TEAM_DOMAIN: issuer, ACCESS_AUD: "family-review", MODERATOR_EMAILS: "reviewer1@example.test,reviewer2@example.test" }, ratelimits: { NOTE_LIMITER: { namespace_id: "87175743", simple: { limit: 3, period: 60 } } }, outboundService: async request => {
    if (request.url === `${issuer}/cdn-cgi/access/certs`) return Response.json({ keys: [publicJWK] });
    if (request.url === "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
      const form = new URLSearchParams(await request.text()); const token = form.get("response") || "";
      if (token === "network-error") return new Response("unavailable", { status: 503 });
      if (token.startsWith("valid-") && !tokens.has(token)) { tokens.add(token); return Response.json({ success: true, hostname: "wall.example", action: "share_memory" }); }
      if (token === "wrong-host") return Response.json({ success: true, hostname: "elsewhere.example", action: "share_memory" });
      if (token === "wrong-action") return Response.json({ success: true, hostname: "wall.example", action: "other" });
      return Response.json({ success: false });
    }
    return new Response("Unexpected outbound request", { status: 500 });
  } }));
  const db = await runtime.getD1Database("NOTES");
  for (const file of ["0001_wall_notes.sql", "0002_memory_approval.sql"]) { const schema = await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"); await db.batch(schema.split(/;\s*(?=ALTER|CREATE|UPDATE|$)/).filter(sql => sql.trim()).map(sql => db.prepare(sql))); if (file === "0001_wall_notes.sql") await db.batch([db.prepare("INSERT INTO wall_notes(id,name,body,created_at,hidden) VALUES('legacy-visible','Fixture','Previously public','2020-01-01T00:00:00Z',0)"),db.prepare("INSERT INTO wall_notes(id,name,body,created_at,hidden) VALUES('legacy-hidden','Fixture','Previously hidden','2020-01-01T00:00:00Z',1)")]); }
});
after(async () => { await runtime?.dispose(); });
const post = (value: unknown, ip: string = crypto.randomUUID(), origin = "https://wall.example") => runtime.dispatchFetch("https://wall.example/api/notes", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": ip }, body: JSON.stringify(value) });
const publicNotes = async (query = "") => (await (await runtime.dispatchFetch(`https://wall.example/api/notes${query}`)).json()) as { notes: { id: string; body: string }[]; hasMore: boolean };
const queue = async (jwt = identity, query = "") => runtime.dispatchFetch(`https://wall.example/family/api/notes${query}`, { headers: jwt ? { "Cf-Access-Jwt-Assertion": jwt } : {} });
const review = (id: string, action: string, version: number, jwt = identity, origin = "https://wall.example") => runtime.dispatchFetch(`https://wall.example/family/api/notes/${id}/review`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "Cf-Access-Jwt-Assertion": jwt }, body: JSON.stringify({ action, version }) });
test("names and messages require content, enforce limits and reject the honeypot", () => {
  for (const input of [null, {}, { name: " ", body: "hi" }, { name: "A", body: " " }, { name: "a".repeat(81), body: "hi" }, { name: "A", body: "b".repeat(1001) }, { name: "A\nB", body: "hi" }, { name: "A", body: "hi\u0000" }, { name: "A", body: "hi", website: "spam" }]) assert.equal(validateNote(input), null);
  assert.deepEqual(validateNote({ name: "  Family  ", body: " A memory.\r\nWith love. " }), { name: "Family", body: "A memory.\nWith love." });
});
test("migration preserves existing published and hidden memories", async () => {
  const db = await runtime.getD1Database("NOTES");
  const rows = await db.prepare("SELECT id, hidden, status FROM wall_notes WHERE id LIKE 'legacy-%' ORDER BY id").all();
  assert.deepEqual(rows.results, [{id:"legacy-hidden",hidden:1,status:"hidden"},{id:"legacy-visible",hidden:0,status:"approved"}]);
  assert.deepEqual((await publicNotes()).notes.map(n => n.id), ["legacy-visible"]);
  await db.prepare("DELETE FROM wall_notes WHERE id IN ('legacy-hidden','legacy-visible')").run();
});
test("submissions stay private until approved; publishing, hiding and concurrent reviews are audited", async () => {
  const body = "<script>alert('x')</script>\nA treasured memory.";
  const response = await post({ name: "Family", body, token: "valid-private", status: "approved", reviewedBy: "intruder" });
  assert.equal(response.status, 202); assert.deepEqual(await response.json(), { submitted: true }); assert.equal((await publicNotes()).notes.length, 0);
  const { notes } = await (await queue()).json() as { notes: { id: string; body: string; status: string; version: number }[] };
  const note = notes.find(note => note.body === body)!; assert.ok(note); assert.equal(note.status, "pending");
  const decisions = await Promise.all([review(note.id, "approve", 0), review(note.id, "approve", 0, secondIdentity)]); assert.deepEqual(decisions.map(r => r.status).sort(), [200, 409]);
  assert.equal((await publicNotes()).notes.find(n => n.id === note.id)?.body, body);
  assert.equal((await review(note.id, "hide", 1)).status, 200); assert.equal((await publicNotes()).notes.length, 0);
  assert.equal((await review(note.id, "approve", 2, secondIdentity)).status, 200);
  const db = await runtime.getD1Database("NOTES"); const history = await db.prepare("SELECT action,reviewer FROM wall_note_reviews WHERE note_id = ? ORDER BY created_at").bind(note.id).all<{ action: string; reviewer: string }>();
  assert.equal(history.results.length, 3); assert.deepEqual(history.results.map((r: { action: string }) => r.action), ["approve", "hide", "approve"]); assert.equal(history.results[2].reviewer, "reviewer2@example.test");
});
test("anonymous, forged, expired, wrong-audience and non-family identities cannot read or approve", async () => {
  for (const jwt of ["", "not-a-token", identity.slice(0, -10) + "tampered00", wrongIdentity, wrongAudience, expired]) { assert.equal((await queue(jwt)).status, 401); assert.equal((await review(crypto.randomUUID(), "approve", 0, jwt)).status, 401); }
  assert.equal((await queue(secondIdentity)).status, 200); assert.equal((await review(crypto.randomUUID(), "approve", 0, identity, "https://elsewhere.example")).status, 403);
});
test("decision history is private, ordered, and paginated without exposing unrelated memories", async () => {
  const db = await runtime.getD1Database("NOTES");
  const id = crypto.randomUUID(); const other = crypto.randomUUID();
  await db.batch([id, other].map(value => db.prepare("INSERT INTO wall_notes(id,name,body,created_at,status) VALUES(?,?,?,?,?)").bind(value, "History fixture", "Private memory", "2020-01-01T00:00:00Z", "declined")));
  await db.batch(Array.from({ length: 32 }, (_, index) => db.prepare("INSERT INTO wall_note_reviews(id,note_id,reviewer,action,previous_status,status,created_at) VALUES(?,?,?,?,?,?,?)").bind(`history-${index}`, index === 31 ? other : id, "reviewer1@example.test", "decline", "pending", "declined", "2020-01-02T00:00:00Z")));
  const history = (jwt = identity, query = "") => runtime.dispatchFetch(`https://wall.example/family/api/notes/${id}/history${query}`, { headers: jwt ? { "Cf-Access-Jwt-Assertion": jwt } : {} });
  for (const jwt of ["", "forged", wrongIdentity, wrongAudience, expired]) assert.equal((await history(jwt)).status, 401);
  const response = await history(); assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const first = await response.json() as { history: { id: string; previousStatus: string; reviewer: string }[]; hasMore: boolean };
  const second = await (await history(secondIdentity, "?page=1")).json() as { history: { id: string }[]; hasMore: boolean };
  assert.equal(first.history.length, 30); assert.equal(first.hasMore, true); assert.equal(first.history[0].id, "history-30"); assert.equal(first.history[0].previousStatus, "pending"); assert.equal(first.history[0].reviewer, "reviewer1@example.test");
  assert.equal(second.history.length, 1); assert.equal(second.hasMore, false); assert.equal(second.history[0].id, "history-0");
  assert.equal((await history(identity, "?page=-1")).status, 400);
  assert.equal((await runtime.dispatchFetch(`https://wall.example/family/api/notes/${crypto.randomUUID()}/history`, { headers: { "Cf-Access-Jwt-Assertion": identity } })).status, 404);
  assert.equal((await runtime.dispatchFetch(`https://wall.example/family/api/notes/${id}/history`, { method: "DELETE", headers: { "Cf-Access-Jwt-Assertion": identity } })).status, 405);
  // Retention has no automatic purge: even an old declined record remains recoverable.
  assert.equal((await publicNotes()).notes.some(n => n.id === id), false);
  assert.equal((await review(id, "approve", 0, secondIdentity)).status, 200);
  assert.equal((await publicNotes()).notes.some(n => n.id === id), true);
  await db.batch([db.prepare("DELETE FROM wall_note_reviews WHERE note_id IN (?,?)").bind(id, other), db.prepare("DELETE FROM wall_notes WHERE id IN (?,?)").bind(id, other)]);
});
test("verification rejects missing, invalid, replayed, wrong-host, wrong-action and unavailable tokens", async () => {
  for (const token of [undefined, "invalid", "wrong-host", "wrong-action", "network-error"]) assert.equal((await post({ name: "Family", body: "Hello", token })).status, 403);
  assert.equal((await post({ name: "Family", body: "Hello", token: "valid-replay" })).status, 202); assert.equal((await post({ name: "Family", body: "Hello", token: "valid-replay" })).status, 403);
});
test("declined memories stay private and can later be published by either reviewer", async () => {
  await post({ name: "Decline fixture", body: "Keep this private", token: "valid-decline" });
  const { notes } = await (await queue()).json() as { notes: { id: string; name: string }[] }; const note = notes.find(n => n.name === "Decline fixture")!;
  assert.equal((await review(note.id, "decline", 0, secondIdentity)).status, 200); assert.equal((await publicNotes()).notes.some(n => n.id === note.id), false); assert.equal((await review(note.id, "approve", 1)).status, 200); assert.equal((await review(note.id, "decline", 2)).status, 409);
});
test("cross-origin, malformed JSON and oversized chunked requests cannot submit", async () => {
  assert.equal((await post({ name: "A", body: "B" }, "192.0.2.2", "https://elsewhere.example")).status, 403); assert.equal((await post({ name: "A", body: "B", website: "spam" })).status, 400);
  assert.equal((await runtime.dispatchFetch("https://wall.example/api/notes", { method: "POST", headers: { Origin: "https://wall.example", "Content-Type": "application/json" }, body: "{" })).status, 400);
  const body = new NodeReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(9000))); controller.close(); } });
  assert.equal((await runtime.dispatchFetch("https://wall.example/api/notes", { method: "POST", headers: { Origin: "https://wall.example", "Content-Type": "application/json" }, body, duplex: "half" })).status, 413);
});
test("posting is rate limited and pagination includes only approved memories", async () => {
  for (let i = 0; i < 3; i++) assert.equal((await post({ name: "A", body: "One", token: `valid-limit-${i}` }, "192.0.2.3")).status, 202);
  const limited = await post({ name: "A", body: "Three", token: "valid-limit-extra" }, "192.0.2.3"); assert.equal(limited.status, 429);
  assert.equal((await runtime.dispatchFetch("https://wall.example/api/notes?page=-1")).status, 400); assert.equal((await runtime.dispatchFetch("https://wall.example/api/notes", { method: "DELETE" })).status, 405);
  const db = await runtime.getD1Database("NOTES"); await db.batch(Array.from({ length: 33 }, (_, index) => db.prepare("INSERT INTO wall_notes(id,name,body,created_at,status) VALUES(?,?,?,?,?)").bind(`page-${index}`, "Family", "A memory", `2020-01-01T00:00:${String(index).padStart(2, "0")}Z`, "approved")));
  const first = await publicNotes(); const second = await publicNotes("?page=1"); assert.equal(first.notes.length, 30); assert.equal(first.hasMore, true); assert.equal(second.hasMore, false); assert.equal(new Set([...first.notes, ...second.notes].map(n => n.id)).size, 35);
});
test("date filtering happens before pagination and uses the memorial time zone", async () => {
  const db = await runtime.getD1Database("NOTES"); await db.batch([db.prepare("INSERT INTO wall_notes(id,name,body,created_at,status) VALUES(?,?,?,?,?)").bind("boundary-one", "Family", "December note", "2026-01-01T04:30:00.000Z", "approved"), db.prepare("INSERT INTO wall_notes(id,name,body,created_at,status) VALUES(?,?,?,?,?)").bind("boundary-two", "Family", "January note", "2026-01-01T05:01:00.000Z", "approved")]);
  assert.deepEqual((await publicNotes("?year=2025")).notes.map(n => n.id), ["boundary-one"]); assert.deepEqual((await publicNotes("?from=2026-01-01&to=2026-01-01")).notes.map(n => n.id), ["boundary-two"]);
  for (const query of ["year=oops", "from=2026-02-30", "from=2026-02-01&to=2026-01-01", "year=2025&from=2026-01-01"]) assert.equal((await runtime.dispatchFetch(`https://wall.example/api/notes?${query}`)).status, 400);
});
