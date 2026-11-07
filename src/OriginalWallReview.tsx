import { useEffect, useState } from "react";
import type { CuratedItem } from "./curatedWall";
import type { MemoryCatalog } from "./memoryPhoto";
import { formatMemoryDate } from "./memoryMetadata";
import MemoryEditor from "./MemoryEditor";
import ReviewHistory from "./ReviewHistory";

export default function OriginalWallReview({catalog}:{catalog:MemoryCatalog}) {
  const [items,setItems]=useState<CuratedItem[]>([]),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState("");
  const [error,setError]=useState(""),[notice,setNotice]=useState(""),[showHidden,setShowHidden]=useState(false),[history,setHistory]=useState("");
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError("");void fetch("/family/api/content/curated",{signal:controller.signal}).then(async response=>{
    if(response.redirected || !response.ok)throw new Error("The wall couldn’t load. You may need to sign in again.");
    const result=await response.json() as {items:CuratedItem[]};if(!controller.signal.aborted)setItems(result.items);
  }).catch(error=>{if(!controller.signal.aborted)setError(error.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[revision]);
  const refresh=()=>{setNotice("Changes saved.");setRevision(value=>value+1);};
  async function visibility(item:CuratedItem) {
    setBusy(item.id);setError("");
    try{const response=await fetch(`/family/api/content/curated/${item.id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:item.hidden ? "restore" : "hide",version:item.version})});if(response.redirected)throw new Error("Please sign in again.");const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error || "Please try again.");setNotice(item.hidden ? "Memory restored to the wall." : "Memory hidden from the wall.");setRevision(value=>value+1);}catch(error){setError(error instanceof Error ? error.message : "Please try again.");}finally{setBusy("");}
  }
  return <section aria-label="Original wall management"><div className="review-tabs"><button aria-pressed={!showHidden} onClick={()=>setShowHidden(false)}>Published <span>{items.filter(item=>!item.hidden).length}</span></button><button aria-pressed={showHidden} onClick={()=>setShowHidden(true)}>Hidden <span>{items.filter(item=>item.hidden).length}</span></button></div>
    {notice && <p className="review-notice" role="status">{notice}</p>}{error && <p className="review-error" role="alert">{error} <button onClick={()=>setRevision(v=>v+1)}>Refresh</button></p>}
    {loading ? <p role="status">Loading the original wall…</p> : <div className="review-list">{items.filter(item=>item.hidden===showHidden).map(item=><article key={`${item.id}-${item.version}`}>
      {item.photo && <div className="review-photograph">{item.kind === "video" ? <video controls src={item.photo.src} poster={item.poster} preload="none" /> : <img src={item.photo.src} alt={item.name} loading="lazy" />}<p>{[formatMemoryDate(item.photo.takenOn),item.photo.place?.label].filter(Boolean).join(" · ")}</p></div>}
      <h2>{item.name}</h2>{item.body && <p className="review-message">{item.body}</p>}
      <MemoryEditor id={item.id} scope="curated" version={item.version} name={item.name} body={item.body} photo={item.photo} catalog={catalog} saved={refresh} />
      <details className="review-history" open={history===item.id} onToggle={event=>{const open=event.currentTarget.open;setHistory(current=>open ? item.id : current===item.id ? "" : current);}}><summary>Change history</summary>{history===item.id && <ReviewHistory id={item.id} scope="curated" saved={refresh} version={item.version} />}</details>
      <div className="review-actions"><button disabled={!!busy} onClick={()=>void visibility(item)}>{busy===item.id ? "Saving…" : item.hidden ? "Restore to wall" : "Hide from wall"}</button></div>
    </article>)}{items.filter(item=>item.hidden===showHidden).length===0 && <p className="review-empty">No {showHidden ? "hidden" : "published"} originals.</p>}</div>}
  </section>;
}
