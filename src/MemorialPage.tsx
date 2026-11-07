
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Check, ChevronDown, Download, Flower2, Heart, ImagePlus, LockKeyhole, Pencil, Plus, Sprout, X } from "lucide-react";
import { createExport, formatDate, initialMemorial, isMemorial, photoCaption, preparePortableMemorial, upgradeFamilyMedia, type Memorial, type MemorialVideo } from "./memorial";

const STORE = "memorial.scrapbook.drafts.v1";
const VISITOR_STORE = "memorial.private-memories.v1";
type View = "story" | "photos" | "memories" | "gathering";

function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = ref.current; el?.showModal(); return () => el?.close(); }, []);
  return <dialog ref={ref} className="modal" onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={20}/></button></div>{children}</dialog>;
}

function PhotoScraps({ photos, name, open, remove }: { photos: string[]; name: string; open: (src: string) => void; remove?: (index: number) => void }) {
  return <div className="photo-grid full-photographs">{photos.map((photo, i) => <figure key={`${i}-${photo.slice(-40)}`}><span className="tape gallery-tape" aria-hidden="true"/><button className="photo-open" onClick={() => open(photo)} aria-label={`View photograph ${i + 1}`}><img src={photo} alt={`A family photograph remembering ${name}, ${i + 1}`} loading="lazy" decoding="async"/></button><figcaption>{photoCaption(photo)} <span aria-hidden="true">♡</span></figcaption>{remove && <button className="remove-photo" aria-label={`Remove photograph ${i + 1}`} onClick={() => remove(i)}><X size={14}/></button>}</figure>)}</div>;
}

function VideoScraps({ videos }: { videos: MemorialVideo[] }) {
  if (!videos.length) return null;
  return <section className="video-section"><div className="section-heading"><div><p className="eyebrow">more than a still photograph</p><h2>A moment in motion.</h2></div><span className="video-annotation">a little piece to keep <Heart size={16}/></span></div>{videos.map((v, i) => <figure className="video-scrap" key={`${i}-${v.title}`}><span className="tape video-tape" aria-hidden="true"/><video controls playsInline preload="none" poster={v.poster || undefined} aria-label={v.title}><source src={v.src} type="video/mp4"/>Your browser cannot play this video.</video><figcaption>{v.title} <span aria-hidden="true">♡</span></figcaption></figure>)}</section>;
}

export default function MemorialPage({ studio = false }: { studio?: boolean }) {
  const [memorials, setMemorials] = useState<Memorial[]>([initialMemorial]);
  const [selected, setSelected] = useState(initialMemorial.id);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState("Loading your draft…");
  const [view, setView] = useState<View>("story");
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<"memory" | "create" | "download" | null>(null);
  const [library, setLibrary] = useState(false);
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const exportFont = useRef("");
  const photoInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const m = memorials.find(x => x.id === selected) || memorials[0];

  useEffect(() => {
    void fetch("/fonts/caveat.ttf").then(r => { if (!r.ok) throw new Error("Font unavailable"); return r.blob(); }).then(blob => { const reader = new FileReader(); reader.onload = () => { exportFont.current = String(reader.result).split(",")[1] || ""; }; reader.readAsDataURL(blob); }).catch(() => { /* Local handwriting fallbacks still work offline. */ });
    try {
      const raw = localStorage.getItem(studio ? STORE : VISITOR_STORE);
      if (raw) {
        const data = JSON.parse(raw);
        if (studio) {
          if (!Array.isArray(data) || !data.length || !data.every(isMemorial)) throw new Error("Invalid draft data");
          setMemorials(data.map(upgradeFamilyMedia)); setSelected(data[0].id);
        } else {
          const restored = { ...initialMemorial, memories: data };
          if (!isMemorial(restored)) throw new Error("Invalid memory data");
          setMemorials([restored]);
        }
      }
    } catch { setNotice("We couldn’t open your saved drafts. Download a backup before leaving this page. Existing browser data has been left untouched."); setSaved("Browser storage unavailable"); return; }
    setReady(true);
  }, [studio]);

  useEffect(() => {
    if (!ready) return;
    if (!memorials.every(isMemorial)) { setSaved("Add a name to save your draft"); return; }
    setSaved("Saving…");
    const timer = setTimeout(() => {
      try { localStorage.setItem(studio ? STORE : VISITOR_STORE, JSON.stringify(studio ? memorials : memorials[0].memories)); setSaved("Saved in this browser"); }
      catch { setSaved("Couldn’t save in this browser"); setNotice("Your changes are still on this page. Please download a backup to keep them."); }
    }, 400);
    return () => clearTimeout(timer);
  }, [memorials, ready, studio]);

  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 9000); return () => clearTimeout(timer); }, [notice]);

  function update(patch: Partial<Memorial>) { setMemorials(all => all.map(x => x.id === m.id ? { ...x, ...patch } : x)); }
  function go(next: View) { setView(next); sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  function download(content: string, type: string, extension: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a"); a.href = url; a.download = `${m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "memorial"}.${extension}`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function addPhotos(files: FileList | null, portrait = false) {
    if (!files?.length) return;
    const currentId = m.id;
    if (!portrait && m.photos.length >= 12) { setNotice("You can add up to 12 photos in this first version."); return; }
    const available = portrait ? 1 : 12 - m.photos.length;
    const added: string[] = [];
    for (const file of Array.from(files).slice(0, available)) {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 15 * 1024 * 1024) { setNotice("Please choose a JPG, PNG, WebP, or GIF under 15 MB."); continue; }
      try {
        const source = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
        const img = await new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = source; });
        const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Image processing unavailable");
        ctx.fillStyle = "#f6f3eb"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        added.push(canvas.toDataURL("image/jpeg", .8));
      } catch { setNotice("That photo couldn’t be opened. Please try another image."); }
    }
    if (added.length) setMemorials(all => all.map(x => x.id !== currentId ? x : portrait ? { ...x, portrait: added[0] } : { ...x, photos: [...x.photos, ...added].slice(0, 12) }));
  }

  async function importBackup(file?: File) {
    if (!file) return;
    if (file.size > 64 * 1024 * 1024) { setNotice("Please choose a memorial backup under 64 MB."); return; }
    try { const item = JSON.parse(await file.text()); if (!isMemorial(item)) throw new Error("Invalid backup"); const imported = { ...item, id: crypto.randomUUID() }; setMemorials(all => [...all, imported]); setSelected(imported.id); setLibrary(false); setView("story"); setNotice("Your memorial backup has been restored as a new draft."); }
    catch { setNotice("This file isn’t a valid memorial backup. Please choose a JSON backup downloaded from this scrapbook."); }
  }

  function createMemorial(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const data = new FormData(e.currentTarget); const name = String(data.get("name") || "").trim(); if (!name) return;
    const item: Memorial = { id: crypto.randomUUID(), name, birth: "", death: "", subtitle: "Forever loved. Always remembered.", quote: "", attribution: "", story: "", service: "", portrait: "", photos: [], memories: [], theme: "olive" };
    setMemorials(all => [...all, item]); setSelected(item.id); setDialog(null); setEditing(true); setView("story"); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveKeepsake(kind: "html" | "json") {
    setExporting(true);
    try {
      const portable = await preparePortableMemorial(m, async path => {
        const response = await fetch(path);
        if (!response.ok) throw new Error("A photograph or video could not be loaded.");
        const blob = await response.blob();
        return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
      });
      if (kind === "html") download(createExport(portable, exportFont.current), "text/html;charset=utf-8", "html");
      else download(JSON.stringify(portable, null, 2), "application/json", "json");
      setNotice("Your keepsake includes the photographs and video, ready to keep close.");
    } catch { setNotice("We couldn’t prepare every photograph or video. Please try again while connected; your draft is still here."); }
    finally { setExporting(false); }
  }

  const firstName = m.name.trim().split(" ")[0] || "your loved one";

  return <div className={`site theme-${m.theme} ${studio ? "studio-view" : "personal-memorial"}`}>
    {studio && <><header className="topbar personal-studio"><a className="studio-name" href="/">{initialMemorial.name}</a><span className="top-center">local scrapbook editor</span><div className="header-actions"><button className="text-button" onClick={() => importInput.current?.click()}>Restore a backup</button><button className="button small primary" onClick={() => setEditing(!editing)}><Pencil size={14}/>{editing ? "Close editor" : "Edit scrapbook"}</button></div></header><div className="draftbar"><span><LockKeyhole size={12}/> Local draft <span className="draft-separator">·</span><span className="save-label">{saved}</span></span><button onClick={() => setDialog("download")}>Keep a copy <Download size={13}/></button></div></>}

    <div className={`workspace ${studio && editing ? "is-editing" : ""}`}>
      <main id="memorial">
        <section className="hero">
          <div className="hero-copy"><p className="eyebrow">a scrapbook of a life, loved</p><h1>{m.name || "Someone you love"}</h1><p className="lifespan">{formatDate(m.birth)}{m.birth && m.death && <span> — </span>}{formatDate(m.death)}</p><p className="hero-subtitle">{m.subtitle}</p><button className="button primary" onClick={() => setDialog("memory")}><Heart size={16} strokeWidth={1.5}/> Write a memory</button><button className="explore-link" onClick={() => go("story")}>Remembering {firstName}<ArrowDown size={13}/></button></div>
          <div className="hero-art">
            <span className="tape photo-tape" aria-hidden="true"/>
            <div className="polaroid"><div className={`arch ${m.portrait ? "has-photograph" : ""}`}>{m.portrait ? <img className="portrait" src={m.portrait} alt={`A family photograph remembering ${m.name}`}/> : <div className="photo-placeholder"><svg width="63" height="58" viewBox="0 0 63 58" fill="none" aria-hidden="true"><path d="M30 49S3 32 6 18C9 2 28 7 31 19C36 0 58 7 57 22C56 35 30 49 30 49Z" stroke="currentColor" strokeWidth="1.3"/><path d="M14 14C18 9 23 14 24 16M8 48l-5 4M54 4l4-4M57 43l5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg><span>a favorite photo<br/>of {firstName}</span><button hidden={!studio} className="add-portrait" onClick={() => { if (!studio) return; setEditing(true); setTimeout(() => document.getElementById("portrait-upload")?.click(), 0); }}><Plus size={15}/> add a photograph</button></div>}</div><span className="art-caption">{m.portrait ? photoCaption(m.portrait) : `remembering ${firstName.toLowerCase()}`} <span aria-hidden="true">♡</span></span></div>
            <span className="photo-annotation">the moments we keep <svg viewBox="0 0 90 45" fill="none" aria-hidden="true"><path d="M3 10C20 1 53 2 68 28M59 25l12 8 2-14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg></span>
          </div>
          <aside className="hero-note"><span className="tape note-tape" aria-hidden="true"/><p className="note-eyebrow">{m.id === initialMemorial.id ? "words to keep close" : "words to keep close"}</p><blockquote>{m.quote || "Some people stay with us, always."}</blockquote><p className="note-signature">— {m.attribution || "with love"} <span aria-hidden="true">♡</span></p><svg className="note-flower" viewBox="0 0 60 90" fill="none" aria-hidden="true"><path d="M30 86c-1-27 4-40 1-53M32 65C13 68 9 53 9 53c18-3 23 12 23 12ZM32 54c16-1 22-13 22-13-16-4-22 13-22 13Z" stroke="currentColor" strokeWidth="1.2"/><path d="M30 20c-11-24-26-3-8 5-26-3-18 23 2 9-13 24 14 29 13 5 16 20 32-4 9-11 25-9 4-28-6-9 2-25-23-22-10 1Z" stroke="currentColor" strokeWidth="1.2"/></svg><span className="forever-sticker">forever<br/>loved <Heart size={13}/></span></aside>
        </section>

        <section className="content-section" ref={sectionRef}>
          <nav className="section-tabs" aria-label="Memorial sections">{([['story', 'their story'], ['photos', 'photographs'], ['memories', 'little memories'], ['gathering', 'gathering together']] as const).map(([key, label]) => <button key={key} aria-current={view === key ? "page" : undefined} className={view === key ? "active" : ""} onClick={() => setView(key)}>{key === "story" && m.id !== initialMemorial.id ? "their story" : label}{key === "photos" && m.photos.length > 0 && <span>{m.photos.length}</span>}{key === "memories" && m.memories.length > 0 && <span>{m.memories.length}</span>}</button>)}</nav>

          {view === "story" && <div className="story-grid"><div className="story-main"><p className="eyebrow">the person behind the photographs</p><h2>A little about {firstName}.</h2>{m.story ? m.story.split("\n").filter(Boolean).map((p, i) => <p className="story-text" key={i}>{p}</p>) : <div className="gentle-empty"><p>There’s no need to find all the words at once.</p><p>Start with something small. A favorite moment, a familiar laugh, the things you never want to forget.</p><button hidden={!studio} className="text-button" onClick={() => setEditing(true)}>Add to their story <ArrowRight size={14}/></button></div>}<div className="story-signature"><Sprout size={23} strokeWidth={1.2}/><span>{m.id === initialMemorial.id ? "a life made of little things" : "a life made of little things"}</span></div></div><aside className="quote-card"><span className="tape small-tape" aria-hidden="true"/><p className="keepsake-heading">room for the little things</p><p className="keepsake-copy">A song that sounds like them.<br/>A story you tell again and again.<br/>A photo you’ll always keep.</p><span className="keepsake-rule"/><button className="text-button" onClick={() => setDialog("memory")}>save a little memory <Heart size={15}/></button><svg className="keepsake-star" width="47" height="48" viewBox="0 0 47 48" fill="none" aria-hidden="true"><path d="m25 2 4 16 16-2-13 11 8 17-16-9-15 10 5-18L1 18l18-1 6-15Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg></aside></div>}

          {view === "story" && (m.photos.length > 0 || (m.videos || []).length > 0) && <div className="family-pages">{m.photos.length > 0 && <section className="family-photographs"><div className="section-heading"><div><p className="eyebrow">a life, surrounded by love</p><h2>A whole lot of love.</h2></div><span className="gallery-annotation">pieces of a life, loved <Heart size={17}/></span></div><PhotoScraps photos={m.photos} name={m.name} open={setLightbox}/></section>}<VideoScraps videos={m.videos || []}/></div>}

          {view === "photos" && <div className="section-body"><div className="section-heading"><div><p className="eyebrow">The everyday. The unforgettable.</p><h2>A life in photographs.</h2></div><button hidden={!studio} className="button secondary" onClick={() => photoInput.current?.click()}><Plus size={15}/> Add photos</button></div>{m.photos.length ? <PhotoScraps photos={m.photos} name={m.name} open={setLightbox} remove={studio && editing ? i => update({ photos: m.photos.filter((_, j) => i !== j) }) : undefined}/> : <div className="empty-state"><ImagePlus size={32} strokeWidth={1}/><h3>Every photograph holds a story.</h3><p>Add a favorite photo of {firstName}. You can come back for the others.</p><button hidden={!studio} className="text-button" onClick={() => photoInput.current?.click()}>Choose a photograph <ArrowRight size={14}/></button></div>}{studio && <p className="local-note">New uploads and edits save in this browser.</p>}<VideoScraps videos={m.videos || []}/></div>}

          {view === "memories" && <div className="section-body"><div className="section-heading"><div><p className="eyebrow">The things we carry with us</p><h2>Little moments. Lasting love.</h2></div><button className="button secondary" onClick={() => setDialog("memory")}><Plus size={15}/> Write a memory</button></div><p className="local-note memory-note">Memories written here are personal keepsakes saved in your browser. They aren’t sent to the family or posted publicly.</p>{m.memories.length ? <div className="memory-grid">{m.memories.map(memory => <article className="memory-card" key={memory.id}><Heart size={17} strokeWidth={1.2}/><p>{memory.text}</p><span>{memory.author}</span>{editing && <button className="text-button remove-memory" onClick={() => update({ memories: m.memories.filter(x => x.id !== memory.id) })}>Remove memory</button>}</article>)}</div> : <div className="empty-state"><Heart size={32} strokeWidth={1}/><h3>A moment worth holding on to.</h3><p>A small story can mean so much. What would you like to remember?</p><button className="text-button" onClick={() => setDialog("memory")}>Write the first memory <ArrowRight size={14}/></button></div>}</div>}

          {view === "gathering" && <div className="section-body gathering"><p className="eyebrow">A time to be together</p><h2>Remembering, together.</h2><Sprout size={36} strokeWidth={1}/>{m.service ? <p className="service-text">{m.service}</p> : <><h3>When the family is ready.</h3><p>Service details have not been added.</p></>}<button hidden={!studio} className="text-button" onClick={() => setEditing(true)}>Edit gathering details <Pencil size={13}/></button></div>}
        </section>

        <section className="closing"><Flower2 size={25} strokeWidth={1}/><h2>So many little things. So much love.</h2><p>Keep a story. Save a photograph. Leave a little piece of your heart.</p><button className="text-button" onClick={() => setDialog("memory")}>leave a little love <Heart size={14}/></button></section>
        <footer className="personal-footer"><p>{m.name} <span aria-hidden="true">♡</span></p><button className="text-button" onClick={() => setDialog("download")}>Keep a copy <Download size={13}/></button></footer>
      </main>

      {studio && editing && <aside className="editor"><div className="editor-title"><div><p className="eyebrow">At your own pace</p><h2>Make it personal.</h2></div><button className="icon-button" onClick={() => setEditing(false)} aria-label="Close editor"><X size={19}/></button></div><p className="editor-intro">Start with a little. Add more whenever you’re ready.</p><label>Full name<input maxLength={120} value={m.name} onChange={e => update({ name: e.target.value })} onBlur={() => { if (!m.name.trim()) update({ name: "Someone you love" }); }} required/></label><div className="date-fields"><label>Born <span>optional</span><input type="date" value={m.birth} max={m.death || undefined} onChange={e => { if (m.death && e.target.value > m.death) { setNotice("The birth date must come before the date of passing."); return; } update({ birth: e.target.value }); }}/></label><label>Passed <span>optional</span><input type="date" value={m.death} min={m.birth || undefined} onChange={e => { if (e.target.value && m.birth && e.target.value < m.birth) { setNotice("The date of passing must come after the birth date."); return; } update({ death: e.target.value }); }}/></label></div><label>A few words<input maxLength={180} value={m.subtitle} onChange={e => update({ subtitle: e.target.value })}/></label><label className="upload-label">Portrait<input id="portrait-upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => { void addPhotos(e.target.files, true); e.target.value = ""; }}/><span><ImagePlus size={17}/>{m.portrait ? "Replace photograph" : "Choose a photograph"}</span></label>{m.portrait && <button className="text-button remove-portrait" onClick={() => update({ portrait: "" })}>Remove portrait</button>}<label>Their story<textarea rows={6} maxLength={12000} placeholder="What do you want people to remember?" value={m.story} onChange={e => update({ story: e.target.value })}/></label><label>Words to hold close<textarea rows={3} maxLength={1000} value={m.quote} onChange={e => update({ quote: e.target.value })}/></label><label>From<input maxLength={120} placeholder="e.g. His mother" value={m.attribution} onChange={e => update({ attribution: e.target.value })}/></label><label>Gathering details <span>optional</span><textarea rows={4} maxLength={5000} placeholder="When and where to gather, or a note from the family." value={m.service} onChange={e => update({ service: e.target.value })}/></label><fieldset className="theme-options"><legend>Choose a feeling</legend>{([['olive', 'Olive'], ['clay', 'Clay'], ['blue', 'Sky']] as const).map(([value, label]) => <button key={value} className={`swatch ${value} ${m.theme === value ? 'selected' : ''}`} aria-pressed={m.theme === value} onClick={() => update({ theme: value })}><span/>{label}{m.theme === value && <Check size={12}/>}</button>)}</fieldset><div className="editor-end"><LockKeyhole size={14}/><p>Your changes stay in this browser. Download a backup to keep them safe.</p></div><button className="button primary full" onClick={() => setDialog("download")}><Download size={15}/> Download your memorial</button></aside>}
    </div>

    <input ref={photoInput} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={e => { void addPhotos(e.target.files); e.target.value = ""; }}/>
    <input ref={importInput} hidden type="file" accept="application/json,.json" onChange={e => { void importBackup(e.target.files?.[0]); e.target.value = ""; }}/>
    {notice && <div className="toast" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={16}/></button></div>}

    {dialog === "memory" && <Modal title="A little memory, held close." close={() => setDialog(null)}><p className="modal-intro">A favorite moment. Something they always said. There’s no right way to remember.</p><form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); const text = String(data.get("memory") || "").trim(), author = String(data.get("author") || "").trim(); if (!text || !author) return; update({ memories: [...m.memories, { id: crypto.randomUUID(), author, text }] }); setDialog(null); setView("memories"); setNotice("Your memory has been kept in this browser. You can download a copy to keep."); }}><label>Your name<input name="author" maxLength={100} required autoFocus autoComplete="name" placeholder="How you’d like to be remembered here"/></label><label>Your memory<textarea name="memory" maxLength={4000} rows={6} required placeholder={`I remember when ${firstName}…`}/></label><p className="local-note"><LockKeyhole size={12}/> Kept only in this browser. This isn’t sent to the family or posted publicly.</p><button className="button primary full" type="submit">Keep this memory <Heart size={15}/></button></form></Modal>}
    {dialog === "create" && <Modal title="A place for someone you love." close={() => setDialog(null)}><p className="modal-intro">All you need to start is their name. Everything else can come later.</p><form onSubmit={createMemorial}><label>Their name<input name="name" maxLength={120} required autoFocus placeholder="Full name"/></label><p className="local-note">Your other memorials will stay in Your memorials.</p><button type="submit" className="button primary full">Create a private draft <ArrowRight size={15}/></button></form></Modal>}
    {dialog === "download" && <Modal title="Keep their memory close." close={() => setDialog(null)}><p className="modal-intro">Keep a copy of the photographs, video, and words collected here.</p><button className="download-option" disabled={exporting} onClick={() => { void saveKeepsake("html"); }}><span className="download-icon"><Flower2 size={23} strokeWidth={1.2}/></span><span><strong>Download memorial page</strong><small>A complete page with photographs, video, and memories. Opens offline in a browser, and can be sent to family.</small></span><Download size={17}/></button><button className="download-option" disabled={exporting} onClick={() => { void saveKeepsake("json"); }}><span className="download-icon"><Download size={21} strokeWidth={1.2}/></span><span><strong>Download an editable backup</strong><small>Restore this file from Your memorials to keep editing later or on another device.</small></span><Download size={17}/></button><p className="local-note" role="status">{exporting ? "Preparing your photographs and video…" : "The keepsake includes your media and may take a moment to prepare."}</p><p className="local-note">Anyone you send a downloaded copy to can view its contents. Memories you write here stay in your browser; they aren’t posted to a shared guestbook.</p></Modal>}
    {lightbox && <Modal title="A moment to remember." close={() => setLightbox(null)}><img className="lightbox-image" src={lightbox} alt={`Remembering ${m.name}`}/></Modal>}
  </div>;
}
