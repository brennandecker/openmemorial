import type { WallNote } from "./wallNotes.ts";
import { filterBounds } from "./memoryMetadata.ts";
import { midnightInstant, nextDay } from "./wallSettings.ts";
import { verifySubmission } from "./botVerification.ts";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const json = (body: unknown, status = 200, extra = {}) => Response.json(body, { status, headers: { ...headers, ...extra } });
const invalid = (error: string, status = 400) => json({ error }, status);

export function validateNote(value: unknown): { name: string; body: string } | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (typeof input.name !== "string" || typeof input.body !== "string" || (input.website !== undefined && input.website !== "")) return null;
  const name = input.name.trim();
  const body = input.body.replace(/\r\n?/g, "\n").trim();
  if (!name || name.length > 80 || !body || body.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(name + body) || /[\r\n]/.test(name)) return null;
  return { name, body };
}

async function boundedJSON(request: Request) {
  // Limit actual streamed bytes, including chunked requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new Error("large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export async function notesResponse(request: Request, env: Pick<CloudflareEnv, "NOTES" | "NOTE_LIMITER" | "TURNSTILE_SECRET" | "TURNSTILE_HOSTNAMES" | "TURNSTILE_SITEKEY">): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/config" && request.method === "GET") return json({ turnstileSitekey: env.TURNSTILE_SITEKEY || "" });
  if (url.pathname !== "/api/notes") return invalid("Not found.", 404);
  try {
    if (request.method === "GET") {
      const page = Number(url.searchParams.get("page") || "0");
      if (!Number.isSafeInteger(page) || page < 0 || page > 10000) return invalid("Invalid page.");
      const bounds = filterBounds({ year: url.searchParams.get("year") || "", from: url.searchParams.get("from") || "", to: url.searchParams.get("to") || "" });
      if (!bounds || bounds.from.startsWith("0000") || bounds.to.startsWith("9999")) return invalid("Invalid date range.");
      const conditions = ["hidden = 0", "status = 'approved'"];
      const params: (string | number)[] = [];
      if (bounds.from) { params.push(midnightInstant(bounds.from)); conditions.push(`created_at >= ?${params.length}`); }
      if (bounds.to) { params.push(midnightInstant(nextDay(bounds.to))); conditions.push(`created_at < ?${params.length}`); }
      params.push(page * 30);
      const rows = await env.NOTES.prepare(`SELECT id, name, body, created_at AS createdAt FROM wall_notes WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT 31 OFFSET ?${params.length}`).bind(...params).all<Omit<WallNote, "pinned">>();
      return json({ notes: rows.results.slice(0, 30).map(note => ({ ...note, pinned: false })), hasMore: rows.results.length > 30 });
    }
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "GET, POST" });
    if (request.headers.get("Origin") !== url.origin || request.headers.get("Sec-Fetch-Site") === "cross-site") return invalid("Please post from this website.", 403);
    if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json") return invalid("Send a JSON note.", 415);
    if (Number(request.headers.get("Content-Length")) > 8192) return invalid("Your note is too long.", 413);
    let input: unknown;
    try { input = await boundedJSON(request); } catch (error) { return invalid(error instanceof Error && error.message === "large" ? "Your note is too long." : "Please check your note.", error instanceof Error && error.message === "large" ? 413 : 400); }
    const validated = validateNote(input);
    if (!validated) return invalid("Please add your name (up to 80 characters) and a note (up to 1,000 characters).");
    // A generous shared-network allowance avoids blocking families on the same Wi-Fi.
    const { success } = await env.NOTE_LIMITER.limit({ key: `wall:${request.headers.get("CF-Connecting-IP") || "local"}` });
    if (!success) return json({ error: "Please wait a minute before posting another note." }, 429, { "Retry-After": "60" });
    if (!await verifySubmission((input as Record<string, unknown>).token, request, env)) return invalid("Please complete the verification and try again.", 403);
    const note: WallNote = { ...validated, id: crypto.randomUUID(), createdAt: new Date().toISOString(), pinned: false };
    await env.NOTES.prepare("INSERT INTO wall_notes (id, name, body, created_at, status) VALUES (?1, ?2, ?3, ?4, 'pending')").bind(note.id, note.name, note.body, note.createdAt).run();
    return json({ submitted: true }, 202);
  } catch {
    // Never log visitor messages, names, or network identifiers.
    console.error(JSON.stringify({ event: "wall_notes_unavailable" }));
    return invalid("The wall is unavailable for a moment. Please try again.", 503);
  }
}
