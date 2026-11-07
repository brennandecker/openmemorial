import { useId } from "react";
import type { MemoryCatalog, PhotoDraft } from "./memoryPhoto";
import "./memory-upload.css";

export default function PhotoDetailsForm({ value, change, catalog, disabled = false }: { value: PhotoDraft; change: (value: PhotoDraft) => void; catalog: MemoryCatalog; disabled?: boolean }) {
  const id = useId(), [year = "", month = "", day = ""] = value.date.split("-");
  const set = (patch: Partial<PhotoDraft>) => change({ ...value, ...patch });
  const date = (y: string, m: string, d: string) => set({ date: y ? [y, ...(m ? [m, ...(d ? [d] : [])] : [])].join("-") : "", dateSource: "family" });
  return <fieldset className="photo-details-form" disabled={disabled}>
    <label htmlFor={`${id}-caption`}>Photo caption <span>(optional)</span></label>
    <input id={`${id}-caption`} maxLength={180} value={value.caption} onChange={event => set({ caption: event.target.value })} />
    <fieldset><legend>When was this? <span>(optional)</span></legend>
      <div className="photo-date-fields">
        <label>Year<input type="number" min="1" max="9999" placeholder="Year" value={year} onChange={event => date(event.target.value, month, day)} /></label>
        <label>Month<select value={month} disabled={!year} onChange={event => date(year, event.target.value, "")}><option value="">Unknown</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2000, i, 15)))}</option>)}</select></label>
        <label>Day<select value={day} disabled={!month || !year} onChange={event => date(year, month, event.target.value)}><option value="">Unknown</option>{Array.from({ length: year && month ? new Date(Number(year), Number(month), 0).getDate() : 31 }, (_, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{i + 1}</option>)}</select></label>
      </div>
      {value.dateSource === "camera" && value.date && <p className="photo-field-hint">Suggested from the photo. Please check the date.</p>}
      {value.date && <button type="button" className="photo-clear-date" onClick={() => date("", "", "")}>Clear date</button>}
    </fieldset>
    <fieldset><legend>Who’s pictured? <span>(optional)</span></legend><div className="photo-people-options">{Object.values(catalog.people).sort((a, b) => a.name.localeCompare(b.name)).map(person => <label key={person.id}><input type="checkbox" checked={value.peopleIds.includes(person.id)} onChange={() => set({ peopleIds: value.peopleIds.includes(person.id) ? value.peopleIds.filter(id => id !== person.id) : [...value.peopleIds, person.id] })} />{[person.relationship, person.name].filter(Boolean).join(" ")}</label>)}</div></fieldset>
    <label htmlFor={`${id}-people`}>Other names <span>(separate with commas)</span></label><input id={`${id}-people`} value={value.otherPeople} maxLength={600} onChange={event => set({ otherPeople: event.target.value })} />
    <label htmlFor={`${id}-place`}>Where was this? <span>(optional)</span></label>
    <select id={`${id}-place`} value={value.placeId} onChange={event => set({ placeId: event.target.value, location: "" })}><option value="">Another location / unknown</option>{Object.values(catalog.places).sort((a, b) => a.label.localeCompare(b.label)).map(place => <option key={place.id} value={place.id}>{place.label}</option>)}</select>
    {!value.placeId && <><label htmlFor={`${id}-location`}>City and state</label><input id={`${id}-location`} value={value.location} maxLength={120} onChange={event => set({ location: event.target.value })} /><p className="photo-field-hint">Please leave out home addresses.</p></>}
  </fieldset>;
}
