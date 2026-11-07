import { useState } from "react";
import PhotoDetailsForm from "./PhotoDetailsForm";
import { photoDraft, photoFrontNames, type MemoryCatalog, type MemoryPhoto, type PhotoDraft } from "./memoryPhoto";

export default function MemoryEditor({ id, scope, version, name, body, photo, catalog, saved }: { id: string; scope: "curated" | "submission"; version: number; name: string; body: string; photo?: MemoryPhoto; catalog: MemoryCatalog; saved: () => void }) {
  const [open,setOpen]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState("");
  const [author,setAuthor]=useState(name), [message,setMessage]=useState(body);
  const [details,setDetails]=useState<PhotoDraft | undefined>(photo ? photoDraft(photo,catalog) : undefined);
  async function save() {
    setBusy(true);setError("");
    try {
      const response=await fetch(`/family/api/content/${scope}/${id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"edit",version,name:author,body:message,...(details ? {photo:details} : {})})});
      if (response.redirected || response.status===401 || response.status===403) throw new Error("Your session has ended. Sign in again before saving.");
      const result=await response.json() as {error?:string};
      if (!response.ok) throw new Error(result.error || "Your changes couldn’t be saved.");
      saved(); setOpen(false);
    } catch(error) {setError(error instanceof Error ? error.message : "Please try again.");} finally {setBusy(false);}
  }
  function cancel() {setAuthor(name);setMessage(body);setDetails(photo ? photoDraft(photo,catalog) : undefined);setError("");setOpen(false);}
  return <details className="memory-editor" open={open} onToggle={event=>setOpen(event.currentTarget.open)}><summary>Edit memory</summary>{open && <form onSubmit={event=>{event.preventDefault();void save();}}>
    <label>{scope === "curated" && photo ? "Caption on the front" : "Name / attribution"}<input required maxLength={scope === "curated" && photo ? 180 : 80} value={author} onChange={event=>setAuthor(event.target.value)} disabled={busy} /></label>
    {details && <PhotoDetailsForm value={details} catalog={catalog} disabled={busy} change={value=>{setDetails(value);if(scope === "curated" && JSON.stringify(value.personEntries)!==JSON.stringify(details.personEntries))setAuthor(photoFrontNames(value,catalog).join(", ") || author);}} />}
    <label>{photo ? "Note on the back (optional)" : "Memory"}<textarea rows={4} maxLength={1000} required={!photo} value={message} onChange={event=>setMessage(event.target.value)} disabled={busy} /></label>
    <p className="photo-field-hint">Saving updates the memory without changing whether it is published. Previous details stay in its history.</p>
    {error && <p className="review-error" role="alert">{error}</p>}<div className="review-actions"><button type="submit" className="review-approve" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button><button type="button" disabled={busy} onClick={cancel}>Cancel</button></div>
  </form>}</details>;
}
