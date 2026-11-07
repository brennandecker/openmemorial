import { curatedWall } from "./curatedWall.ts";
import { people, places } from "./photoWallData.ts";
import { maxPhotoBytes, readStoredPhoto, type MemoryCatalog, type StoredPhoto } from "./memoryPhoto.ts";

export async function memoryCatalog(env: Pick<CloudflareEnv, "NOTES">): Promise<MemoryCatalog> {
  const catalog: MemoryCatalog = { people: { ...people }, places: { ...places } };
  const [persons, locations] = await env.NOTES.batch<Record<string, unknown>>([
    env.NOTES.prepare("SELECT DISTINCT json_extract(p.value,'$.id') AS id, json_extract(p.value,'$.label') AS label FROM wall_notes n, json_each(n.photo_json,'$.people') p WHERE n.status='approved' AND n.hidden=0 LIMIT 500"),
    env.NOTES.prepare("SELECT DISTINCT json_extract(photo_json,'$.place.id') AS id,json_extract(photo_json,'$.place.label') AS label,json_extract(photo_json,'$.place.parentId') AS parentId,json_extract(photo_json,'$.place.city') AS city,json_extract(photo_json,'$.place.state') AS state,json_extract(photo_json,'$.place.country') AS country FROM wall_notes WHERE status='approved' AND hidden=0 AND photo_json IS NOT NULL LIMIT 500"),
  ]);
  for (const p of persons.results) if (typeof p.id === "string" && typeof p.label === "string" && !catalog.people[p.id]) catalog.people[p.id] = { id: p.id, name: p.label };
  for (const p of locations.results) if (typeof p.id === "string" && typeof p.label === "string") catalog.places[p.id] = { ...(catalog.places[p.id] || {}), id: p.id, label: p.label, ...(typeof p.parentId === "string" ? { parentId: p.parentId } : {}), ...(typeof p.city === "string" ? { city: p.city } : {}), ...(typeof p.state === "string" ? { state: p.state } : {}), ...(typeof p.country === "string" ? { country: p.country } : {}) };
  for (const item of await curatedWall(env)) if (!item.hidden && item.photo) {
    for (const person of item.photo.people) if (!catalog.people[person.id]) catalog.people[person.id] = { id: person.id, name: person.label };
    if (item.photo.place) catalog.places[item.photo.place.id] = item.photo.place;
  }
  return catalog;
}

export function stripJpegMetadata(source: ArrayBuffer): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(source);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Invalid processed photograph.");
  const parts = [bytes.subarray(0, 2)]; let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error("Invalid processed photograph.");
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) { parts.push(bytes.subarray(offset)); break; }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + length + 2 > bytes.length) throw new Error("Invalid processed photograph.");
    // Remove EXIF/XMP (including GPS), IPTC, and comments. Preserve color profiles.
    if (![0xe1, 0xed, 0xfe].includes(marker)) parts.push(bytes.subarray(offset, offset + length + 2));
    offset += length + 2;
  }
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let position = 0;
  for (const part of parts) { result.set(part, position); position += part.length; }
  return result;
}
export async function cleanPhotograph(file: File, env: Pick<CloudflareEnv, "IMAGES">): Promise<{ bytes: Uint8Array<ArrayBuffer>; width: number; height: number }> {
  if (!file.size || file.size > maxPhotoBytes) throw new Error("Choose one photograph up to 10 MB.");
  // Decode the actual bytes; filenames and browser Content-Type are not trusted.
  const info = await env.IMAGES.info(file.stream());
  if (!("width" in info) || !["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(info.format) || info.width * info.height > 40_000_000 || Math.max(info.width, info.height) > 16000) throw new Error("Choose a JPEG, PNG, WebP, or HEIC photograph up to 40 megapixels.");
  const result = await env.IMAGES.input(file.stream()).transform({ width: 2560, height: 2560, fit: "scale-down" }).output({ format: "image/jpeg", quality: 88, anim: false });
  const bytes = stripJpegMetadata(await result.response().arrayBuffer());
  if (bytes.byteLength > maxPhotoBytes) throw new Error("This photograph is too large to process. Please choose a smaller copy.");
  // Read the normalized output dimensions: orientation can change them.
  const output = await env.IMAGES.info(new Blob([bytes]).stream());
  if (!("width" in output)) throw new Error("The photograph couldn’t be prepared.");
  return { bytes, width: output.width, height: output.height };
}

export async function photographResponse(request: Request, env: Pick<CloudflareEnv, "NOTES" | "MEMORY_PHOTOS">, id: string, privateView = false): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };
  if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405, headers });
  const row = await env.NOTES.prepare(`SELECT photo_json FROM wall_notes WHERE id=?${privateView ? "" : " AND hidden=0 AND status='approved'"}`).bind(id).first<{ photo_json: string | null }>();
  const photo: StoredPhoto | undefined = readStoredPhoto(row?.photo_json);
  if (!photo) return new Response(null, { status: 404, headers });
  const object = request.method === "HEAD" ? await env.MEMORY_PHOTOS.head(photo.key) : await env.MEMORY_PHOTOS.get(photo.key);
  if (!object) return new Response(null, { status: 404, headers });
  return new Response(request.method === "HEAD" ? null : (object as R2ObjectBody).body, { headers: { ...headers, "Content-Type": "image/jpeg", "Content-Length": String(object.size), "Content-Disposition": `inline; filename="memory-${id}.jpg"` } });
}
