import { test } from "node:test";
import assert from "node:assert/strict";
import { cameraDateFromMetadata, chosenPhotoDate } from "../src/photoDateChoice.ts";
import { emptyPhotoDraft, publicPhoto, validatePhotoDraft } from "../src/memoryPhoto.ts";

test("camera dates preserve the calendar day, fall back to CreateDate, and reject impossible dates", () => {
  assert.equal(cameraDateFromMetadata({ DateTimeOriginal: "2014:10:25 23:59:59-0700" }), "2014-10-25");
  assert.equal(cameraDateFromMetadata({ DateTimeOriginal: "0000:00:00 00:00:00", CreateDate: "2011:01:09 12:00:00" }), "2011-01-09");
  assert.equal(cameraDateFromMetadata({ DateTimeOriginal: "2025:02:29 12:00:00" }), "");
  assert.equal(cameraDateFromMetadata(null), "");
});
test("a contributor must choose the camera date, entered date, or unknown", () => {
  assert.equal(chosenPhotoDate("2014-10-25", "2025-10", ""), null);
  assert.equal(chosenPhotoDate("", "2025-10", "camera"), null);
  assert.equal(chosenPhotoDate("2014-10-25", "", "entered"), null);
  assert.equal(chosenPhotoDate("2014-10-25", "2025-02-29", "entered"), null);
  assert.deepEqual(chosenPhotoDate("2014-10-25", "2025-10", "camera"), { date: "2014-10-25", dateSource: "camera", dateEvidence: { cameraDate: "2014-10-25", enteredDate: "2025-10", selected: "camera" } });
  assert.equal(chosenPhotoDate("2014-10-25", "2025", "entered")?.date, "2025");
  assert.equal(chosenPhotoDate("2014-10-25", "2025-10", "unknown")?.date, "");
});
test("the server rejects a selected date that disagrees with its evidence and keeps alternatives private", async () => {
  const catalog = { people: {}, places: {} };
  const date = chosenPhotoDate("2014-10-25", "2025-10", "camera")!;
  const details = await validatePhotoDraft({ ...emptyPhotoDraft, ...date }, catalog);
  assert.ok(details?.dateEvidence);
  assert.equal(await validatePhotoDraft({ ...emptyPhotoDraft, ...date, date: "2025-10" }, catalog), null);
  assert.equal(await validatePhotoDraft({ ...emptyPhotoDraft, ...date, dateSource: "family" }, catalog), null);
  const photo = { ...details!, key: "private.jpg", width: 8, height: 6 };
  assert.equal(publicPhoto(photo, "test")?.dateEvidence, undefined);
  assert.deepEqual(publicPhoto(photo, "test", true)?.dateEvidence, date.dateEvidence);
});
