/** A remembered date, with its actual precision and where it came from. */
export type MemoryDate = { value: string; precision: "year" | "month" | "day"; source: "family" | "camera"; approximate?: boolean };
export type Person = { id: string; name: string; relationship?: string; inMemoriam?: boolean };
export type Place = { id: string; label: string; parentId?: string; city?: string; state?: string; country?: string };
export type MediaMetadata = {
  id: string; kind: "photo" | "video"; caption: string;
  width: number; height: number; message: string;
  takenOn?: MemoryDate; placeId?: string; peopleIds: string[];
};
export type WallFilters = { kind: "all" | "photo" | "video" | "note"; year: string; from: string; to: string; places: string[]; people: string[] };
export const emptyFilters: WallFilters = { kind: "all", year: "", from: "", to: "", places: [], people: [] };

export function validDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value.slice(0, 4) >= "0001" && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
export function dateBounds(date?: MemoryDate): { from: string; to: string } | null {
  if (!date) return null;
  const { value, precision } = date;
  if (precision === "day") return validDay(value) ? { from: value, to: value } : null;
  if (precision === "year" && /^\d{4}$/.test(value) && value >= "0001") return { from: `${value}-01-01`, to: `${value}-12-31` };
  if (precision === "month" && /^\d{4}-\d{2}$/.test(value) && validDay(`${value}-01`)) {
    const next = new Date(`${value}-01T12:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1); next.setUTCDate(0);
    return { from: `${value}-01`, to: next.toISOString().slice(0, 10) };
  }
  return null;
}
export function formatMemoryDate(date?: MemoryDate): string {
  if (!dateBounds(date)) return "";
  const value = date!;
  const prefix = value.approximate ? "Around " : "";
  if (value.precision === "year") return prefix + value.value;
  return prefix + new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", ...(value.precision === "day" ? { day: "numeric" as const } : {}), timeZone: "UTC" }).format(new Date(`${value.value}${value.precision === "month" ? "-15" : ""}T12:00:00Z`));
}
function ageOn(day: string, birth: string) {
  return Number(day.slice(0, 4)) - Number(birth.slice(0, 4)) - (day.slice(5) < birth.slice(5) ? 1 : 0);
}
/** A partial date produces an age range, clipped to the person's lifetime. */
export function ageLabel(date: MemoryDate | undefined, birth: string, death = ""): string {
  const bounds = dateBounds(date);
  if (!bounds || !validDay(birth) || (death && !validDay(death))) return "";
  const from = bounds.from < birth ? birth : bounds.from;
  const to = death && bounds.to > death ? death : bounds.to;
  if (to < from) return "";
  const low = ageOn(from, birth), high = ageOn(to, birth);
  return low === high ? `Age ${low}` : `Ages ${low}–${high}`;
}
export function filterBounds(filters: Pick<WallFilters, "year" | "from" | "to">): { from: string; to: string } | null {
  if ((filters.year && !/^\d{4}$/.test(filters.year)) || (filters.from && !validDay(filters.from)) || (filters.to && !validDay(filters.to))) return null;
  const from = [filters.from, filters.year ? `${filters.year}-01-01` : ""].sort().at(-1) || "";
  const to = [filters.to, filters.year ? `${filters.year}-12-31` : ""].filter(Boolean).sort()[0] || "";
  return from && to && from > to ? null : { from, to };
}
export function dateMatches(date: MemoryDate | undefined, filters: Pick<WallFilters, "year" | "from" | "to">): boolean {
  if (filters.year === "unknown") return !dateBounds(date) && !filters.from && !filters.to;
  const range = filterBounds(filters);
  if (!range) return false;
  if (!range.from && !range.to) return true;
  const bounds = dateBounds(date);
  return Boolean(bounds && (!range.from || bounds.to >= range.from) && (!range.to || bounds.from <= range.to));
}
export function placeMatches(placeId: string | undefined, selected: string, places: Record<string, Place>): boolean {
  if (!selected) return true;
  if (selected === "unknown") return !placeId;
  const seen = new Set<string>();
  while (placeId && !seen.has(placeId)) { if (placeId === selected) return true; seen.add(placeId); placeId = places[placeId]?.parentId; }
  return false;
}
export function hasFilters(filters: WallFilters): boolean {
  return filters.kind !== "all" || Boolean(filters.year || filters.from || filters.to || filters.people.length || filters.places.length);
}
export function ageRangeLabel(from: string, to: string, birth: string, death = ""): string {
  if (!validDay(from) || !validDay(to) || !validDay(birth) || (death && !validDay(death))) return "";
  const start = from < birth ? birth : from;
  const end = death && to > death ? death : to;
  if (end < start) return "";
  const low = ageOn(start, birth), high = ageOn(end, birth);
  return low === high ? `Age ${low}` : `Ages ${low}–${high}`;
}
export function mediaMatches(media: MediaMetadata, filters: WallFilters, places: Record<string, Place>): boolean {
  return (filters.kind === "all" || filters.kind === media.kind) && dateMatches(media.takenOn, filters) && (!filters.places.length || filters.places.some(place => placeMatches(media.placeId, place, places))) && (!filters.people.length || filters.people.some(person => media.peopleIds.includes(person)));
}
