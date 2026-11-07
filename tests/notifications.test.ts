import { test } from "node:test";
import assert from "node:assert/strict";
import { notifyFamily } from "../src/notifyFamily.ts";

test("family notification goes only to configured reviewers and includes no contributor content", async () => {
  const messages: unknown[] = [];
  const result = await notifyFamily({ FAMILY_EMAIL: { send: async (message: unknown) => { messages.push(message); return { messageId: "fixture" }; } }, NOTIFICATION_FROM: "memories@example.com", NOTIFICATION_REVIEW_URL: "https://example.com/family", MODERATOR_EMAILS: "reviewer1@example.test,reviewer2@example.test,reviewer1@example.test" });
  assert.equal(result, true);
  const message = messages[0] as { bcc: string[]; text: string; html: string; attachments?: unknown };
  assert.deepEqual(message.bcc, ["reviewer1@example.test", "reviewer2@example.test"]);
  assert.match(message.text, /https:\/\/example.com\/family/);
  assert.equal(message.attachments, undefined);
  assert.equal(message.text.includes("reviewer1@example.test"), false);
});
test("notification failure or missing configuration never claims the family was notified", async () => {
  assert.equal(await notifyFamily({}), false);
  assert.equal(await notifyFamily({ FAMILY_EMAIL: { send: async () => { throw new Error("Unavailable"); } }, NOTIFICATION_FROM: "memories@example.com", NOTIFICATION_REVIEW_URL: "https://example.com/family", MODERATOR_EMAILS: "reviewer@example.test" }), false);
});
