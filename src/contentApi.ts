import { curatedWall } from "./curatedWall.ts";
import { boundedBytes, validateNote } from "./notesApi.ts";
import { dateBounds } from "./memoryMetadata.ts";
import { memoryCatalog } from "./photoStorage.ts";
import { publicPhoto, readStoredPhoto, validatePhotoDraft, type MemoryPhoto } from "./memoryPhoto.ts";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };
const json = (value: unknown, status=200) => Response.json(value,{status,headers});
type Content = { name: string; body: string; photo?: MemoryPhoto | ReturnType<typeof readStoredPhoto> };
type ChangeRow = { id: string; reviewer: string; action: string; previousStatus: string; status: string; createdAt: string; before_json: string | null; after_json: string | null; detailsChanged: number };
function snapshot(value: string | null, kind: string, id: string) {
  if (!value) return undefined;
  const content = JSON.parse(value) as Content;
  return { name: content.name, body: content.body, ...(content.photo ? { photo: kind === "submission" && "key" in content.photo ? publicPhoto(content.photo,id,true) : content.photo } : {}) };
}
export async function contentResponse(request: Request, env: CloudflareEnv, reviewer: string): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/family/api/content/curated" && request.method === "GET") return json({ items: await curatedWall(env), reviewer });
  const match = /^\/family\/api\/content\/(curated|submission)\/([a-zA-Z0-9-]{1,80})(\/history)?$/.exec(url.pathname);
  if (!match) return json({error:"Not found."},404);
  const [,kind,id,history] = match;
  const item = kind === "curated" ? (await curatedWall(env)).find(item=>item.id===id) : await env.NOTES.prepare("SELECT name,COALESCE(memory_text,body) AS body,photo_json,review_version AS version,status,hidden FROM wall_notes WHERE id=?").bind(id).first<{name:string;body:string;photo_json:string|null;version:number;status:string;hidden:number}>();
  if (!item) return json({error:"Memory not found."},404);
  if (history) {
    if (request.method !== "GET") return json({error:"Method not allowed."},405);
    const page = Number(url.searchParams.get("page") || 0);
    if (!Number.isSafeInteger(page) || page<0 || page>10000) return json({error:"Invalid selection."},400);
    const changes = "SELECT id,reviewer,action,'' AS previousStatus,'' AS status,created_at AS createdAt,before_json,after_json,1 AS detailsChanged,rowid AS sequence FROM wall_content_changes WHERE item_kind=?1 AND item_id=?2";
    const reviews = "SELECT id,reviewer,action,previous_status AS previousStatus,status,created_at AS createdAt,NULL AS before_json,NULL AS after_json,(COALESCE(photo_before,'')!=COALESCE(photo_after,'')) AS detailsChanged,rowid AS sequence FROM wall_note_reviews WHERE note_id=?2";
    const rows = await env.NOTES.prepare(`SELECT * FROM (${changes}${kind === "submission" ? ` UNION ALL ${reviews}` : ""}) ORDER BY createdAt DESC,sequence DESC,id DESC LIMIT 31 OFFSET ?3`).bind(kind,id,page*30).all<ChangeRow>();
    return json({history:rows.results.slice(0,30).map(({before_json,after_json,...event})=>({...event,before:snapshot(before_json,kind,id),after:snapshot(after_json,kind,id)})),hasMore:rows.results.length>30});
  }
  if (request.method !== "POST") return json({error:"Method not allowed."},405);
  if (request.headers.get("Origin") !== url.origin || request.headers.get("Sec-Fetch-Site") === "cross-site") return json({error:"Please edit from this website."},403);
  if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json") return json({error:"Invalid request."},415);
  let input: { action?: string; version?: number; name?: unknown; body?: unknown; photo?: unknown; restoreId?: string };
  try { input=JSON.parse(new TextDecoder().decode(await boundedBytes(request,16384))); } catch { return json({error:"Invalid request."},400); }
  if (!input || !["edit",...(kind === "curated" ? ["hide","restore"] : [])].includes(input.action || "") || !Number.isSafeInteger(input.version) || input.version !== item.version) return json({error:"This memory has changed. Refresh before saving."},409);
  const before: Content = "photo_json" in item ? {name:item.name,body:item.body,photo:readStoredPhoto(item.photo_json)} : {name:item.name,body:item.body,photo:item.photo};
  let after: Content = before;
  if (input.action === "edit") {
    if (input.restoreId) {
      if (typeof input.restoreId !== "string" || input.restoreId.length>80) return json({error:"Invalid version."},400);
      const saved = await env.NOTES.prepare("SELECT before_json FROM wall_content_changes WHERE id=? AND item_kind=? AND item_id=? AND action='edit'").bind(input.restoreId,kind,id).first<{before_json:string}>();
      if (!saved) return json({error:"Previous version not found."},404);
      after=JSON.parse(saved.before_json) as Content;
    } else {
      const captionEdit=kind === "curated" && !!before.photo;
      const text=validateNote({name:captionEdit ? "Photograph" : input.name,body:input.body},!!before.photo);
      if (captionEdit && (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length>180 || /[\u0000-\u001f\u007f]/.test(input.name))) return json({error:"Please check the front caption."},400);
      if (text && captionEdit) text.name=(input.name as string).trim();
      if (!text) return json({error:"Add a name up to 80 characters and a note up to 1,000 characters."},400);
      let photo=before.photo;
      if (photo) {
        const catalog=await memoryCatalog(env);
        for (const p of photo.people) if (!catalog.people[p.id]) catalog.people[p.id]={id:p.id,name:p.label};
        if (photo.place && !catalog.places[photo.place.id]) catalog.places[photo.place.id]=photo.place;
        const details=await validatePhotoDraft(input.photo,catalog);
        if (!details) return json({error:"Please check the photo’s names, date, and location."},400);
        // Keep the original asset and capture evidence. Only editable details can change.
        const {caption:_caption,takenOn:_date,people:_people,place:_place,dateEvidence:_evidence,...asset}=photo;
        photo={...asset,...details,...(photo.dateEvidence ? {dateEvidence:photo.dateEvidence} : {})} as typeof photo;
      } else if (input.photo !== undefined) return json({error:"This memory has no photograph."},400);
      after={...text,...(photo ? {photo} : {})};
    }
  }
  const now=new Date().toISOString(), changeId=crypto.randomUUID(), action=input.action!;
  const hidden=action === "hide" ? 1 : action === "restore" ? 0 : Number(item.hidden);
  if (action !== "edit" && hidden === Number(item.hidden)) return json({error:"This memory has already changed."},409);
  const beforeJSON=JSON.stringify(before),afterJSON=JSON.stringify(after);
  const statements: D1PreparedStatement[]=[];
  if (kind === "curated") {
    statements.push(env.NOTES.prepare("INSERT INTO wall_curated_edits(id,content_json,hidden,version,updated_by,updated_at,last_change_id) VALUES(?1,?2,?3,1,?4,?5,?6) ON CONFLICT(id) DO UPDATE SET content_json=excluded.content_json,hidden=excluded.hidden,version=wall_curated_edits.version+1,updated_by=excluded.updated_by,updated_at=excluded.updated_at,last_change_id=excluded.last_change_id WHERE wall_curated_edits.version=?7 RETURNING id").bind(id,afterJSON,hidden,reviewer,now,changeId,item.version));
    statements.push(env.NOTES.prepare("INSERT INTO wall_content_changes(id,item_kind,item_id,reviewer,action,before_json,after_json,created_at) SELECT ?1,'curated',id,?2,?3,?4,?5,?6 FROM wall_curated_edits WHERE id=?7 AND last_change_id=?1").bind(changeId,reviewer,action,beforeJSON,afterJSON,now,id));
  } else {
    const bounds=dateBounds(after.photo?.takenOn);
    statements.push(env.NOTES.prepare("UPDATE wall_notes SET name=?1,body=?2,memory_text=?3,photo_json=?4,photo_from=?5,photo_to=?6,review_version=review_version+1,reviewed_by=?7,reviewed_at=?8,last_review_id=?9 WHERE id=?10 AND review_version=?11 RETURNING id").bind(after.name,after.body || "Photograph",after.body,after.photo ? JSON.stringify(after.photo) : null,bounds?.from || null,bounds?.to || null,reviewer,now,changeId,id,item.version));
    statements.push(env.NOTES.prepare("INSERT INTO wall_content_changes(id,item_kind,item_id,reviewer,action,before_json,after_json,created_at) SELECT ?1,'submission',id,?2,'edit',?3,?4,?5 FROM wall_notes WHERE id=?6 AND last_review_id=?1").bind(changeId,reviewer,beforeJSON,afterJSON,now,id));
  }
  const [updated]=await env.NOTES.batch(statements);
  return updated.results.length ? json({saved:true}) : json({error:"Another family member changed this memory. Refresh to continue."},409);
}
