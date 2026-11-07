import { initialMemorial, photoCaption } from "./memorial.ts";
import { mediaMetadata, people, places } from "./photoWallData.ts";
import { firstWallNotes } from "./wallNotes.ts";
import type { MemoryPhoto } from "./memoryPhoto.ts";
import type { WallNote } from "./wallNotes.ts";

export type CuratedItem = { id: string; kind: "photo" | "video" | "note"; name: string; body: string; createdAt: string; pinned: boolean; photo?: MemoryPhoto; poster?: string; hidden: boolean; version: number; updatedBy?: string; updatedAt?: string };
export type CuratedContent = Pick<CuratedItem, "name" | "body" | "photo">;
export function originalWall(): CuratedItem[] {
  const media = [...initialMemorial.photos.map(src => ({ src, title: photoCaption(src), kind: "photo" as const, poster: undefined as string | undefined })), ...(initialMemorial.videos || []).map(v => ({ ...v, kind: "video" as const }))];
  return [...media.map(item => {
    const meta = mediaMetadata[item.src];
    return { id: meta?.id || item.src.replace(/[^a-z0-9-]/gi, "-").slice(0,80), kind: item.kind, name: item.title, body: meta?.message || "", createdAt: "", pinned: false, poster: item.poster, hidden: false, version: 0,
      photo: { src: item.src, caption: item.title, width: meta?.width || 4, height: meta?.height || 3, takenOn: meta?.takenOn, people: (meta?.peopleIds || []).map(id => ({ id, label: [people[id]?.relationship, people[id]?.name].filter(Boolean).join(" ") })), place: meta?.placeId ? places[meta.placeId] : undefined } };
  }), ...firstWallNotes.map((note: WallNote) => ({ ...note, kind: "note" as const, hidden: false, version: 0 }))];
}
export async function curatedWall(env: Pick<CloudflareEnv,"NOTES">): Promise<CuratedItem[]> {
  const rows = await env.NOTES.prepare("SELECT id,content_json,hidden,version,updated_by,updated_at FROM wall_curated_edits").all<{ id: string; content_json: string; hidden: number; version: number; updated_by: string; updated_at: string }>();
  const edits = new Map(rows.results.map(row => [row.id,row]));
  return originalWall().map(item => { const row = edits.get(item.id); return row ? { ...item, ...JSON.parse(row.content_json) as CuratedContent, hidden: !!row.hidden, version: row.version, updatedBy: row.updated_by, updatedAt: row.updated_at } : item; });
}
export function publicCurated(items: CuratedItem[]) {
  return items.filter(item => !item.hidden).map(({ hidden: _hidden, version: _version, updatedBy: _by, updatedAt: _at, ...item }) => { if (!item.photo) return item; const { dateEvidence: _evidence, ...photo } = item.photo; return { ...item, photo }; });
}
