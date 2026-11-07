import { mediaMetadata } from "./photoWallData.ts";

export type Memory = { id: string; author: string; text: string };
export type MemorialVideo = { src: string; poster: string; title: string };
export type Memorial = {
  id: string; name: string; birth: string; death: string; subtitle: string;
  quote: string; attribution: string; story: string; service: string;
  portrait: string; photos: string[]; videos?: MemorialVideo[]; familyMediaVersion?: number; memories: Memory[]; theme: "olive" | "clay" | "blue";
};

export const familyPhotos: string[] = [];
const bundledImages = new Set<string>(familyPhotos);
const bundledVideos = new Set<string>();
export function photoCaption(_source: string) { return "a moment to keep"; }

export const initialMemorial: Memorial = {
  id: "memorial", name: "Someone you love", birth: "", death: "",
  subtitle: "Forever loved. Always remembered.", quote: "", attribution: "", story: "", service: "",
  portrait: "", photos: [], videos: [], memories: [], theme: "olive",
};

export function formatDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function validDate(value: unknown): value is string {
  if (value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validImage(value: unknown): value is string {
  return typeof value === "string" && value.length <= 3_000_000 && (value === "" || bundledImages.has(value) || /^data:image\/(jpeg|png|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(value));
}
function validVideo(value: unknown): value is MemorialVideo {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.src === "string" && v.src.length <= 48_000_000
    && (bundledVideos.has(v.src) || /^data:video\/mp4;base64,[a-zA-Z0-9+/=]+$/.test(v.src))
    && validImage(v.poster) && typeof v.title === "string" && v.title.length <= 180;
}

/** Add newly supplied family media once without replacing an existing edit. */
export function upgradeFamilyMedia(m: Memorial): Memorial { return m; }

/** Resolve only known local assets, so a backup or keepsake carries all its media. */
export async function preparePortableMemorial(m: Memorial, loadAsset: (path: string) => Promise<string>): Promise<Memorial> {
  const cache = new Map<string, Promise<string>>();
  const resolve = (path: string) => {
    if (!bundledImages.has(path) && !bundledVideos.has(path)) return Promise.resolve(path);
    if (!cache.has(path)) cache.set(path, loadAsset(path));
    return cache.get(path)!;
  };
  const portrait = await resolve(m.portrait);
  const photos = await Promise.all(m.photos.map(resolve));
  const videos = await Promise.all((m.videos || []).map(async v => ({ ...v, src: await resolve(v.src), poster: await resolve(v.poster) })));
  const result = { ...m, portrait, photos, videos };
  if (!isMemorial(result)) throw new Error("A memorial asset could not be prepared.");
  return result;
}

export function isMemorial(value: unknown): value is Memorial {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return ["id", "name", "subtitle", "quote", "attribution", "story", "service"].every(key => typeof v[key] === "string" && (v[key] as string).length <= 12000)
    && Boolean((v.name as string).trim()) && validDate(v.birth) && validDate(v.death) && (!v.birth || !v.death || v.birth <= v.death)
    && (v.videos === undefined || (Array.isArray(v.videos) && v.videos.length <= 3 && v.videos.every(validVideo)))
    && (v.familyMediaVersion === undefined || v.familyMediaVersion === 1 || v.familyMediaVersion === 2)
    && validImage(v.portrait) && ["olive", "clay", "blue"].includes(v.theme as string)
    && Array.isArray(v.photos) && v.photos.length <= 12 && v.photos.every(validImage)
    && Array.isArray(v.memories) && v.memories.length <= 500 && v.memories.every(x => x && typeof x.id === "string" && typeof x.author === "string" && x.author.length <= 100 && typeof x.text === "string" && x.text.length <= 4000);
}

export function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** A self-contained, script-free keepsake, with no network requests or trackers. */
export function createExport(m: Memorial, handwritingFont = "") {
  if ([m.portrait, ...m.photos, ...(m.videos || []).flatMap(v => [v.src, v.poster])].some(x => bundledImages.has(x) || bundledVideos.has(x))) {
    throw new Error("Prepare the memorial media before creating an offline export.");
  }
  const e = escapeHtml;
  const fontFace = /^[a-zA-Z0-9+/=]+$/.test(handwritingFont) ? `@font-face{font-family:Caveat;src:url(data:font/ttf;base64,${handwritingFont}) format('truetype');font-weight:400 700;font-display:swap}` : "";
  const color = { olive: "#515c45", clay: "#8c5544", blue: "#496775" }[m.theme];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; media-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Remembering ${e(m.name)}</title><style>*{box-sizing:border-box}body{margin:0;background:#faf8f3;color:#343b32;font:17px/1.8 Georgia,serif}main{max-width:860px;padding:80px 26px;margin:auto}header{text-align:center;margin-bottom:64px}h1{font-weight:400;font-size:clamp(42px,8vw,72px);line-height:1.12;margin:20px 0}h2{font-weight:400;font-size:30px;margin-top:55px}.eyebrow{font:11px Arial,sans-serif;letter-spacing:3px;text-transform:uppercase;color:${color}}.dates{font-size:16px;color:#697060}.portrait{width:220px;height:280px;object-fit:cover;object-position:center;border-radius:120px 120px 3px 3px;margin-bottom:24px}blockquote{font-style:italic;font-size:27px;line-height:1.5;margin:45px 0 14px;border-left:2px solid ${color};padding-left:25px}cite{font-size:15px;color:#697060}.story,.service,.memory p{white-space:pre-wrap}.gallery{columns:2;column-gap:16px}.gallery img{width:100%;margin:0 0 16px;border-radius:4px}.memory{break-inside:avoid;border-top:1px solid #dcded5;padding:22px 0}.memory p{margin:0 0 8px}.memory span{font-size:14px;color:#697060}footer{text-align:center;border-top:1px solid #dcded5;margin-top:60px;padding-top:25px;color:#697060;font-size:13px}@media print{main{padding:20px}header{break-inside:avoid}.gallery img{break-inside:avoid}}@media(max-width:480px){main{padding:40px 22px}.gallery{columns:1}}${fontFace}body{background:#f5f0e6;color:#67563f}main{max-width:860px;padding-top:65px}header{margin-bottom:35px}h1{font-family:Caveat,'Bradley Hand','Segoe Print',cursive;font-size:clamp(48px,10vw,88px);letter-spacing:-2px;font-weight:500}.eyebrow,.dates{font-family:ui-monospace,'Courier New',monospace}.eyebrow{font-size:9px;letter-spacing:2px}.dates{font-size:11px;color:#988367}header>p:last-child{font-style:italic;color:#988367;font-size:15px}.portrait{border-radius:0;width:280px;height:auto;max-height:none;object-fit:contain;border:13px solid #fffaf2;border-bottom-width:42px;box-shadow:3px 5px 14px #6b563326;transform:rotate(-4deg);margin-top:25px;margin-bottom:30px}blockquote{position:relative;background:repeating-linear-gradient(transparent 0,transparent 31px,#b6b09826 31px,#b6b09826 32px),#fff9e7;max-width:450px;padding:35px 35px 45px;border:0;box-shadow:2px 5px 10px #6b563318;transform:rotate(2deg);font-family:Caveat,'Bradley Hand','Segoe Print',cursive;font-size:35px;font-style:normal;line-height:1.15;margin:45px auto 20px}blockquote:before{content:'';position:absolute;left:40%;top:-12px;width:95px;height:26px;background:#d9c69d70;transform:rotate(-4deg)}cite{display:block;text-align:right;max-width:450px;margin:0 auto 60px;font-family:Caveat,'Bradley Hand',cursive;font-size:24px;color:#a28365}h2{font-family:Caveat,'Bradley Hand','Segoe Print',cursive;font-size:40px;font-weight:500;margin-bottom:18px}.story,.service{font-size:17px;line-height:2;color:#89785d}.gallery{column-gap:24px;padding:15px}.gallery img{border:10px solid #fffaf2;border-bottom-width:30px;box-shadow:2px 4px 10px #6b56331a;border-radius:0;transform:rotate(-2deg);margin-bottom:28px}.gallery img:nth-child(2n){transform:rotate(2deg)}.memory{border:0;background:#fff9e9;padding:25px 30px;margin-bottom:25px;box-shadow:2px 4px 8px #6b563314;transform:rotate(-1deg)}.memory:nth-child(2n){background:#eee4cd;transform:rotate(1deg)}.memory p{font-family:Caveat,'Bradley Hand','Segoe Print',cursive;font-size:29px;line-height:1.3}.memory span{font-family:Caveat,'Bradley Hand',cursive;font-size:23px;color:#ac8869}footer{border-top:1px dashed #d2c2a5;font-family:Caveat,'Bradley Hand',cursive;font-size:21px;color:#ab9371}@media print{body{background:white}.portrait,.memory,blockquote{break-inside:avoid}main{padding:20px}}.video-keepsake{max-width:460px;padding:14px;background:#fffaf2;box-shadow:2px 5px 12px #6b56331a;margin:25px auto}.video-keepsake video{display:block;width:100%;max-height:600px;background:#25231d}.video-keepsake figcaption{font-family:Caveat,Georgia,serif;text-align:center;font-size:26px;padding:12px 0 5px}@media print{.video-keepsake{display:none}}</style></head><body><main><header>${m.portrait && validImage(m.portrait) ? `<img class="portrait" src="${m.portrait}" alt="${e(m.name)}">` : ""}<p class="eyebrow">In loving memory</p><h1>${e(m.name)}</h1><p class="dates">${e(formatDate(m.birth))}${m.birth && m.death ? " — " : ""}${e(formatDate(m.death))}</p><p>${e(m.subtitle)}</p></header>${m.quote ? `<blockquote>${e(m.quote)}</blockquote><cite>${e(m.attribution)}</cite>` : ""}${m.story ? `<h2>Remembering ${e(m.name.split(" ")[0])}</h2><p class="story">${e(m.story)}</p>` : ""}${m.photos.length ? `<h2>A life in photographs</h2><div class="gallery">${m.photos.filter(validImage).map((photo, i) => `<img src="${photo}" alt="Remembering ${e(m.name)}, photograph ${i + 1}">`).join("")}</div>` : ""}${(m.videos || []).length ? `<h2>A moment in motion</h2>${(m.videos || []).filter(validVideo).map(v => `<figure class="video-keepsake"><video controls playsinline preload="none"${v.poster ? ` poster="${v.poster}"` : ""} aria-label="${e(v.title)}"><source src="${v.src}" type="video/mp4">Your browser cannot play this video.</video><figcaption>${e(v.title)}</figcaption></figure>`).join("")}` : ""}${m.memories.length ? `<h2>Memories, held close</h2>${m.memories.map(x => `<article class="memory"><p>${e(x.text)}</p><span>${e(x.author)}</span></article>`).join("")}` : ""}${m.service ? `<h2>Gathering together</h2><p class="service">${e(m.service)}</p>` : ""}<footer>${e(m.name)} · Forever loved.</footer></main></body></html>`;
}
