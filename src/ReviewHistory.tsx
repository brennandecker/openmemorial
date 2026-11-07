import { useEffect, useState } from "react";
import type { ReviewEvent } from "./reviewApi";
import { formatMemoryDate } from "./memoryMetadata";
import { wallTimeZone } from "./wallSettings";

const descriptions = { approve: "Published", decline: "Declined", hide: "Hidden from the wall", edit: "Memory edited", restore: "Restored to the wall" };
export default function ReviewHistory({ id, scope = "submission", version, saved }: { id: string; scope?: "curated" | "submission"; version?: number; saved?: () => void }) {
  const [page, setPage] = useState(0);
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy,setBusy] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    void (async () => {
      const response = await fetch(`/family/api/content/${scope}/${id}/history?page=${page}`, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (response.status === 401 || response.status === 403 || response.redirected) throw new Error("Your session has ended. Sign in again to see the history.");
      if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json")) throw new Error("The history couldn’t load. Please try again.");
      const result = await response.json() as { history: ReviewEvent[]; hasMore: boolean };
      if (!controller.signal.aborted) { setEvents(result.history); setHasMore(result.hasMore); }
    })().catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, scope, page, retry]);
  async function restore(event: ReviewEvent) {
    setBusy(event.id);setError("");
    try {const response=await fetch(`/family/api/content/${scope}/${id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"edit",version,restoreId:event.id})});if(response.redirected)throw new Error("Please sign in again.");const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error || "The details couldn’t be restored.");saved?.();}catch(error){setError(error instanceof Error ? error.message : "Please try again.");}finally{setBusy("");}
  }
  return <div className="review-history-content">
    {loading ? <p role="status">Loading history…</p> : error ? <div role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Try again</button></div> : events.length === 0 ? <p>No decisions yet.</p> : <ol>{events.map(event => <li key={event.id}>
      <strong>{event.action === "approve" && ["declined", "hidden"].includes(event.previousStatus) ? "Republished" : descriptions[event.action]}</strong>
      {!!event.detailsChanged && <span>Details changed</span>}
      {event.before && event.after && <details className="review-diff"><summary>See before and after</summary>{(["before","after"] as const).map(side => { const content=event[side]!;return <section key={side}><h3>{side === "before" ? "Before" : "After"}</h3><p>{content.name}</p>{content.body && <p>{content.body}</p>}{content.photo && <p>{[content.photo.people.map(p=>p.label).join(", "),formatMemoryDate(content.photo.takenOn),content.photo.place?.label || "Location unknown"].filter(Boolean).join(" · ")}</p>}</section>;})}{event.action === "edit" && saved && <button disabled={!!busy} onClick={()=>void restore(event)}>{busy === event.id ? "Restoring…" : "Restore these previous details"}</button>}</details>}
      <span>{event.reviewer}</span>
      <time dateTime={event.createdAt}>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: wallTimeZone }).format(new Date(event.createdAt))}</time>
    </li>)}</ol>}
    <div className="review-history-pages">{page > 0 && <button disabled={loading} onClick={() => setPage(value => value - 1)}>Newer decisions</button>}{hasMore && <button disabled={loading} onClick={() => setPage(value => value + 1)}>Older decisions</button>}</div>
  </div>;
}
