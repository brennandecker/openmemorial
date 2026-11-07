import { chosenPhotoDate, type DateEvidence } from "./photoDateChoice.ts";
import { dateBounds, type MemoryDate, type Person, type Place } from "./memoryMetadata.ts";

export const memoryPolicyVersion = "2026-11-07";
export const maxPhotoBytes = 10 * 1024 * 1024;
export type PersonEntry = { id?: string; name: string };
export type PhotoPerson = { id: string; label: string };
export type MemoryCatalog = { people: Record<string, Person>; places: Record<string, Place> };
export type PhotoDetails = { caption: string; takenOn?: MemoryDate; people: PhotoPerson[]; place?: Place; dateEvidence?: DateEvidence };
export type MemoryPhoto = PhotoDetails & { src: string; width: number; height: number };
export type StoredPhoto = PhotoDetails & { key: string; width: number; height: number };
export type PhotoDraft = { caption: string; date: string; dateSource: "camera" | "family"; peopleIds: string[]; otherPeople: string; placeId: string; location: string; personEntries?: PersonEntry[]; city?: string; state?: string; country?: string; dateEvidence?: DateEvidence };
export const emptyPhotoDraft: PhotoDraft = { caption: "", date: "", dateSource: "family", peopleIds: [], otherPeople: "", placeId: "", location: "", city: "", state: "", country: "" };
const control = /[\u0000-\u001f\u007f]/;
export function photoDraft(photo: PhotoDetails, catalog: MemoryCatalog): PhotoDraft {
  return { personEntries: photo.people.map(p => ({ ...(catalog.people[p.id] ? { id: p.id } : {}), name: p.label })), city: photo.place?.city || "", state: photo.place?.state || "", country: photo.place?.country || "", caption: photo.caption, date: photo.takenOn?.value || "", dateSource: photo.takenOn?.source || "family", peopleIds: photo.people.filter(p => catalog.people[p.id]).map(p => p.id), otherPeople: photo.people.filter(p => !catalog.people[p.id]).map(p => p.label).join(", "), placeId: photo.place && catalog.places[photo.place.id] ? photo.place.id : "", location: photo.place && !catalog.places[photo.place.id] ? photo.place.label : "" };
}
const personLabel = (person: Person) => [person.relationship, person.name].filter(Boolean).join(" ");
export function photoPersonEntries(draft: PhotoDraft, catalog: MemoryCatalog): PersonEntry[] {
  return draft.personEntries ?? [...draft.peopleIds.filter(id => Object.hasOwn(catalog.people, id)).map(id => ({ id, name: personLabel(catalog.people[id]) })), ...draft.otherPeople.split(",").map(name => ({ name: name.trim() })).filter(p => p.name)];
}
export function photoFrontNames(draft: PhotoDraft, catalog: MemoryCatalog): string[] {
  const seen = new Set<string>();
  return photoPersonEntries(draft, catalog).map(p => p.id && catalog.people[p.id] ? personLabel(catalog.people[p.id]) : p.name.trim()).filter(label => { const key = label.normalize("NFKC").toLocaleLowerCase("en-US"); if (!key || seen.has(key)) return false; seen.add(key); return true; });
}
export function photoLocationLabel(draft: PhotoDraft, catalog: MemoryCatalog): string {
  return [draft.city?.trim(), draft.state?.trim(), draft.country?.trim()].filter(Boolean).join(", ") || catalog.places[draft.placeId]?.label || draft.location.trim();
}
export function rememberedDate(value: string, source: MemoryDate["source"]): MemoryDate | undefined {
  if (!value) return undefined;
  const date: MemoryDate = { value, source, precision: value.length === 4 ? "year" : value.length === 7 ? "month" : "day" };
  return dateBounds(date) ? date : undefined;
}
async function labelId(prefix: string, label: string) {
  const bytes = new TextEncoder().encode(label.normalize("NFKC").trim().toLocaleLowerCase("en-US"));
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return `${prefix}-${Array.from(hash.slice(0, 12), n => n.toString(16).padStart(2, "0")).join("")}`;
}
export async function validatePhotoDraft(value: unknown, catalog: MemoryCatalog): Promise<PhotoDetails | null> {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (["caption", "date", "otherPeople", "placeId", "location"].some(k => typeof v[k] !== "string") || !Array.isArray(v.peopleIds) || v.peopleIds.length > 20 || v.peopleIds.some(id => typeof id !== "string" || !Object.hasOwn(catalog.people, id)) || !["camera", "family"].includes(String(v.dateSource))) return null;
  const draft = v as PhotoDraft;
  let dateEvidence: DateEvidence | undefined;
  if (v.dateEvidence !== undefined) {
    if (!v.dateEvidence || typeof v.dateEvidence !== "object") return null;
    const evidence = v.dateEvidence as Record<string, unknown>;
    if (!["camera", "entered", "unknown"].includes(String(evidence.selected)) || ["cameraDate", "enteredDate"].some(k => evidence[k] !== undefined && typeof evidence[k] !== "string")) return null;
    const confirmed = chosenPhotoDate(String(evidence.cameraDate || ""), String(evidence.enteredDate || ""), evidence.selected as DateEvidence["selected"]);
    if (!confirmed || confirmed.date !== draft.date || confirmed.dateSource !== draft.dateSource) return null;
    dateEvidence = confirmed.dateEvidence;
  }
  const caption = draft.caption.trim(), location = draft.location.trim();
  if (caption.length > 180 || location.length > 120 || draft.otherPeople.length > 600 || control.test(caption + location + draft.otherPeople) || (draft.placeId && !Object.hasOwn(catalog.places, draft.placeId))) return null;
  for (const field of ["city", "state", "country"] as const) if (draft[field] !== undefined && (typeof draft[field] !== "string" || draft[field]!.trim().length > 80 || control.test(draft[field]!))) return null;
  const takenOn = rememberedDate(draft.date, draft.dateSource);
  if (draft.date && !takenOn) return null;
  if (draft.personEntries !== undefined && (!Array.isArray(draft.personEntries) || draft.personEntries.length > 20 || draft.personEntries.some(p => !p || typeof p !== "object" || typeof p.name !== "string" || p.name.trim().length > 80 || control.test(p.name) || p.id !== undefined && (typeof p.id !== "string" || !Object.hasOwn(catalog.people, p.id))))) return null;
  const entries = photoPersonEntries(draft, catalog).filter(p => p.name.trim());
  if (entries.length > 20 || entries.some(p => p.name.trim().length > 80)) return null;
  const people: PhotoPerson[] = [];
  for (const entry of entries) {
    const label = entry.name.trim();
    const existing = entry.id ? catalog.people[entry.id] : Object.values(catalog.people).find(p => personLabel(p).toLocaleLowerCase("en-US") === label.toLocaleLowerCase("en-US"));
    const id = existing?.id || await labelId("person", label);
    if (!people.some(p => p.id === id)) people.push({ id, label: existing ? personLabel(existing) : label });
  }
  const city = draft.city?.trim() || "", state = draft.state?.trim() || "", country = draft.country?.trim() || "";
  const structured = [city, state, country].filter(Boolean).join(", ");
  let place: Place | undefined;
  if (structured) {
    const existing = Object.values(catalog.places).find(p => p.label.toLocaleLowerCase("en-US") === structured.toLocaleLowerCase("en-US"));
    place = { ...(existing || {}), id: existing?.id || await labelId("place", JSON.stringify([city, state, country])), label: structured, ...(city ? { city } : {}), ...(state ? { state } : {}), ...(country ? { country } : {}) };
  } else {
    const known = catalog.places[draft.placeId];
    place = known ? { ...known } : location ? { id: await labelId("place", location), label: location } : undefined;
  }
  return { caption, ...(dateEvidence ? { dateEvidence } : {}), ...(takenOn ? { takenOn } : {}), people, ...(place ? { place } : {}) };
}
export function readStoredPhoto(value: string | null | undefined): StoredPhoto | undefined {
  if (!value) return undefined;
  try { return JSON.parse(value) as StoredPhoto; } catch { return undefined; }
}
export function publicPhoto(photo: StoredPhoto | undefined, id: string, privateView = false): MemoryPhoto | undefined {
  if (!photo) return undefined;
  const { key: _key, dateEvidence, ...details } = photo;
  return { ...details, ...(privateView && dateEvidence ? { dateEvidence } : {}), src: privateView ? `/family/api/notes/${id}/photo` : `/api/photos/${id}` };
}
