import { reviewerIdentity } from "./reviewAuth.ts";

export type ReviewStatus = "pending" | "approved" | "declined" | "hidden";
export type ReviewNote = { id: string; name: string; body: string; createdAt: string; status: ReviewStatus; version: number; reviewedBy: string | null; reviewedAt: string | null };
export type ReviewEvent = { id: string; reviewer: string; action: "approve" | "decline" | "hide"; previousStatus: ReviewStatus; status: ReviewStatus; createdAt: string };
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
const columns = "id, name, body, created_at AS createdAt, status, review_version AS version, reviewed_by AS reviewedBy, reviewed_at AS reviewedAt";
const statuses = ["pending", "approved", "declined", "hidden"];

export async function reviewResponse(request: Request, env: CloudflareEnv): Promise<Response> {
  const reviewer = await reviewerIdentity(request, env);
  if (!reviewer) return json({ error: "Please sign in with an authorized family email." }, 401);
  const url = new URL(request.url);
  try {
    if (url.pathname === "/family/api/notes" && request.method === "GET") {
      const status = url.searchParams.get("status") || "pending";
      const page = Number(url.searchParams.get("page") || 0);
      if (!statuses.includes(status) || !Number.isSafeInteger(page) || page < 0 || page > 10000) return json({ error: "Invalid selection." }, 400);
      const [rows, counts] = await env.NOTES.batch<Record<string, unknown>>([
        env.NOTES.prepare(`SELECT ${columns} FROM wall_notes WHERE status = ?1 ORDER BY created_at DESC, id DESC LIMIT 31 OFFSET ?2`).bind(status, page * 30),
        env.NOTES.prepare("SELECT status, COUNT(*) AS count FROM wall_notes GROUP BY status"),
      ]);
      return json({ reviewer, notes: rows.results.slice(0, 30), hasMore: rows.results.length > 30, counts: Object.fromEntries(counts.results.map(row => [String(row.status), Number(row.count)])) });
    }
    const history = /^\/family\/api\/notes\/([a-f0-9-]{36})\/history$/.exec(url.pathname);
    if (history) {
      if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
      const page = Number(url.searchParams.get("page") || 0);
      if (!Number.isSafeInteger(page) || page < 0 || page > 10000) return json({ error: "Invalid selection." }, 400);
      const exists = await env.NOTES.prepare("SELECT id FROM wall_notes WHERE id = ?").bind(history[1]).first();
      if (!exists) return json({ error: "Memory not found." }, 404);
      const rows = await env.NOTES.prepare("SELECT id, reviewer, action, previous_status AS previousStatus, status, created_at AS createdAt FROM wall_note_reviews WHERE note_id = ?1 ORDER BY created_at DESC, rowid DESC LIMIT 31 OFFSET ?2").bind(history[1], page * 30).all<ReviewEvent>();
      return json({ history: rows.results.slice(0, 30), hasMore: rows.results.length > 30 });
    }
    const match = /^\/family\/api\/notes\/([a-f0-9-]{36})\/review$/.exec(url.pathname);
    if (!match) return json({ error: "Not found." }, 404);
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    if (request.headers.get("Origin") !== url.origin || request.headers.get("Sec-Fetch-Site") === "cross-site") return json({ error: "Please review from this website." }, 403);
    if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json") return json({ error: "Invalid request." }, 415);
    // Review commands have only two small fields. Bound chunked bodies too.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Invalid request." }, 400);
    let text = ""; let size = 0; const decoder = new TextDecoder();
    try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 1024) { await reader.cancel(); return json({ error: "Request too large." }, 413); } text += decoder.decode(value, { stream: true }); } text += decoder.decode(); } finally { reader.releaseLock(); }
    let input: { action?: string; version?: number };
    try { input = JSON.parse(text); } catch { return json({ error: "Invalid request." }, 400); }
    if (!input || !["approve", "decline", "hide"].includes(input.action || "") || !Number.isSafeInteger(input.version) || input.version! < 0) return json({ error: "Invalid review." }, 400);
    const previous = await env.NOTES.prepare(`SELECT ${columns} FROM wall_notes WHERE id = ?`).bind(match[1]).first<ReviewNote>();
    if (!previous) return json({ error: "Memory not found." }, 404);
    const action = input.action!;
    const next = action === "approve" ? "approved" : action === "hide" ? "hidden" : "declined";
    if (previous.version !== input.version || previous.status === next || (action === "hide" && previous.status !== "approved") || (action === "decline" && previous.status !== "pending")) return json({ error: "This memory has already changed. Refresh to see the latest review." }, 409);
    const reviewId = crypto.randomUUID(); const now = new Date().toISOString();
    const [updated] = await env.NOTES.batch([
      env.NOTES.prepare(`UPDATE wall_notes SET status = ?1, hidden = ?2, review_version = review_version + 1, reviewed_by = ?3, reviewed_at = ?4, last_review_id = ?5 WHERE id = ?6 AND review_version = ?7 AND status = ?8 RETURNING ${columns}`).bind(next, next === "approved" ? 0 : 1, reviewer, now, reviewId, previous.id, input.version!, previous.status),
      // The unique review ID ties the audit entry to the successful update in this transaction.
      env.NOTES.prepare("INSERT INTO wall_note_reviews (id,note_id,reviewer,action,previous_status,status,created_at) SELECT ?1,id,?2,?3,?4,?5,?6 FROM wall_notes WHERE id = ?7 AND last_review_id = ?1").bind(reviewId, reviewer, action, previous.status, next, now, previous.id),
    ]);
    return updated.results.length ? json({ note: updated.results[0] }) : json({ error: "Another reviewer has already changed this memory. Refresh to continue." }, 409);
  } catch { console.error(JSON.stringify({ event: "family_review_unavailable" })); return json({ error: "The review page is unavailable for a moment. Please try again." }, 503); }
}
