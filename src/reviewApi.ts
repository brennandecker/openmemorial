import { reviewerIdentity } from "./reviewAuth.ts";
import { boundedBytes } from "./notesApi.ts";
import { dateBounds } from "./memoryMetadata.ts";
import { publicPhoto, readStoredPhoto, validatePhotoDraft, type MemoryPhoto } from "./memoryPhoto.ts";
import { memoryCatalog, photographResponse } from "./photoStorage.ts";

export type ReviewStatus = "pending" | "approved" | "declined" | "hidden";
export type ReviewNote = { id: string; name: string; body: string; createdAt: string; status: ReviewStatus; version: number; reviewedBy: string | null; reviewedAt: string | null; email?: string | null; photo?: MemoryPhoto };
export type ReviewEvent = { id: string; reviewer: string; action: "approve" | "decline" | "hide"; previousStatus: ReviewStatus; status: ReviewStatus; createdAt: string; detailsChanged?: number };
type ReviewRow = ReviewNote & { photo_json: string | null; contact_email: string | null };
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
const columns = "id, name, COALESCE(memory_text,body) AS body, created_at AS createdAt, status, review_version AS version, reviewed_by AS reviewedBy, reviewed_at AS reviewedAt, photo_json, contact_email";
const statuses = ["pending", "approved", "declined", "hidden"];
const privateNote = (row: Record<string, unknown>) => {
  const { photo_json, contact_email, ...note } = row;
  return { ...note, email: contact_email, ...(typeof photo_json === "string" ? { photo: publicPhoto(readStoredPhoto(photo_json), String(note.id), true) } : {}) };
};

export async function reviewResponse(request: Request, env: CloudflareEnv): Promise<Response> {
  const reviewer = await reviewerIdentity(request, env);
  if (!reviewer) return json({ error: "Please sign in with an authorized family email." }, 401);
  const url = new URL(request.url);
  try {
    const photograph = /^\/family\/api\/notes\/([a-f0-9-]{36})\/photo$/.exec(url.pathname);
    if (photograph) return await photographResponse(request, env, photograph[1], true);
    if (url.pathname === "/family/api/notes" && request.method === "GET") {
      const status = url.searchParams.get("status") || "pending";
      const page = Number(url.searchParams.get("page") || 0);
      if (!statuses.includes(status) || !Number.isSafeInteger(page) || page < 0 || page > 10000) return json({ error: "Invalid selection." }, 400);
      const [rows, counts] = await env.NOTES.batch<Record<string, unknown>>([
        env.NOTES.prepare(`SELECT ${columns} FROM wall_notes WHERE status = ?1 ORDER BY created_at DESC, id DESC LIMIT 31 OFFSET ?2`).bind(status, page * 30),
        env.NOTES.prepare("SELECT status, COUNT(*) AS count FROM wall_notes GROUP BY status"),
      ]);
      return json({ reviewer, notes: rows.results.slice(0, 30).map(privateNote), hasMore: rows.results.length > 30, counts: Object.fromEntries(counts.results.map(row => [String(row.status), Number(row.count)])) });
    }
    const history = /^\/family\/api\/notes\/([a-f0-9-]{36})\/history$/.exec(url.pathname);
    if (history) {
      if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
      const page = Number(url.searchParams.get("page") || 0);
      if (!Number.isSafeInteger(page) || page < 0 || page > 10000) return json({ error: "Invalid selection." }, 400);
      const exists = await env.NOTES.prepare("SELECT id FROM wall_notes WHERE id = ?").bind(history[1]).first();
      if (!exists) return json({ error: "Memory not found." }, 404);
      const rows = await env.NOTES.prepare("SELECT id, reviewer, action, previous_status AS previousStatus, status, created_at AS createdAt, (COALESCE(photo_before,'')!=COALESCE(photo_after,'')) AS detailsChanged FROM wall_note_reviews WHERE note_id = ?1 ORDER BY created_at DESC, rowid DESC LIMIT 31 OFFSET ?2").bind(history[1], page * 30).all<ReviewEvent>();
      return json({ history: rows.results.slice(0, 30), hasMore: rows.results.length > 30 });
    }
    const match = /^\/family\/api\/notes\/([a-f0-9-]{36})\/review$/.exec(url.pathname);
    if (!match) return json({ error: "Not found." }, 404);
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    if (request.headers.get("Origin") !== url.origin || request.headers.get("Sec-Fetch-Site") === "cross-site") return json({ error: "Please review from this website." }, 403);
    if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json") return json({ error: "Invalid request." }, 415);
    let input: { action?: string; version?: number; photo?: unknown };
    try { input = JSON.parse(new TextDecoder().decode(await boundedBytes(request, 8192))); } catch (error) { return json({ error: "Invalid request." }, error instanceof Error && error.message === "large" ? 413 : 400); }
    if (!input || !["approve", "decline", "hide"].includes(input.action || "") || !Number.isSafeInteger(input.version) || input.version! < 0) return json({ error: "Invalid review." }, 400);
    const previous = await env.NOTES.prepare(`SELECT ${columns} FROM wall_notes WHERE id = ?`).bind(match[1]).first<ReviewRow>();
    if (!previous) return json({ error: "Memory not found." }, 404);
    const action = input.action!;
    const next = action === "approve" ? "approved" : action === "hide" ? "hidden" : "declined";
    if (previous.version !== input.version || previous.status === next || (action === "hide" && previous.status !== "approved") || (action === "decline" && previous.status !== "pending")) return json({ error: "This memory has already changed. Refresh to see the latest review." }, 409);
    let photo = readStoredPhoto(previous.photo_json);
    if (input.photo !== undefined) {
      if (action !== "approve" || !photo) return json({ error: "This memory has no photograph to edit." }, 400);
      // Existing, unapproved labels must remain available when reviewing a restored memory.
      const catalog = await memoryCatalog(env);
      for (const person of photo.people) if (!catalog.people[person.id]) catalog.people[person.id] = { id: person.id, name: person.label };
      if (photo.place && !catalog.places[photo.place.id]) catalog.places[photo.place.id] = photo.place;
      const details = await validatePhotoDraft(input.photo, catalog);
      if (!details) return json({ error: "Please check the photograph’s details." }, 400);
      photo = { ...photo, ...details };
      // Optional fields removed by the reviewer must not survive the previous object spread.
      if (!details.takenOn) delete photo.takenOn;
      if (!details.place) delete photo.place;
    }
    const photoJSON = photo ? JSON.stringify(photo) : null, dates = dateBounds(photo?.takenOn);
    const reviewId = crypto.randomUUID(); const now = new Date().toISOString();
    const [updated] = await env.NOTES.batch<Record<string, unknown>>([
      env.NOTES.prepare(`UPDATE wall_notes SET status = ?1, hidden = ?2, review_version = review_version + 1, reviewed_by = ?3, reviewed_at = ?4, last_review_id = ?5,photo_json=?9,photo_from=?10,photo_to=?11 WHERE id = ?6 AND review_version = ?7 AND status = ?8 RETURNING ${columns}`).bind(next, next === "approved" ? 0 : 1, reviewer, now, reviewId, previous.id, input.version!, previous.status, photoJSON, dates?.from || null, dates?.to || null),
      // The unique review ID ties the audit entry to the successful update in this transaction.
      env.NOTES.prepare("INSERT INTO wall_note_reviews (id,note_id,reviewer,action,previous_status,status,created_at,photo_before,photo_after) SELECT ?1,id,?2,?3,?4,?5,?6,?8,?9 FROM wall_notes WHERE id = ?7 AND last_review_id = ?1").bind(reviewId, reviewer, action, previous.status, next, now, previous.id, previous.photo_json, photoJSON),
    ]);
    return updated.results.length ? json({ note: privateNote(updated.results[0]) }) : json({ error: "Another reviewer has already changed this memory. Refresh to continue." }, 409);
  } catch { console.error(JSON.stringify({ event: "family_review_unavailable" })); return json({ error: "The review page is unavailable for a moment. Please try again." }, 503); }
}
