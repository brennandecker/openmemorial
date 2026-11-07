import type { MediaMetadata, Person, Place } from "./memoryMetadata.ts";
export const headerPhotograph: { src: string; title: string } | null = null;
export const people: Record<string, Person> = {};
export const places: Record<string, Place> = {};
export const mediaMetadata: Record<string, MediaMetadata> = {};
export type PhotoNote = { message: string; date: string; location: string; people?: string; width: number; height: number };
export const photoNotes: Record<string, PhotoNote> = {};
