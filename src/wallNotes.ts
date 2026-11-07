import type { MemoryPhoto } from "./memoryPhoto";
export type WallNote = { id: string; name: string; body: string; createdAt: string; pinned: boolean; photo?: MemoryPhoto };
export const firstWallNotes: WallNote[] = [];
