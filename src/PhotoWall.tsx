import SiteFooter from "./SiteFooter";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Pause, Play } from "lucide-react";
import { formatDate, initialMemorial, photoCaption } from "./memorial";
import { headerPhotograph, photoNotes, mediaMetadata, people, places, type PhotoNote } from "./photoWallData";
import { firstWallNotes, type WallNote } from "./wallNotes";
import { LeaveNote, WrittenNote } from "./NoteCards";
import { ageLabel, dateMatches, emptyFilters, mediaMatches, filterBounds, hasFilters, formatMemoryDate, type MediaMetadata, type WallFilters as Filters } from "./memoryMetadata";
import type { MemoryCatalog } from "./memoryPhoto";
import { postedDay } from "./wallSettings";
import { WallFilters } from "./WallFilters";
import "./photo-wall.css";

type Scrap = { src: string; title: string; poster?: string; video?: boolean; note?: PhotoNote; meta?: MediaMetadata; credit?: string };
const emptyNote: PhotoNote = { message: "", date: "", location: "", width: 4, height: 3 };

function MemorialDove({ src, personIds }: { src: string; personIds?: string[] }) {
  const remembered = (personIds || mediaMetadata[src]?.peopleIds || []).map(id => people[id]).filter(person => person?.inMemoriam);
  if (!remembered.length) return null;
  return <svg className="wall-memorial-dove" viewBox="0 0 40 36" role="img" aria-label={`In loving memory of ${remembered.map(person => person.name).join(" and ")}`} fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
    <path d="M27 17C22 12 19 5 10 3c1 5 4 10 8 14-5-1-9-4-14-7 0 6 4 12 11 15l-6 6 10-2c6 1 11-2 12-7l5-3-5-1c-1-5-7-5-8-1" />
    <path d="M15 10c2 4 5 7 9 9M12 17c3 3 6 4 10 5M35 20l-1 10m0-5c-3 0-4-2-4-3 3 0 4 1 4 3m0 3c2 0 4-2 4-4-3 1-4 2-4 4" />
    <circle cx="28.5" cy="17.9" r=".65" fill="currentColor" stroke="none" />
  </svg>;
}

function PhotoName({ src, title, personIds }: { src: string; title: string; personIds?: string[] }) {
  const split = title.lastIndexOf(" ");
  return <>{title.slice(0, split + 1)}<span className="wall-name-ending">{title.slice(split + 1)}<MemorialDove src={src} personIds={personIds} /></span></>;
}

function Photo({ scrap, index, open }: { scrap: Scrap; index: number; open: (src: string) => void }) {
  const [turned, setTurned] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const frontButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const interacted = useRef(false);
  useEffect(() => {
    if (interacted.current) (turned ? backButton : frontButton).current?.focus({ preventScroll: true });
  }, [turned]);
  const note = scrap.note || photoNotes[scrap.src] || emptyNote;
  const meta = scrap.meta || mediaMetadata[scrap.src];
  const age = ageLabel(meta?.takenOn, initialMemorial.birth, initialMemorial.death);
  const era = [meta?.takenOn?.value.slice(0, 4), age].filter(Boolean).join(" · ");
  const flip = () => { interacted.current = true; video.current?.pause(); setTurned(value => !value); };
  const style = { "--photo-ratio": `${note.width} / ${note.height}`, "--scrap-tilt": `${[-2, 1.6, -.7, 2.2][index % 4]}deg` } as CSSProperties;
  return <article className={`wall-scrap${turned ? " is-turned" : ""}`} style={style}>
    <div className="wall-flipper">
      <div className="wall-face wall-front" aria-hidden={turned} inert={turned}>
        <span className="wall-tape" aria-hidden="true" />
        {scrap.video ? <div className="wall-video-front">
          <video ref={video} controls playsInline preload="none" poster={scrap.poster} aria-label={scrap.title}>
            <source src={scrap.src} type="video/mp4" />
          </video>
          <div className="wall-turn-label"><span className="wall-front-name">{scrap.title}</span><button ref={frontButton} className="wall-more" onClick={flip} aria-label={`Show details: ${scrap.title}`} aria-expanded={false}>…</button></div>
        </div> : <div className="wall-photo-front">
          <button className="wall-photo-button" onClick={() => open(scrap.src)} aria-label={`Enlarge photograph: ${scrap.title}`}>
            <img src={scrap.src} alt={scrap.title} width={note.width} height={note.height} loading={index < 3 ? "eager" : "lazy"} decoding="async" />
          </button>
          <div className="wall-turn-label"><button className="wall-front-name wall-name-button" onClick={() => open(scrap.src)}><PhotoName src={scrap.src} title={scrap.title} personIds={meta?.peopleIds} /></button><button ref={frontButton} className="wall-more" onClick={flip} aria-label={`Show details: ${scrap.title}`} aria-expanded={false}>…</button></div>
        </div>}
        {era && <p className="wall-photo-era">{era}</p>}
      </div>
      <div className="wall-face wall-back" aria-hidden={!turned} inert={!turned}>
        <button ref={backButton} className="wall-return" onClick={flip} aria-label={`Show photograph: ${scrap.title}`} aria-expanded={true}>
          <span className="wall-note-title">{scrap.title}</span>
          <span className="wall-note-message">{note.message}</span>
          {scrap.credit && <span className="wall-photo-credit">Shared by {scrap.credit}</span>}
          <span className="wall-note-details">
            {note.people && <span><span className="wall-detail-label">people</span><span className="wall-detail-value">{note.people}</span></span>}
            <span><span className="wall-detail-label">date</span><span className="wall-detail-value">{note.date || <span className="wall-blank" aria-label="Date not yet added">&nbsp;</span>}</span></span>
            <span><span className="wall-detail-label">location</span><span className="wall-detail-value">{note.location || <span className="wall-blank" aria-label="Location not yet added">&nbsp;</span>}</span></span>
          </span>
        </button>
      </div>
    </div>
  </article>;
}

function Lightbox({ photos, index, change, close, startPlaying = false }: { photos: Scrap[]; index: number; change: (index: number) => void; close: () => void; startPlaying?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [playing, setPlaying] = useState(startPlaying && photos.length > 1);
  const [readySrc, setReadySrc] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const photo = photos[index];
  const note = photo.note || photoNotes[photo.src];
  const age = ageLabel((photo.meta || mediaMetadata[photo.src])?.takenOn, initialMemorial.birth, initialMemorial.death);
  const previous = () => change((index - 1 + photos.length) % photos.length);
  const next = () => change((index + 1) % photos.length);
  useEffect(() => {
    if (!playing || photos.length < 2 || readySrc !== photo.src) return;
    const timer = window.setTimeout(() => change((index + 1) % photos.length), 5000);
    return () => window.clearTimeout(timer);
  }, [playing, index, photos.length, readySrc, photo.src, change]);
  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);
  useEffect(() => {
    const element = dialog.current!;
    const focused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (focused?.isConnected) focused.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={dialog} className="wall-lightbox" aria-labelledby="wall-lightbox-title"
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === event.currentTarget) close(); }}
    onKeyDown={event => {
      if (event.key === "ArrowRight") { event.preventDefault(); next(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
    }}>
    <div className="lightbox-toolbar"><span aria-live={playing ? "off" : "polite"}>{index + 1} / {photos.length}</span><div className="lightbox-actions"><button className="lightbox-play" onClick={() => setPlaying(value => !value)} disabled={photos.length < 2} aria-label={playing ? "Pause slideshow" : "Play slideshow"} title={playing ? "Pause slideshow" : "Play slideshow"}>{playing ? <Pause size={22} aria-hidden="true" /> : <Play size={22} aria-hidden="true" />}</button><button className="lightbox-close" onClick={close} aria-label="Close photograph" autoFocus>×</button></div></div>
    <div className="lightbox-stage" onClick={event => { if (event.target === event.currentTarget) close(); }}
      onTouchStart={event => { touchStart.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }}
      onTouchMove={event => { if (event.touches.length > 1) touchStart.current = null; }}
      onTouchEnd={event => {
        const start = touchStart.current; touchStart.current = null;
        if (!start || !event.changedTouches.length || (window.visualViewport?.scale || 1) > 1) return;
        const dx = event.changedTouches[0].clientX - start.x;
        const dy = event.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0) next(); else previous(); }
      }}>
      <img key={photo.src} className={`lightbox-photograph${readySrc === photo.src ? " is-ready" : ""}`} src={photo.src} alt={photo.title} draggable={false} onLoad={() => setReadySrc(photo.src)} onError={() => setReadySrc(photo.src)} />
    </div>
    <div className="lightbox-caption">
      {photos.length > 1 && <button className="lightbox-nav" onClick={previous} aria-label="Previous photograph">‹</button>}
      <div aria-live={playing ? "off" : "polite"}><h2 id="wall-lightbox-title"><PhotoName src={photo.src} title={photo.title} personIds={photo.meta?.peopleIds} /></h2>{(note?.date || note?.location) && <p>{[note.date, age, note.location].filter(Boolean).join(" · ")}</p>}{note?.message && <p className="lightbox-memory">{note.message}</p>}{photo.credit && <p>Shared by {photo.credit}</p>}</div>
      {photos.length > 1 && <button className="lightbox-nav" onClick={next} aria-label="Next photograph">›</button>}
    </div>
  </dialog>;
}

function columnsForViewport() {
  const width = window.innerWidth;
  return width <= 360 ? 1 : width <= 1000 ? 2 : width >= 1600 ? 4 : 3;
}

export default function PhotoWall() {
  const [columnCount, setColumnCount] = useState(columnsForViewport);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [autoplayLightbox, setAutoplayLightbox] = useState(false);
  const [headerPhotoOpen, setHeaderPhotoOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters });
  const [notes, setNotes] = useState<WallNote[]>([]);
  const [composing, setComposing] = useState(false);
  const [noteStatus, setNoteStatus] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notesError, setNotesError] = useState(false);
  const [catalog, setCatalog] = useState<MemoryCatalog>({ people, places });
  useEffect(() => { const controller = new AbortController(); void fetch("/api/catalog", { signal: controller.signal }).then(response => { if (!response.ok) throw new Error(); return response.json() as Promise<MemoryCatalog>; }).then(result => { if (!controller.signal.aborted) setCatalog(result); }).catch(() => {}); return () => controller.abort(); }, []);
  const notesGeneration = useRef(0);
  const query = new URLSearchParams(Object.fromEntries(Object.entries({ kind: filters.kind, year: filters.year, from: filters.from, to: filters.to }).filter(([, value]) => value)));
  filters.people.forEach(id => query.append("person", id)); filters.places.forEach(id => query.append("place", id));
  const dateQuery = query.toString();
  async function loadNotes(nextPage: number, signal?: AbortSignal, replace = false) {
    const generation = ++notesGeneration.current;
    if (!filterBounds({ year: filters.year === "unknown" ? "" : filters.year, from: filters.from, to: filters.to })) { setNotes([]); setHasMore(false); setNotesError(false); setLoadingNotes(false); return; }
    setLoadingNotes(true); setNotesError(false);
    try {
      const response = await fetch(`/api/notes?page=${nextPage}&${dateQuery}`, { signal });
      if (!response.ok) throw new Error("unavailable");
      const result = await response.json() as { notes: WallNote[]; hasMore: boolean };
      if (signal?.aborted || generation !== notesGeneration.current) return;
      setNotes(current => [...new Map([...(replace ? [] : current), ...result.notes].map((note: WallNote) => [note.id, note])).values()]);
      setHasMore(result.hasMore); setPage(nextPage);
    } catch { if (!signal?.aborted && generation === notesGeneration.current) setNotesError(true); }
    finally { if (!signal?.aborted && generation === notesGeneration.current) setLoadingNotes(false); }
  }
  useEffect(() => {
    const controller = new AbortController(); setPage(0); setHasMore(false);
    void loadNotes(0, controller.signal, true); return () => { notesGeneration.current++; controller.abort(); };
  }, [dateQuery]);
  useEffect(() => {
    const queries = ["(max-width: 360px)", "(max-width: 1000px)", "(min-width: 1600px)"].map(query => window.matchMedia(query));
    const updateColumns = () => setColumnCount(columnsForViewport());
    queries.forEach(query => query.addEventListener("change", updateColumns));
    return () => queries.forEach(query => query.removeEventListener("change", updateColumns));
  }, []);
  const photos: Scrap[] = initialMemorial.photos.map(src => ({ src, title: photoCaption(src) }));
  const videos: Scrap[] = (initialMemorial.videos || []).map(v => ({ src: v.src, title: v.title, poster: v.poster, video: true }));
  const contributedPhotos: Scrap[] = notes.filter(note => note.photo).map(note => {
    const p = note.photo!;
    const title = p.caption || p.people.map(person => person.label).join(", ") || `A photograph shared by ${note.name}`;
    return { src: p.src, title, credit: note.name, note: { message: note.body, people: p.people.map(person => person.label).join(", "), date: formatMemoryDate(p.takenOn), location: p.place?.label || "", width: p.width, height: p.height }, meta: { id: note.id, kind: "photo", caption: title, message: note.body, width: p.width, height: p.height, takenOn: p.takenOn, peopleIds: p.people.map(person => person.id), placeId: p.place?.id } };
  });
  // The event photograph opens the wall; each photograph appears once.
  const first = photos.find(photo => photo.src === initialMemorial.portrait);
  const scraps = [...(first ? [first] : []), ...contributedPhotos, ...photos.filter(photo => photo !== first), ...videos];
  const visibleScraps = scraps.filter(scrap => {
    const media = scrap.meta || mediaMetadata[scrap.src] || { id: scrap.src, kind: scrap.video ? "video" as const : "photo" as const, caption: scrap.title, message: "", peopleIds: [], width: 4, height: 3 };
    return mediaMatches(media, filters, catalog.places);
  });
  const lightboxPhotos = visibleScraps.filter(scrap => !scrap.video);
  const openPhoto = (src: string) => { setAutoplayLightbox(false); setLightboxIndex(lightboxPhotos.findIndex(photo => photo.src === src)); };
  // Real flex columns avoid fragmenting transformed cards across CSS columns on iOS.
  type WallItem = { key: string; scrap: Scrap } | { key: string; note: WallNote };
  const photoItems: WallItem[] = visibleScraps.map(scrap => ({ key: scrap.src, scrap }));
  const notesVisible = (filters.kind === "all" || filters.kind === "note") && !filters.people.length && !filters.places.length;
  const visibleNotes = notesVisible ? [...firstWallNotes, ...notes.filter(note => !note.photo)].filter(note => dateMatches(note.createdAt ? { value: postedDay(note.createdAt), precision: "day", source: "family" } : undefined, filters)) : [];
  const birthYear = Number(initialMemorial.birth.slice(0, 4));
  const latestYear = Math.max(Number(initialMemorial.death.slice(0, 4)) || 0, ...Object.values(mediaMetadata).map(media => Number(media.takenOn?.value.slice(0, 4)) || 0), ...notes.map(note => Number(postedDay(note.createdAt).slice(0, 4))));
  const years = Number.isInteger(birthYear) && birthYear > 0 && latestYear >= birthYear && latestYear - birthYear < 200 ? Array.from({ length: latestYear - birthYear + 1 }, (_, index) => birthYear + index) : [...new Set(Object.values(mediaMetadata).map(media => Number(media.takenOn?.value.slice(0, 4))).filter(Boolean))].sort();
  const items: WallItem[] = [...photoItems.slice(0, 1), ...visibleNotes.map(note => ({ key: note.id, note })), ...photoItems.slice(1)];
  const columns = Array.from({ length: columnCount }, (_, column) =>
    items.map((item, index) => ({ item, index })).filter(item => item.index % columnCount === column));
  return <main className="photo-wall">
    <header className="wall-header">
      <div className="wall-identity">
        {headerPhotograph && <button className="wall-header-print" onClick={() => setHeaderPhotoOpen(true)} aria-label={`Enlarge header photograph: ${headerPhotograph.title}`}><span><img src={headerPhotograph.src} alt={headerPhotograph.title} decoding="async" /></span></button>}
        <div>
        <h1>{initialMemorial.name}</h1>
        <div className="wall-life-dates">
          {initialMemorial.birth && <p><time dateTime={initialMemorial.birth}>{formatDate(initialMemorial.birth)}</time></p>}
          {initialMemorial.death && <p><time dateTime={initialMemorial.death}>{formatDate(initialMemorial.death)}</time></p>}
        </div>
        </div>
      </div>
      <WallFilters catalog={catalog} value={filters} years={years} share={() => setComposing(true)} canPlay={lightboxPhotos.length > 1} play={() => { setAutoplayLightbox(true); setLightboxIndex(0); }} change={value => { setLightboxIndex(null); setFilters(value); }} />
    </header>
    <div className="wall-filter-status" role="status">{hasFilters(filters) && <>{items.length} {items.length === 1 ? "memory" : "memories"}{hasMore && notesVisible ? " loaded" : ""}</>}</div>
    {filters.year !== "unknown" && !filterBounds(filters) && <p className="wall-filter-error">Choose an end date on or after the start date, within the selected year.</p>}
    <p className="note-announcement" role="status">{noteStatus}</p>
    <section className="wall-grid" style={{ "--wall-columns": columnCount } as CSSProperties} aria-label={`Photographs and memories of ${initialMemorial.name}`}>
      {columns.map((column, index) => <div className="wall-column" key={index}>
        {column.map(({ item, index }) => "scrap" in item ? <Photo key={item.key} scrap={item.scrap} index={index} open={openPhoto} /> : <WrittenNote key={item.key} note={item.note} />)}
      </div>)}
    </section>
    {items.length === 0 && !loadingNotes && <div className="wall-empty"><p>No memories match these filters.</p><button onClick={() => setFilters({ ...emptyFilters })}>Show everything</button></div>}
    {(hasMore || notesError) && <div className="wall-notes-more">{notesError && <p>Memories couldn’t be loaded.</p>}<button disabled={loadingNotes} onClick={() => void loadNotes(notesError ? page : page + 1)}>{loadingNotes ? "Loading…" : notesError ? "Try again" : "More memories"}</button></div>}
    <SiteFooter />
    {lightboxIndex !== null && <Lightbox photos={lightboxPhotos} index={lightboxIndex} change={setLightboxIndex} startPlaying={autoplayLightbox} close={() => setLightboxIndex(null)} />}
    {headerPhotoOpen && headerPhotograph && <Lightbox photos={[headerPhotograph]} index={0} change={() => {}} close={() => setHeaderPhotoOpen(false)} />}
    {composing && <LeaveNote catalog={catalog} close={() => setComposing(false)} submitted={() => { setComposing(false); setNoteStatus("Your memory has been sent to the family for approval."); }} />}
  </main>;
}
