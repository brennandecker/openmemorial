import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, MessageSquareText } from "lucide-react";
import { wallTimeZone } from "./wallSettings";
import { initialMemorial } from "./memorial";
import type { WallNote } from "./wallNotes";
import { SubmissionCheck } from "./SubmissionCheck";
import { emptyPhotoDraft, maxPhotoBytes, memoryPolicyVersion, rememberedDate, type MemoryCatalog, type PhotoDraft } from "./memoryPhoto";
import { cameraDateFromMetadata, chosenPhotoDate, type DateChoice } from "./photoDateChoice";
import { formatMemoryDate } from "./memoryMetadata";
import PhotoDetailsForm, { PhotoDateFields } from "./PhotoDetailsForm";

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
  const [stage, setStage] = useState<"choose" | "compose" | "preview">("choose");
  const [kind, setKind] = useState<"note" | "photo">("note");
  const [name, setName] = useState(""); const [body, setBody] = useState("");
  const [website, setWebsite] = useState(""); const [email, setEmail] = useState(""); const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [token, setToken] = useState(""); const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [sent, setSent] = useState(false); const [notified, setNotified] = useState(false);
  const [photo, setPhoto] = useState<File>(); const [photoDetails, setPhotoDetails] = useState<PhotoDraft>({ ...emptyPhotoDraft });
  const [preview, setPreview] = useState(""); const [previewError, setPreviewError] = useState(false);
  const [cameraDate, setCameraDate] = useState(""); const [enteredDate, setEnteredDate] = useState("");
  const [dateChoice, setDateChoice] = useState<DateChoice | "">(""); const [readingDate, setReadingDate] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const isPhoto = kind === "photo";
  const confirmedDate = chosenPhotoDate(cameraDate, enteredDate, dateChoice);
  const selectedPhoto: PhotoDraft = { ...photoDetails, ...(confirmedDate || {}) };
  const firstName = initialMemorial.name.trim().split(/\s+/)[0];
  useEffect(() => {
    if (!photo) { setPreview(""); setReadingDate(false); return; }
    let active = true; const url = URL.createObjectURL(photo); setPreview(url); setPreviewError(false); setReadingDate(true);
    void (async () => {
      const { parse } = await import("exifr");
      const info = await parse(photo, { pick: ["DateTimeOriginal", "CreateDate"], reviveValues: false, gps: false, xmp: false, iptc: false, icc: false });
      if (active) setCameraDate(cameraDateFromMetadata(info));
    })().catch(() => { if (active) setCameraDate(""); }).finally(() => { if (active) setReadingDate(false); });
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [photo]);
  useEffect(() => {
    const element = dialog.current!; const focused = document.activeElement as HTMLElement | null; const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; element.showModal();
    return () => { element.close(); document.body.style.overflow = overflow; if (focused?.isConnected) focused.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    dialog.current?.scrollTo({ top: 0 });
    dialog.current?.querySelector<HTMLElement>(sent ? ".note-thanks h3" : "#note-dialog-title")?.focus({ preventScroll: true });
  }, [stage, sent]);
  function choosePhoto(files: FileList | null) {
    if (!files?.length) return;
    if (files.length !== 1 || !files[0].size || files[0].size > maxPhotoBytes) { setError("Choose one photograph up to 10 MB."); return; }
    setError(""); setCameraDate(""); setDateChoice(""); setPhoto(files[0]);
  }
  function advance(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!name.trim()) { setError("Please add your name."); return; }
    if (isPhoto && !photo) { setError("Please choose one photograph."); return; }
    if (!isPhoto && !body.trim()) { setError("Please write your memory."); return; }
    if (isPhoto && (readingDate || !confirmedDate)) { setError(readingDate ? "Please wait while we check the photo’s date." : "Please choose the photo date, your date, or Date unknown."); return; }
    setStage("preview");
  }
  async function share(event: FormEvent) {
    event.preventDefault(); if (busy || !token || !consent || isPhoto && (!photo || !confirmedDate)) return;
    setBusy(true); setError("");
    try {
      const memory = JSON.stringify({ name, body, website, token, email, consent, policyVersion: memoryPolicyVersion, ...(isPhoto ? { photo: selectedPhoto } : {}) });
      const form = new FormData(); if (isPhoto && photo) { form.set("memory", memory); form.set("photo", photo); }
      const response = await fetch("/api/notes", { method: "POST", ...(isPhoto ? { body: form } : { headers: { "Content-Type": "application/json" }, body: memory }), signal: AbortSignal.timeout(60000) });
      const result = await response.json() as { submitted?: boolean; notified?: boolean; error?: string };
      if (!response.ok || !result.submitted) throw new Error(result.error || "Your memory could not be confirmed. Please try again.");
      setNotified(result.notified === true); setSent(true);
    } catch (error) {
      setError(error instanceof Error && error.name !== "TimeoutError" ? error.message : "We couldn’t confirm your submission. Your draft is still here; please try again in a moment.");
      setToken(""); setVerificationAttempt(value => value + 1);
    } finally { setBusy(false); }
  }
  const people = [...photoDetails.peopleIds.map(id => catalog.people[id]).filter(Boolean).map(person => [person.relationship, person.name].filter(Boolean).join(" ")), ...photoDetails.otherPeople.split(",").map(value => value.trim()).filter(Boolean)];
  const caption = photoDetails.caption.trim() || people.join(", ") || `A photograph shared by ${name.trim()}`;
  const location = catalog.places[photoDetails.placeId]?.label || photoDetails.location.trim();
  const shownDate = confirmedDate?.date ? formatMemoryDate(rememberedDate(confirmedDate.date, confirmedDate.dateSource)) : "Date unknown";
  return <dialog ref={dialog} className={`note-dialog memory-intake memory-stage-${stage}`} aria-labelledby="note-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) close(); }} onClick={event => { if (event.target === event.currentTarget && !busy) close(); }}>
    <div className="note-dialog-heading"><h2 id="note-dialog-title" tabIndex={-1}>{stage === "preview" && !sent ? "Preview your memory" : "Share a memory"}</h2><button aria-label="Close note" onClick={close} disabled={busy}>×</button></div>
    {sent ? <div className="note-thanks" role="status"><h3 tabIndex={-1}>Thank you for sharing.</h3><p>{notified ? `${firstName}’s family has been notified.` : `Your memory has been sent to ${firstName}’s family for review.`} Once approved, your memory will be public on the wall.</p><button className="note-submit" onClick={submitted}>Done</button></div> : stage === "choose" ? <div className="memory-kind-choice"><p>What would you like to share?</p><button onClick={() => { setKind("note"); setError(""); setStage("compose"); }}><MessageSquareText aria-hidden="true" /><span>Share a note<small>A memory in your own words</small></span></button><button onClick={() => { setKind("photo"); setError(""); setStage("compose"); }}><Camera aria-hidden="true" /><span>Share a photo<small>One photograph, with an optional note</small></span></button></div> : stage === "compose" ? <form onSubmit={advance}>
      <button className="memory-step-back" type="button" onClick={() => { setError(""); setStage("choose"); }}>← Change memory type</button>
      <label htmlFor="note-name">Your name</label><input id="note-name" name="name" autoComplete="name" maxLength={80} value={name} onChange={event => setName(event.target.value)} required />
      {isPhoto && <>
        <input ref={fileInput} className="photo-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={event => choosePhoto(event.target.files)} />
        {!photo ? <button className="photo-add" type="button" onClick={() => fileInput.current?.click()}>＋ Choose a photograph</button> : <div className="memory-photo-attachment">{preview && !previewError ? <img className="memory-photo-preview" src={preview} alt="Your selected photograph" onError={() => setPreviewError(true)} /> : <p className="photo-field-hint">Photo attached. A display copy will be prepared when you share it.</p>}<div className="photo-attachment-actions"><span>{photo.name}</span><button type="button" onClick={() => fileInput.current?.click()}>Change photo</button><button type="button" onClick={() => { setPhoto(undefined); setCameraDate(""); setDateChoice(""); if (fileInput.current) fileInput.current.value = ""; }}>Remove</button></div></div>}
        <p className="photo-field-hint">One photograph, up to 10 MB. JPEG, PNG, WebP, or HEIC.</p>
        {photo && <>
          <PhotoDetailsForm value={photoDetails} change={setPhotoDetails} catalog={catalog} showDate={false} />
          <fieldset className="memory-date-confirm"><legend>Which date should appear on the photo?</legend><p className="photo-field-hint" role="status">{readingDate ? "Checking the photo for a date…" : cameraDate ? `Date found in the photo: ${formatMemoryDate(rememberedDate(cameraDate, "camera"))}` : "No date was found in this photo."}</p>
            {cameraDate && <label className="memory-date-option"><input type="radio" name="photo-date-choice" value="camera" checked={dateChoice === "camera"} onChange={() => setDateChoice("camera")} />Use the photo’s date: {formatMemoryDate(rememberedDate(cameraDate, "camera"))}</label>}
            <label className="memory-date-option"><input type="radio" name="photo-date-choice" value="entered" checked={dateChoice === "entered"} onChange={() => setDateChoice("entered")} />Use the date I enter</label>
            <div className="memory-entered-date"><PhotoDateFields value={enteredDate} change={value => { setEnteredDate(value); setDateChoice("entered"); }} /><p className="photo-field-hint">A year alone is fine. Leave an unknown month or day blank.</p></div>
            <label className="memory-date-option"><input type="radio" name="photo-date-choice" value="unknown" checked={dateChoice === "unknown"} onChange={() => { setDateChoice("unknown"); if (enteredDate && !rememberedDate(enteredDate, "family")) setEnteredDate(""); }} />Date unknown</label>
          </fieldset>
        </>}
      </>}
      <label htmlFor="note-body">{isPhoto ? "A note about this photo (optional)" : "Your memory"}</label><textarea id="note-body" name="body" rows={4} placeholder={isPhoto ? "What would you like to remember about this moment?" : "What would you like to remember?"} maxLength={1000} value={body} onChange={event => setBody(event.target.value)} required={!isPhoto} />
      <label htmlFor="note-email">Email <span>(optional, kept private)</span></label><input id="note-email" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /><p className="photo-field-hint">So the family can contact you with questions.</p>
      {error && <p className="note-error" role="alert">{error}</p>}<button className="note-submit" type="submit" disabled={isPhoto && (!photo || readingDate)}>Preview memory</button>
    </form> : <form onSubmit={share}>
      <button className="memory-step-back" type="button" disabled={busy} onClick={() => { setError(""); setStage("compose"); }}>← Edit your memory</button>
      {isPhoto ? <div className="memory-card-preview"><section aria-label="Front of your photograph"><h3>Front</h3><figure className="memory-preview-front">{preview && !previewError ? <img src={preview} alt={caption} /> : <div className="memory-preview-placeholder">Your photograph</div>}<figcaption>{caption}<span aria-hidden="true">…</span></figcaption></figure></section><section aria-label="Back of your photograph"><h3>Back</h3><div className="memory-preview-back"><h4>{caption}</h4>{body.trim() && <p>{body}</p>}<p className="memory-preview-credit">Shared by {name.trim()}</p><dl>{people.length > 0 && <><dt>People</dt><dd>{people.join(", ")}</dd></>}<dt>Date</dt><dd>{shownDate}</dd><dt>Location</dt><dd>{location || "Location unknown"}</dd></dl></div></section></div> : <div className="memory-preview-note"><WrittenNote note={{ id: "preview", name: name.trim(), body: body.trim(), createdAt: new Date().toISOString(), pinned: false }} /></div>}
      <input className="note-honey" aria-hidden="true" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} />
      <p className="note-public">Your memory will stay private until the family approves it. Your name will appear with it. By sharing, you agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Use</a>. Read our <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>
      <label className="memory-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required disabled={busy} /><span>I have permission to share {isPhoto ? "this photograph and any note" : "these words"} and have them displayed on this memorial.</span></label>
      <SubmissionCheck key={verificationAttempt} onToken={setToken} />
      {error && <p className="note-error" role="alert">{error}</p>}<button className="note-submit" type="submit" disabled={busy || !token || !consent}>{busy ? "Sharing…" : "Share to wall"}</button>
    </form>}
  </dialog>;
}
