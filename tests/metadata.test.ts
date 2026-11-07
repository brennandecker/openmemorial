import test from "node:test";
import assert from "node:assert/strict";
import { ageLabel, dateBounds, dateMatches, emptyFilters, filterBounds, formatMemoryDate, mediaMatches, placeMatches, type MediaMetadata, type MemoryDate } from "../src/memoryMetadata.ts";
import { mediaMetadata, people, places } from "../src/photoWallData.ts";
import { midnightInstant, postedDay } from "../src/wallSettings.ts";
const day = (value: string): MemoryDate => ({ value, precision: "day", source: "family" });
const month = (value: string): MemoryDate => ({ value, precision: "month", source: "family" });
const year = (value: string): MemoryDate => ({ value, precision: "year", source: "family" });

test("partial dates retain their precision and invalid calendar dates are rejected", () => {
  assert.deepEqual(dateBounds(month("2024-02")), { from: "2024-02-01", to: "2024-02-29" });
  assert.deepEqual(dateBounds(year("2000")), { from: "2000-01-01", to: "2000-12-31" });
  for (const value of [day("2023-02-29"), month("2024-13"), year("0000"), day("2024-02"), month("2024-2")]) assert.equal(dateBounds(value), null);
  assert.equal(formatMemoryDate(month("2009-01")), "January 2009");
  assert.equal(formatMemoryDate({ ...year("2010"), approximate: true }), "Around 2010");
});
test("age respects birthdays, partial dates, and both lifetime boundaries", () => {
  const birth = "2000-08-22", death = "2020-11-04";
  assert.equal(ageLabel(day("2002-08-21"), birth, death), "Age 1");
  assert.equal(ageLabel(day("2002-08-22"), birth, death), "Age 2");
  assert.equal(ageLabel(month("2002-08"), birth, death), "Ages 1–2");
  assert.equal(ageLabel(year("2000"), birth, death), "Age 0");
  assert.equal(ageLabel(year("2020"), birth, death), "Ages 19–20");
  assert.equal(ageLabel(year("2021"), birth, death), "");
  assert.equal(ageLabel(day("1999-01-01"), birth, death), "");
  assert.equal(ageLabel(undefined, birth, death), "");
});
test("date ranges include overlapping months and years without fabricating exact days", () => {
  const range = { year: "", from: "2009-01-20", to: "2009-01-25" };
  assert.equal(dateMatches(month("2009-01"), range), true);
  assert.equal(dateMatches(day("2009-01-28"), range), false);
  assert.equal(dateMatches(undefined, range), false);
  assert.equal(dateMatches(undefined, emptyFilters), true);
  assert.equal(dateMatches(undefined, { year: "unknown", from: "", to: "" }), true);
  assert.equal(filterBounds({ year: "2009", from: "2010-01-01", to: "" }), null);
  assert.equal(filterBounds({ year: "", from: "2009-02-30", to: "" }), null);
});
test("people, content type, and hierarchical locations combine as independent filters", () => {
  const locations = { region: { id: "region", label: "A region" }, city: { id: "city", label: "A city", parentId: "region" } };
  const media: MediaMetadata = { id: "one", kind: "photo", caption: "An unrelated caption", width: 4, height: 3, peopleIds: ["person-one"], placeId: "city", takenOn: month("2009-01"), message: "" };
  assert.equal(mediaMatches(media, { ...emptyFilters, people: ["person-one"], places: ["region"], year: "2009", kind: "photo" }, locations), true);
  assert.equal(mediaMatches(media, { ...emptyFilters, people: ["person-two"] }, locations), false);
  assert.equal(mediaMatches(media, { ...emptyFilters, kind: "note" }, locations), false);
  assert.equal(placeMatches(undefined, "unknown", locations), true);
  assert.equal(placeMatches("city", "unknown", locations), false);
});
test("published metadata has unique IDs and valid people, locations, and dates", () => {
  const ids = new Set<string>();
  for (const media of Object.values(mediaMetadata)) {
    assert.ok(!ids.has(media.id)); ids.add(media.id);
    assert.ok(media.width > 0 && media.height > 0);
    assert.ok(media.peopleIds.every(id => people[id]));
    assert.ok(!media.placeId || places[media.placeId]);
    assert.ok(!media.takenOn || dateBounds(media.takenOn));
  }
});
test("posting dates use the memorial time zone, including daylight-saving boundaries", () => {
  assert.equal(postedDay("2026-01-01T04:30:00Z"), "2025-12-31");
  assert.equal(midnightInstant("2026-03-08"), "2026-03-08T05:00:00.000Z");
  assert.equal(midnightInstant("2026-03-09"), "2026-03-09T04:00:00.000Z");
  assert.equal(midnightInstant("2026-11-01"), "2026-11-01T04:00:00.000Z");
  assert.equal(midnightInstant("2026-11-02"), "2026-11-02T05:00:00.000Z");
});


test("multiple people and locations match any selection within each group, and both groups combine", () => {
  const locations = { a: { id: "a", label: "A" }, b: { id: "b", label: "B" } };
  const media: MediaMetadata = { id: "one", kind: "photo", caption: "A memory", width: 4, height: 3, peopleIds: ["p1"], placeId: "b", message: "" };
  assert.equal(mediaMatches(media, { ...emptyFilters, people: ["p2", "p1"], places: ["a", "b"] }, locations), true);
  assert.equal(mediaMatches(media, { ...emptyFilters, people: ["p2", "p3"], places: ["b"] }, locations), false);
  assert.equal(mediaMatches(media, { ...emptyFilters, people: ["p1"], places: ["a"] }, locations), false);
});
