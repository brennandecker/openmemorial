import { useEffect, useRef, useState, type FormEvent } from "react";
import { wallTimeZone } from "./wallSettings";
import type { WallNote } from "./wallNotes";
import { SubmissionCheck } from "./SubmissionCheck";

export function WrittenNote({ note }: { note: WallNote }) {
  return <article className={`wall-written-note${note.pinned ? " wall-verse" : ""}`}>
    <span className="wall-tape" aria-hidden="true" />
    {note.pinned ? <blockquote><p>{note.body}</p><footer>— {note.name}</footer></blockquote> : <>
      <p className="written-message">{note.body}</p>
      <footer><span className="written-author">— {note.name}</span><time dateTime={note.createdAt}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: wallTimeZone }).format(new Date(note.createdAt))}</time></footer>
    </>}
  </article>;
}

export function LeaveNote({ submitted, close }: { submitted: () => void; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [sent, setSent] = useState(false);
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
    if (busy || !token) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, body, website, token }), signal: AbortSignal.timeout(20000) });
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
      <label htmlFor="note-body">Your note</label>
      <textarea id="note-body" name="body" rows={6} maxLength={1000} value={body} onChange={event => setBody(event.target.value)} required disabled={busy} />
      <div className="note-honey" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} /></label></div>
      <p className="note-public">The family will review your memory before it appears on the wall. Your name will appear with it if approved. By sending it, you agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Use</a>. Read our <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>
      <SubmissionCheck key={verificationAttempt} onToken={setToken} />
      {error && <p className="note-error" role="alert">{error}</p>}
      <button className="note-submit" disabled={busy || !token || !name.trim() || !body.trim()}>{busy ? "Sending…" : "Send to the family"}</button>
    </form>}
  </dialog>;
}
