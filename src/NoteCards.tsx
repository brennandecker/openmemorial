import { useEffect, useRef, useState, type FormEvent } from "react";
import { wallTimeZone } from "./wallSettings";
import type { WallNote } from "./wallNotes";
import { SubmissionCheck } from "./SubmissionCheck";
import { emptyPhotoDraft, maxPhotoBytes, memoryPolicyVersion, rememberedDate, type MemoryCatalog, type PhotoDraft } from "./memoryPhoto";
import PhotoDetailsForm from "./PhotoDetailsForm";

export function WrittenNote({ note }: { note: WallNote }) {
  return <article className={`wall-written-note${note.pinned ? " wall-verse" : ""}`}>
    <span className="wall-tape" aria-hidden="true" />
    {note.pinned ? <blockquote><p>{note.body}</p><footer>— {note.name}</footer></blockquote> : <>
      <p className="written-message">{note.body}</p>
      <footer><span className="written-author">— {note.name}</span><time dateTime={note.createdAt}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: wallTimeZone }).format(new Date(note.createdAt))}</time></footer>
    </>}
  </article>;
}

export function LeaveNote({ submitted, close, catalog }: { submitted: () => void; close: () => void; catalog: MemoryCatalog }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState(""); const [consent, setConsent] = useState(false);
  const [photo, setPhoto] = useState<File>(); const [photoDetails, setPhotoDetails] = useState<PhotoDraft>({ ...emptyPhotoDraft });
  const [preview, setPreview] = useState(""); const [previewError, setPreviewError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    let active = true; const url = URL.createObjectURL(photo); setPreview(url); setPreviewError(false);
    void (async () => {
      const { parse } = await import("exifr");
      const info = await parse(photo, { pick: ["DateTimeOriginal", "CreateDate"], reviveValues: false, gps: false, xmp: false, iptc: false, icc: false });
      const raw = info?.DateTimeOriginal || info?.CreateDate;
      const value = typeof raw === "string" ? raw.slice(0, 10).replace(/:/g, "-") : "";
      if (active && rememberedDate(value, "camera")) setPhotoDetails(current => current.date ? current : { ...current, date: value, dateSource: "camera" });
    })().catch(() => { /* An absent camera date is normal. */ });
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [photo]);
  function choosePhoto(files: FileList | null) {
    if (!files?.length) return;
    if (files.length !== 1 || !files[0].size || files[0].size > maxPhotoBytes) { setError("Choose one photograph up to 10 MB."); return; }
    setError(""); setPhoto(files[0]); setPhotoDetails({ ...emptyPhotoDraft });
  }
  useEffect(() => { if (sent) dialog.current?.querySelector<HTMLButtonElement>(".note-thanks button")?.focus(); }, [sent]);
  useEffect(() => {
    const element = dialog.current!;
    const focused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    element.querySelector<HTMLInputElement>("#note-name")?.focus();
    return () => { element.close(); document.body.style.overflow = overflow; if (focused?.isConnected) focused.focus({ preventScroll: true }); };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !token || !consent) return;
    setBusy(true); setError("");
    try {
      const memory = JSON.stringify({ name, body, website, token, email, consent, policyVersion: memoryPolicyVersion, ...(photo ? { photo: photoDetails } : {}) });
      const form = new FormData(); if (photo) { form.set("memory", memory); form.set("photo", photo); }
      const response = await fetch("/api/notes", { method: "POST", ...(photo ? { body: form } : { headers: { "Content-Type": "application/json" }, body: memory }), signal: AbortSignal.timeout(60000) });
      const result = await response.json() as { submitted?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Your note could not be posted. Please try again.");
      if (!result.submitted) throw new Error("Your memory could not be confirmed. Please try again.");
      setSent(true);
    } catch (error) { setError(error instanceof Error && error.name !== "TimeoutError" ? error.message : "We couldn’t confirm your submission. Your draft is still here; please try again in a moment."); setToken(""); setVerificationAttempt(value => value + 1); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="note-dialog" aria-labelledby="note-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) close(); }} onClick={event => { if (event.target === event.currentTarget && !busy) close(); }}>
    <div className="note-dialog-heading"><h2 id="note-dialog-title">Share a memory</h2><button aria-label="Close note" onClick={close} disabled={busy}>×</button></div>
    {sent ? <div className="note-thanks" role="status"><p>Thank you. Your memory has been sent to the family for approval.</p><button className="note-submit" onClick={submitted}>Done</button></div> : <form onSubmit={submit}>
      <label htmlFor="note-name">Your name</label>
      <input id="note-name" name="name" autoComplete="name" maxLength={80} value={name} onChange={event => setName(event.target.value)} required autoFocus disabled={busy} />
      <label htmlFor="note-body">Your memory {photo && <span>(optional)</span>}</label>
      <textarea id="note-body" name="body" rows={4} placeholder="What would you like to remember?" maxLength={1000} value={body} onChange={event => setBody(event.target.value)} required={!photo} disabled={busy} />
      <input ref={fileInput} className="photo-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={event => choosePhoto(event.target.files)} disabled={busy} />
      {!photo ? <button className="photo-add" type="button" onClick={() => fileInput.current?.click()} disabled={busy}>＋ Add a photograph <span>(optional)</span></button> : <div className="memory-photo-attachment">
        {preview && !previewError ? <img className="memory-photo-preview" src={preview} alt="Your selected photograph" onError={() => setPreviewError(true)} /> : <p className="photo-field-hint">Photo attached. The family will see a preview after it is prepared.</p>}
        <div className="photo-attachment-actions"><span>{photo.name}</span><button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>Change photo</button><button type="button" disabled={busy} onClick={() => { setPhoto(undefined); setPhotoDetails({ ...emptyPhotoDraft }); if (fileInput.current) fileInput.current.value = ""; }}>Remove</button></div>
        <details className="photo-details-disclosure"><summary>Photo details <span>(optional)</span>{photoDetails.date && <span> · {photoDetails.date}</span>}</summary><PhotoDetailsForm value={photoDetails} change={setPhotoDetails} catalog={catalog} disabled={busy} /></details>
      </div>}
      <p className="photo-field-hint">One photograph, up to 10 MB. JPEG, PNG, WebP, or HEIC.</p>
      <label htmlFor="note-email">Email <span>(optional, kept private)</span></label><input id="note-email" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
      <p className="photo-field-hint">So the family can contact you with questions.</p>
      <div className="note-honey" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} /></label></div>
      <p className="note-public">The family will review your memory before it appears on the wall. Your name will appear with it if approved. By sending it, you agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Use</a>. Read our <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>
      <label className="memory-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required disabled={busy} /><span>I have permission to share these words and this photograph, if attached, and have them displayed on this memorial.</span></label>
      <SubmissionCheck key={verificationAttempt} onToken={setToken} />
      {error && <p className="note-error" role="alert">{error}</p>}
      <button className="note-submit" disabled={busy || !token || !consent || !name.trim() || !body.trim() && !photo}>{busy ? "Sending…" : "Send to the family"}</button>
    </form>}
  </dialog>;
}
