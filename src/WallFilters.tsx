import { Menu, MessageSquarePlus, Play, SlidersHorizontal, X } from "lucide-react";
import { ageRangeLabel, emptyFilters, hasFilters, type WallFilters as Filters } from "./memoryMetadata";
import { people, places } from "./photoWallData";
import { initialMemorial } from "./memorial";
import { useEffect, useRef, useState, type CSSProperties } from "react";

export function WallFilters({ value, change, years, share, play, canPlay }: { value: Filters; change: (filters: Filters) => void; years: number[]; share: () => void; play: () => void; canPlay: boolean }) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const menuToggle = useRef<HTMLElement>(null);
  const closeMenu = () => { if (menu.current) menu.current.open = false; menuToggle.current?.focus(); };
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false; };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && menu.current?.open) { event.preventDefault(); closeMenu(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  const active = hasFilters(value);
  const set = (patch: Partial<Filters>) => change({ ...value, ...patch });
  const minimum = years[0] || Number(initialMemorial.birth.slice(0, 4)) || 2000;
  const maximum = Math.max(minimum, Number(initialMemorial.death.slice(0, 4)) || years.at(-1) || minimum);
  const start = value.from ? Number(value.from.slice(0, 4)) : minimum;
  const end = value.to ? Number(value.to.slice(0, 4)) : maximum;
  const span = maximum - minimum || 1;
  const age = ageRangeLabel(`${start}-01-01`, `${end}-12-31`, initialMemorial.birth, initialMemorial.death);
  function setYears(from: number, to: number) {
    set({ year: "", from: from === minimum && to === maximum ? "" : `${from}-01-01`, to: from === minimum && to === maximum ? "" : `${to}-12-31` });
  }
  const toggle = (selected: string[], id: string) => selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id];
  return <>
    <details className="wall-menu" ref={menu}>
      <summary ref={menuToggle} aria-label="Wall menu" title="Menu"><Menu size={24} strokeWidth={1.5} aria-hidden="true" />{active && <span className="filter-active-dot" aria-hidden="true" />}</summary>
      <nav aria-label="Wall actions">
        <button onClick={() => { closeMenu(); share(); }}><MessageSquarePlus size={19} strokeWidth={1.5} aria-hidden="true" />Share a memory</button>
        <button onClick={() => { closeMenu(); play(); }} disabled={!canPlay} title={canPlay ? "Play the selected photos" : "Choose two or more photos for a slideshow"}><Play size={19} strokeWidth={1.5} aria-hidden="true" />Play slideshow</button>
        <button aria-expanded={open} aria-controls="wall-filter-panel" onClick={() => { closeMenu(); setOpen(value => !value); }}><SlidersHorizontal size={19} strokeWidth={1.5} aria-hidden="true" />Filter wall</button>
      </nav>
    </details>
    {open && <div className="wall-filter-panel" id="wall-filter-panel">
      <div className="wall-kind-filters" role="group" aria-label="Content type">
        {([['all', 'Everything'], ['photo', 'Photos'], ['video', 'Videos'], ['note', 'Notes']] as const).map(([kind, label]) => <button key={kind} aria-pressed={value.kind === kind} onClick={() => set({ kind })}>{label}</button>)}
        <button className="wall-close-filters" onClick={() => { setOpen(false); menuToggle.current?.focus(); }} aria-label="Close filters"><X size={18} aria-hidden="true" /></button>
      </div>
      <fieldset className="wall-year-filter">
        <legend>Years</legend>
        <div className="wall-year-readout"><output>{start === end ? start : `${start}–${end}`}{age && <span> · {age}</span>}</output><button onClick={() => set({ year: "", from: "", to: "" })} disabled={!value.from && !value.to && !value.year}>All years</button></div>
        <div className="wall-year-slider" style={{ "--year-start": `${(start - minimum) / span * 100}%`, "--year-end": `${(end - minimum) / span * 100}%` } as CSSProperties}>
          <div className="wall-year-track" aria-hidden="true" />
          <input className={start === maximum ? "year-lower at-end" : "year-lower"} type="range" min={minimum} max={maximum} step={1} value={start} aria-label="Start year" aria-valuetext={String(start)} onInput={event => setYears(Math.min(Number(event.currentTarget.value), end), end)} onChange={event => setYears(Math.min(Number(event.target.value), end), end)} />
          <input className="year-upper" type="range" min={minimum} max={maximum} step={1} value={end} aria-label="End year" aria-valuetext={String(end)} onInput={event => setYears(start, Math.max(Number(event.currentTarget.value), start))} onChange={event => setYears(start, Math.max(Number(event.target.value), start))} />
        </div>
        <div className="wall-year-endpoints" aria-hidden="true"><span>{minimum}</span><span>{maximum}</span></div>
      </fieldset>
      <div className="wall-checkbox-groups">
        <fieldset><legend>People</legend><div className="wall-checkbox-list">
          {Object.values(people).sort((a, b) => a.name.localeCompare(b.name)).map(person => <label key={person.id}><input type="checkbox" checked={value.people.includes(person.id)} onChange={() => set({ people: toggle(value.people, person.id) })} /><span>{person.relationship ? `${person.relationship} ` : ""}{person.name}</span></label>)}
        </div></fieldset>
        <fieldset><legend>Locations</legend><div className="wall-checkbox-list">
          {[...Object.values(places).sort((a, b) => a.label.localeCompare(b.label)), { id: "unknown", label: "Location unknown" }].map(place => <label key={place.id}><input type="checkbox" checked={value.places.includes(place.id)} onChange={() => set({ places: toggle(value.places, place.id) })} /><span>{place.label}</span></label>)}
        </div></fieldset>
      </div>
      {active && <div className="wall-filter-foot"><button onClick={() => change({ ...emptyFilters })}>Clear filters</button></div>}
    </div>}
  </>;
}
