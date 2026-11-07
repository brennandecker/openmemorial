import { useEffect, useState } from "react";
import { initialMemorial } from "./memorial";
import { wallTimeZone } from "./wallSettings";
import type { ReviewNote, ReviewStatus } from "./reviewApi";
import ReviewHistory from "./ReviewHistory";
import SiteFooter from "./SiteFooter";
import PhotoDetailsForm from "./PhotoDetailsForm";
import { rememberedDate, photoDraft, type MemoryCatalog, type PhotoDraft } from "./memoryPhoto";
import { people, places } from "./photoWallData";
import { formatMemoryDate } from "./memoryMetadata";
import "./photo-wall.css";
import "./family-review.css";

const labels: Record<ReviewStatus, string> = { pending: "Waiting", approved: "Published", declined: "Declined", hidden: "Hidden" };
export default function FamilyReview() {
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reviewer, setReviewer] = useState("");
  const [page, setPage] = useState(0); const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState("");
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0); const [signIn, setSignIn] = useState(false);
  const [historyId, setHistoryId] = useState("");
  const [catalog, setCatalog] = useState<MemoryCatalog>({ people, places });
  const [photoEdits, setPhotoEdits] = useState<Record<string, { version: number; draft: PhotoDraft }>>({});
  useEffect(() => { const controller = new AbortController(); void fetch("/api/catalog", { signal: controller.signal }).then(response => { if (!response.ok) throw new Error(); return response.json() as Promise<MemoryCatalog>; }).then(result => { if (!controller.signal.aborted) setCatalog(result); }).catch(() => {}); return () => controller.abort(); }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    void (async () => {
      const response = await fetch(`/family/api/notes?status=${status}&page=${page}`, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (response.status === 401 || response.status === 403 || response.redirected) { setSignIn(true); throw new Error("Please sign in again to continue reviewing."); }
      if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json")) throw new Error("The review queue couldn’t load. Please try again.");
      const result = await response.json() as { notes: ReviewNote[]; counts: Record<string, number>; reviewer: string; hasMore: boolean };
      if (controller.signal.aborted) return;
      setReviewer(result.reviewer); setNotes(result.notes); setCounts(result.counts); setHasMore(result.hasMore);
    })().catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [status, page, revision]);
  async function review(note: ReviewNote, action: "approve" | "decline" | "hide") {
    if (busy) return; setBusy(note.id); setError(""); setNotice("");
    try {
      const edited = photoEdits[note.id];
      const response = await fetch(`/family/api/notes/${note.id}/review`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ action, version: note.version, ...(action === "approve" && note.photo ? { photo: edited?.version === note.version ? edited.draft : photoDraft(note.photo, catalog) } : {}) }) });
      if (response.status === 401 || response.status === 403 || response.redirected) { setSignIn(true); throw new Error("Please sign in again to continue reviewing."); }
      const result = await response.json() as { error?: string };
      if (!response.ok) { if (response.status === 409) setRevision(value => value + 1); throw new Error(result.error || "The review couldn’t be saved."); }
      setNotice(action === "approve" ? "Memory published on the wall." : action === "hide" ? "Memory hidden from the wall." : "Memory declined. It will stay private.");
      setRevision(value => value + 1);
    } catch (error) { setError(error instanceof Error ? error.message : "The review couldn’t be saved."); }
    finally { setBusy(""); }
  }
  const date = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: wallTimeZone }).format(new Date(value));
  return <main className="family-review">
    <header><a className="review-wall-link" href="/">← Back to the wall</a><h1>{initialMemorial.name}</h1><p>Family review</p><div className="review-session">{reviewer && <span>Signed in as {reviewer}</span>}<a href="/cdn-cgi/access/logout">Sign out</a></div></header>
    <nav className="review-tabs" aria-label="Review status">{(Object.keys(labels) as ReviewStatus[]).map(value => <button key={value} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(0); setNotes([]); setNotice(""); setHistoryId(""); }}>{labels[value]} <span>{counts[value] || 0}</span></button>)}</nav>
    {status === "declined" && <p className="review-retention">Declined memories stay private and are kept for at least 60 days so accidental decisions can be reversed. Choose Publish to restore one. Nothing is deleted automatically.</p>}
    {notice && <p className="review-notice" role="status">{notice}</p>}
    {error && <div className="review-error" role="alert"><p>{error}</p>{signIn ? <a href="/family">Sign in again</a> : <button onClick={() => setRevision(value => value + 1)}>Try again</button>}</div>}
    {loading ? <p role="status">Loading memories…</p> : !error && notes.length === 0 ? <p className="review-empty">{status === "pending" ? "No memories are waiting for approval." : `No ${labels[status].toLowerCase()} memories.`}</p> : <section className="review-list" aria-label={`${labels[status]} memories`}>{notes.map(note => <article key={note.id}>
      {note.photo && <div className="review-photograph"><img src={note.photo.src} alt={note.photo.caption || "Submitted photograph"} width={note.photo.width} height={note.photo.height} loading="lazy" /><p>{[note.photo.caption, formatMemoryDate(note.photo.takenOn), note.photo.place?.label].filter(Boolean).join(" · ")}</p>{note.photo.dateEvidence && <p className="photo-field-hint">Photo file date: {formatMemoryDate(rememberedDate(note.photo.dateEvidence.cameraDate || "", "camera")) || "Not found"}. Entered date: {formatMemoryDate(rememberedDate(note.photo.dateEvidence.enteredDate || "", "family")) || "Not provided"}. Contributor chose: {note.photo.dateEvidence.selected === "camera" ? "photo file date" : note.photo.dateEvidence.selected === "entered" ? "entered date" : "unknown"}.</p>}{note.status !== "approved" && <details className="photo-details-disclosure"><summary>Review photo details</summary><PhotoDetailsForm catalog={catalog} disabled={!!busy} value={photoEdits[note.id]?.version === note.version ? photoEdits[note.id].draft : photoDraft(note.photo, catalog)} change={draft => setPhotoEdits(current => ({ ...current, [note.id]: { version: note.version, draft } }))} /><p className="photo-field-hint">Corrections are saved when you approve or publish this memory.</p></details>}</div>}
      {note.body && <p className="review-message">{note.body}</p>}<p className="review-author">— {note.name}</p><p className="review-date">Submitted {date(note.createdAt)}</p>
      {note.email && <p className="review-date">Private contact: <a href={`mailto:${encodeURIComponent(note.email)}`}>{note.email}</a></p>}
      {note.reviewedAt && <p className="review-date">Last reviewed by {note.reviewedBy} · {date(note.reviewedAt)}</p>}
      <details className="review-history" open={historyId === note.id} onToggle={event => { const open = event.currentTarget.open; setHistoryId(value => open ? note.id : value === note.id ? "" : value); }}><summary>Review history</summary>{historyId === note.id && <ReviewHistory key={`${note.id}-${note.version}`} id={note.id} />}</details>
      <div className="review-actions">{note.status !== "approved" && <button className="review-approve" disabled={!!busy} onClick={() => void review(note, "approve")}>{busy === note.id ? "Saving…" : note.status === "pending" ? "Approve" : "Publish"}</button>}{note.status === "pending" && <button disabled={!!busy} onClick={() => void review(note, "decline")}>Decline</button>}{note.status === "approved" && <button disabled={!!busy} onClick={() => void review(note, "hide")}>{busy === note.id ? "Saving…" : "Hide from wall"}</button>}</div>
    </article>)}</section>}
    <div className="review-pagination">{page > 0 && <button disabled={loading || !!busy} onClick={() => setPage(value => value - 1)}>Previous page</button>}{hasMore && <button disabled={loading || !!busy} onClick={() => setPage(value => value + 1)}>Next page</button>}<button disabled={loading || !!busy} onClick={() => setRevision(value => value + 1)}>Refresh</button></div>
    <SiteFooter />
  </main>;
}
