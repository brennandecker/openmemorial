import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyPhotoDraft, photoDraft, photoFrontNames, photoLocationLabel, validatePhotoDraft } from "../src/memoryPhoto.ts";
const catalog = { people: { alex: { id: "alex", name: "Alex" }, jordan: { id: "jordan", name: "Jordan" } }, places: {} };
test("one person per row preserves order, recognizes existing people, and keeps commas inside names", async () => {
  const draft = { ...emptyPhotoDraft, caption: "An older caption", personEntries: [{ id: "jordan", name: "Jordan" }, { name: "Taylor, Jr." }, { name: "alex" }, { name: "taylor, jr." }, { name: "" }] };
  assert.deepEqual(photoFrontNames(draft, catalog), ["Jordan", "Taylor, Jr.", "alex"]);
  const result = await validatePhotoDraft(draft, catalog); assert.ok(result);
  assert.deepEqual(result.people.map(p => p.label), ["Jordan", "Taylor, Jr.", "Alex"]);
  assert.equal(result.people[2].id, "alex");
  const restored = photoDraft(result, catalog);
  assert.equal(restored.personEntries?.[1].name, "Taylor, Jr.");
  assert.equal(restored.personEntries?.length, 3);
  assert.equal(await validatePhotoDraft({ ...draft, personEntries: [{ id: "unknown", name: "Someone" }] }, catalog), null);
});
test("city, state and country are stored separately, optional, validated, and round-trip through review", async () => {
  const draft = { ...emptyPhotoDraft, city: " Test City ", state: " OR ", country: " United States " };
  assert.equal(photoLocationLabel(draft, catalog), "Test City, OR, United States");
  const result = await validatePhotoDraft(draft, catalog); assert.ok(result?.place);
  assert.equal(result.place.city, "Test City"); assert.equal(result.place.state, "OR"); assert.equal(result.place.country, "United States");
  const restored = photoDraft(result, catalog); assert.equal(restored.city, "Test City"); assert.equal(restored.state, "OR"); assert.equal(restored.country, "United States");
  const cityOnly = await validatePhotoDraft({ ...emptyPhotoDraft, city: "Test City" }, catalog);
  assert.equal(cityOnly?.place?.label, "Test City"); assert.equal(cityOnly?.place?.country, undefined); assert.equal(cityOnly?.place?.state, undefined);
  assert.equal((await validatePhotoDraft(emptyPhotoDraft, catalog))?.place, undefined);
  assert.equal(await validatePhotoDraft({ ...draft, country: "x".repeat(81) }, catalog), null);
  assert.equal(await validatePhotoDraft({ ...draft, city: "Test\nCity" }, catalog), null);
});
test("legacy name lists and location labels remain usable", async () => {
  const result = await validatePhotoDraft({ ...emptyPhotoDraft, peopleIds: ["alex"], otherPeople: "Jordan", location: "A remembered location" }, catalog);
  assert.deepEqual(result?.people.map(p => p.label), ["Alex", "Jordan"]);
  assert.equal(result?.place?.label, "A remembered location");
  assert.equal(photoLocationLabel(photoDraft(result!, catalog), catalog), "A remembered location");
});
