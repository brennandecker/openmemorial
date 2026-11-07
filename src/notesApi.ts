import { dateBounds, filterBounds } from "./memoryMetadata.ts";
import { midnightInstant, nextDay } from "./wallSettings.ts";
import { verifySubmission } from "./botVerification.ts";
import { memoryPolicyVersion, maxPhotoBytes, publicPhoto, readStoredPhoto, validatePhotoDraft, type StoredPhoto } from "./memoryPhoto.ts";
import { cleanPhotograph, memoryCatalog, photographResponse } from "./photoStorage.ts";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const json = (body: unknown, status = 200, extra = {}) => Response.json(body, { status, headers: { ...headers, ...extra } });
const invalid = (error: string, status = 400) => json({ error }, status);
type NoteEnv = Pick<CloudflareEnv, "NOTES" | "NOTE_LIMITER" | "TURNSTILE_SECRET" | "TURNSTILE_HOSTNAMES" | "TURNSTILE_SITEKEY" | "MEMORY_PHOTOS" | "IMAGES">;

export function validateNote(value: unknown, hasPhoto = false): { name: string; body: string } | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (typeof input.name !== "string" || typeof input.body !== "string" || (input.website !== undefined && input.website !== "")) return null;
  const name = input.name.trim(), body = input.body.replace(/\r\n?/g, "\n").trim();
  if (!name || name.length > 80 || (!body && !hasPhoto) || body.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(name + body) || /[\r\n]/.test(name)) return null;
  return { name, body };
}
export async function boundedBytes(request: Request, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = request.body?.getReader(); if (!reader) throw new Error("empty");
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); throw new Error("large"); } chunks.push(value); } } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; } return bytes;
}
function selections(url: URL, key: string): string[] | null {
  const values = [...new Set(url.searchParams.getAll(key))];
  return values.length <= 20 && values.every(v => /^[a-z0-9-]{1,80}$/.test(v)) ? values : null;
}
export async function notesResponse(request: Request, env: NoteEnv): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/config" && request.method === "GET") return json({ turnstileSitekey: env.TURNSTILE_SITEKEY || "" });
  const photoMatch = /^\/api\/photos\/([a-f0-9-]{36})$/.exec(url.pathname);
  try {
    if (photoMatch) return await photographResponse(request, env, photoMatch[1]);
    if (url.pathname === "/api/catalog" && request.method === "GET") return json(await memoryCatalog(env));
    if (url.pathname !== "/api/notes") return invalid("Not found.", 404);
    if (request.method === "GET") {
      const page = Number(url.searchParams.get("page") || "0"), kind = url.searchParams.get("kind") || "all";
      const persons = selections(url, "person"), locations = selections(url, "place");
      if (!Number.isSafeInteger(page) || page < 0 || page > 10000 || !["all", "note", "photo", "video"].includes(kind) || !persons || !locations) return invalid("Invalid selection.");
      const year = url.searchParams.get("year") || "";
      const bounds = filterBounds({ year: year === "unknown" ? "" : year, from: url.searchParams.get("from") || "", to: url.searchParams.get("to") || "" });
      if (!bounds || bounds.from.startsWith("0000") || bounds.to.startsWith("9999")) return invalid("Invalid date range.");
      const conditions = ["hidden=0", "status='approved'"]; const params: (string | number)[] = [];
      const bind = (value: string | number) => { params.push(value); return `?${params.length}`; };
      if (kind === "photo") conditions.push("photo_json IS NOT NULL");
      if (kind === "note") conditions.push("photo_json IS NULL");
      if (kind === "video") conditions.push("0");
      if (year === "unknown") conditions.push("photo_json IS NOT NULL AND photo_from IS NULL");
      else {
        if (bounds.from) conditions.push(`((photo_json IS NULL AND created_at>=${bind(midnightInstant(bounds.from))}) OR (photo_json IS NOT NULL AND photo_to>=${bind(bounds.from)}))`);
        if (bounds.to) conditions.push(`((photo_json IS NULL AND created_at<${bind(midnightInstant(nextDay(bounds.to)))}) OR (photo_json IS NOT NULL AND photo_from<=${bind(bounds.to)}))`);
      }
      if (persons.length) conditions.push(`EXISTS(SELECT 1 FROM json_each(photo_json,'$.people') p WHERE json_extract(p.value,'$.id') IN (${persons.map(bind).join(",")}))`);
      if (locations.length) conditions.push(`(${locations.map(id => id === "unknown" ? "(photo_json IS NOT NULL AND json_extract(photo_json,'$.place.id') IS NULL)" : `(json_extract(photo_json,'$.place.id')=${bind(id)} OR json_extract(photo_json,'$.place.parentId')=${bind(id)})`).join(" OR ")})`);
      const rows = await env.NOTES.prepare(`SELECT id,name,COALESCE(memory_text,body) AS body,created_at AS createdAt,photo_json FROM wall_notes WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC,id DESC LIMIT 31 OFFSET ${bind(page * 30)}`).bind(...params).all<{ id: string; name: string; body: string; createdAt: string; photo_json: string | null }>();
      return json({ notes: rows.results.slice(0, 30).map(({ photo_json, ...note }) => ({ ...note, pinned: false, ...(photo_json ? { photo: publicPhoto(readStoredPhoto(photo_json), note.id) } : {}) })), hasMore: rows.results.length > 30 });
    }
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "GET, POST" });
    if (request.headers.get("Origin") !== url.origin || request.headers.get("Sec-Fetch-Site") === "cross-site") return invalid("Please post from this website.", 403);
    const type = request.headers.get("Content-Type") || "", multipart = type.startsWith("multipart/form-data;");
    if (!multipart && type.split(";")[0].trim() !== "application/json") return invalid("Please use the memory form.", 415);
    const limit = multipart ? maxPhotoBytes + 32768 : 8192;
    if (Number(request.headers.get("Content-Length")) > limit) return invalid("Choose one photograph up to 10 MB.", 413);
    const { success } = await env.NOTE_LIMITER.limit({ key: `wall:${request.headers.get("CF-Connecting-IP") || "local"}` });
    if (!success) return json({ error: "Please wait a minute before sharing another memory." }, 429, { "Retry-After": "60" });
    let input: Record<string, unknown>; let file: File | undefined;
    try {
      const bytes = await boundedBytes(request, limit);
      if (multipart) {
        const form = await new Response(bytes, { headers: { "Content-Type": type } }).formData();
        const files = [...form.values()].filter(v => typeof v !== "string");
        if (files.length > 1 || files.length && form.get("photo") !== files[0]) return invalid("Please attach only one photograph.");
        const memory = form.get("memory");
        if (typeof memory !== "string" || memory.length > 8192) return invalid("Please check your memory.");
        file = files[0]; input = JSON.parse(memory);
      } else input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch (error) { return invalid(error instanceof Error && error.message === "large" ? "Your submission is too large." : "Please check your memory.", error instanceof Error && error.message === "large" ? 413 : 400); }
    const validated = validateNote(input, Boolean(file));
    if (!validated) return invalid("Please add your name (up to 80 characters), and a memory or one photograph.");
    if (input.consent !== true || input.policyVersion !== memoryPolicyVersion) return invalid("Please confirm that you have permission to share this memory.");
    const email = typeof input.email === "string" ? input.email.trim() : "";
    if (email.length > 254 || email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return invalid("Please check your email address, or leave it blank.");
    if (!await verifySubmission(input.token, request, env)) return invalid("Please complete the verification and try again.", 403);
    const id = crypto.randomUUID(), now = new Date().toISOString(); let photo: StoredPhoto | undefined;
    if (file) {
      const details = await validatePhotoDraft(input.photo, await memoryCatalog(env));
      if (!details) return invalid("Please check the photo details. Dates can be a year, YYYY-MM, or YYYY-MM-DD.");
      let cleaned;
      try { cleaned = await cleanPhotograph(file, env); } catch { return invalid("This photo couldn’t be prepared. Choose a JPEG, PNG, WebP, or HEIC photo up to 10 MB and 40 megapixels."); }
      const key = `memories/${id}.jpg`;
      await env.MEMORY_PHOTOS.put(key, cleaned.bytes, { httpMetadata: { contentType: "image/jpeg" } });
      photo = { ...details, key, width: cleaned.width, height: cleaned.height };
    }
    const dates = dateBounds(photo?.takenOn);
    try {
      // Preserve the legacy body constraint; memory_text is the contributor's actual text.
      await env.NOTES.prepare("INSERT INTO wall_notes(id,name,body,memory_text,created_at,status,contact_email,consented_at,policy_version,photo_json,photo_from,photo_to) VALUES(?1,?2,?3,?4,?5,'pending',?6,?5,?7,?8,?9,?10)").bind(id, validated.name, validated.body || "Photograph", validated.body, now, email || null, memoryPolicyVersion, photo ? JSON.stringify(photo) : null, dates?.from || null, dates?.to || null).run();
    } catch (error) { if (photo) await env.MEMORY_PHOTOS.delete(photo.key); throw error; }
    return json({ submitted: true }, 202);
  } catch {
    console.error(JSON.stringify({ event: "wall_notes_unavailable" }));
    return invalid("The wall is unavailable for a moment. Please try again.", 503);
  }
}
