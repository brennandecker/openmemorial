import { useEffect, useState } from "react";
import type { ReviewEvent } from "./reviewApi";
import { wallTimeZone } from "./wallSettings";

const descriptions = { approve: "Published", decline: "Declined", hide: "Hidden from the wall" };
export default function ReviewHistory({ id }: { id: string }) {
  const [page, setPage] = useState(0);
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    void (async () => {
      const response = await fetch(`/family/api/notes/${id}/history?page=${page}`, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (response.status === 401 || response.status === 403 || response.redirected) throw new Error("Your session has ended. Sign in again to see the history.");
      if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json")) throw new Error("The history couldn’t load. Please try again.");
      const result = await response.json() as { history: ReviewEvent[]; hasMore: boolean };
      if (!controller.signal.aborted) { setEvents(result.history); setHasMore(result.hasMore); }
    })().catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, page, retry]);
  return <div className="review-history-content">
    {loading ? <p role="status">Loading history…</p> : error ? <div role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Try again</button></div> : events.length === 0 ? <p>No decisions yet.</p> : <ol>{events.map(event => <li key={event.id}>
      <strong>{event.action === "approve" && ["declined", "hidden"].includes(event.previousStatus) ? "Republished" : descriptions[event.action]}</strong>
      {!!event.detailsChanged && <span>Photo details corrected before publication</span>}
      <span>{event.reviewer}</span>
      <time dateTime={event.createdAt}>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: wallTimeZone }).format(new Date(event.createdAt))}</time>
    </li>)}</ol>}
    <div className="review-history-pages">{page > 0 && <button disabled={loading} onClick={() => setPage(value => value - 1)}>Newer decisions</button>}{hasMore && <button disabled={loading} onClick={() => setPage(value => value + 1)}>Older decisions</button>}</div>
  </div>;
}
