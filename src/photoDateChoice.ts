import { dateBounds } from "./memoryMetadata.ts";
function valid(value: string) { return !!dateBounds({ value, precision: value.length === 4 ? "year" : value.length === 7 ? "month" : "day", source: "family" }); }
export type DateChoice = "camera" | "entered" | "unknown";
export type DateEvidence = { cameraDate?: string; enteredDate?: string; selected: DateChoice };
export function cameraDateFromMetadata(info: { DateTimeOriginal?: unknown; CreateDate?: unknown } | null | undefined): string {
  // Camera dates are calendar dates, not instants to shift into the visitor's time zone.
  for (const raw of [info?.DateTimeOriginal, info?.CreateDate]) {
    const value = typeof raw === "string" ? raw.slice(0, 10).replace(/:/g, "-") : "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value) && valid(value)) return value;
  }
  return "";
}
export function chosenPhotoDate(cameraDate: string, enteredDate: string, selected: DateChoice | "") {
  if (!selected || cameraDate && !valid(cameraDate)) return null;
  const entered = enteredDate && valid(enteredDate) ? enteredDate : "";
  const date = selected === "camera" ? cameraDate : selected === "entered" ? entered : "";
  if (selected !== "unknown" && !date) return null;
  return { date, dateSource: selected === "camera" ? "camera" as const : "family" as const, dateEvidence: { ...(cameraDate ? { cameraDate } : {}), ...(entered ? { enteredDate: entered } : {}), selected } satisfies DateEvidence };
}
