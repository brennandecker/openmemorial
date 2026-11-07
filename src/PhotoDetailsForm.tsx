import { useEffect, useId, useRef } from "react";
import { photoPersonEntries, type MemoryCatalog, type PhotoDraft } from "./memoryPhoto";
import "./memory-upload.css";

export default function PhotoDetailsForm({ value, change, catalog, disabled = false, showDate = true }: { value: PhotoDraft; change: (value: PhotoDraft) => void; catalog: MemoryCatalog; disabled?: boolean; showDate?: boolean }) {
  const id = useId(), peopleFields = useRef<HTMLDivElement>(null), focusPerson = useRef<number | null>(null);
  const set = (patch: Partial<PhotoDraft>) => change({ ...value, ...patch });
  const entries = photoPersonEntries(value, catalog), rows = entries.length ? entries : [{ name: "" }];
  useEffect(() => { if (focusPerson.current !== null) { peopleFields.current?.querySelectorAll<HTMLInputElement>("input")[focusPerson.current]?.focus(); focusPerson.current = null; } }, [value.personEntries]);
  const updatePeople = (personEntries: typeof rows) => set({ personEntries, peopleIds: [], otherPeople: "" });
  const savedLocation = !value.city && !value.state && !value.country ? catalog.places[value.placeId]?.label || value.location : "";
  return <fieldset className="photo-details-form" disabled={disabled}>
    <fieldset className="photo-person-fields"><legend>Names on the front <span>(optional)</span></legend><p className="photo-field-hint">Add each person in the order you want their name to appear. Choose an existing name or enter a new one.</p>
      <datalist id={`${id}-known-people`}>{Object.values(catalog.people).sort((a,b) => a.name.localeCompare(b.name)).map(person => <option key={person.id} value={[person.relationship, person.name].filter(Boolean).join(" ")} />)}</datalist>
      <div ref={peopleFields}>{rows.map((person, index) => <div className="photo-person-row" key={index}><label htmlFor={`${id}-person-${index}`}>Person {index + 1}</label><div><input id={`${id}-person-${index}`} list={`${id}-known-people`} placeholder="Name" maxLength={80} value={person.name} onChange={event => { const name = event.target.value, known = Object.values(catalog.people).find(p => [p.relationship, p.name].filter(Boolean).join(" ").toLocaleLowerCase("en-US") === name.trim().toLocaleLowerCase("en-US")); updatePeople(rows.map((p,i) => i === index ? { name, ...(known ? { id: known.id } : {}) } : p)); }} /><button type="button" aria-label={`Remove person ${index + 1}`} onClick={() => updatePeople(rows.filter((_,i) => i !== index))}>×</button></div></div>)}</div>
      <button className="photo-add-person" type="button" disabled={rows.length >= 20} onClick={() => { focusPerson.current = rows.length; updatePeople([...rows, { name: "" }]); }}>＋ Add person</button>
    </fieldset>
    {showDate && <fieldset><legend>When was this? <span>(optional)</span></legend><PhotoDateFields value={value.date} change={date => set({ date, dateSource: "family" })} />{value.dateSource === "camera" && value.date && <p className="photo-field-hint">Suggested from the photo. Please check the date.</p>}{value.date && <button type="button" className="photo-clear-date" onClick={() => set({ date: "", dateSource: "family" })}>Clear date</button>}</fieldset>}
    <fieldset className="photo-location-fields"><legend>Where was this? <span>(optional)</span></legend>
      {savedLocation && <p className="photo-saved-location">Saved location: {savedLocation} <button type="button" onClick={() => set({ placeId: "", location: "", city: "", state: "", country: "" })}>Clear</button></p>}
      {([['city','City'],['state','State / region'],['country','Country']] as const).map(([field,label]) => <label key={field} htmlFor={`${id}-${field}`}>{label} <span>(optional)</span><input id={`${id}-${field}`} maxLength={80} value={value[field] || ""} onChange={event => set({ [field]: event.target.value, placeId: "", location: "" })} /></label>)}
      <p className="photo-field-hint">These details appear on the back. Please leave out home addresses.</p>
    </fieldset>
  </fieldset>;
}

export function PhotoDateFields({ value, change }: { value: string; change: (value: string) => void }) {
  const [year = "", month = "", day = ""] = value.split("-");
  const date = (y: string, m: string, d: string) => change(y ? [y, ...(m ? [m, ...(d ? [d] : [])] : [])].join("-") : "");
  return (
      <div className="photo-date-fields">
        <label>Year<input type="number" min="1" max="9999" placeholder="Year" value={year} onChange={event => date(event.target.value, month, "")} /></label>
        <label>Month<select value={month} disabled={!year} onChange={event => date(year, event.target.value, "")}><option value="">Unknown</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2000, i, 15)))}</option>)}</select></label>
        <label>Day<select value={day} disabled={!month || !year} onChange={event => date(year, month, event.target.value)}><option value="">Unknown</option>{Array.from({ length: year && month ? new Date(Number(year), Number(month), 0).getDate() : 31 }, (_, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{i + 1}</option>)}</select></label>
      </div>
  );
}
