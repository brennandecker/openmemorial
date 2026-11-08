import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { stableId } from "./core.mjs";
const literal = (value) =>
  JSON.stringify(value, null, 2)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
export async function preparePhotos(photos, baseDirectory) {
  const prepared = [];
  for (const photo of photos) {
    const source = path.resolve(baseDirectory, photo.file);
    const bytes = await readFile(source);
    if (bytes.length > 20 * 1024 * 1024)
      throw new Error("Choose photographs up to 20 MB each.");
    const image = sharp(bytes, {
      limitInputPixels: 40_000_000,
      animated: false,
    });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp", "heif"].includes(metadata.format))
      throw new Error(
        "Choose JPEG, PNG, or WebP photos. Convert HEIC to JPEG first if your system cannot read it.",
      );
    let result;
    try {
      result = await image
        .rotate()
        .resize({
          width: 2560,
          height: 2560,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 88 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new Error(
        "This image could not be prepared. Convert it to JPEG and retry.",
      );
    }
    if (result.data.length > 2 * 1024 * 1024)
      result = await sharp(bytes, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer({ resolveWithObject: true });
    if (result.data.length > 2 * 1024 * 1024)
      throw new Error(
        "This display copy is still too large. Choose a smaller photograph.",
      );
    // Sharp removes EXIF, XMP, IPTC and comments by default; keep only the normalized JPEG.
    const id = createHash("sha256")
      .update(result.data)
      .digest("hex")
      .slice(0, 24);
    prepared.push({
      ...photo,
      id,
      src: `/memories/${id}.jpg`,
      width: result.info.width,
      height: result.info.height,
      bytes: result.data,
    });
  }
  if (new Set(prepared.map((photo) => photo.id)).size !== prepared.length)
    throw new Error(
      "The same photograph was added more than once. Please remove the duplicate.",
    );
  return prepared;
}
export async function applyContent(root, answers, photos, state = {}) {
  const people = {},
    places = {},
    metadata = {};
  for (const photo of photos) {
    const peopleIds = photo.people.map((name) => {
      const id = stableId("person", name);
      people[id] = { id, name };
      return id;
    });
    const label = [photo.city, photo.state, photo.country]
      .filter(Boolean)
      .join(", ");
    const placeId = label
      ? stableId(
          "place",
          JSON.stringify([photo.city, photo.state, photo.country]),
        )
      : undefined;
    if (placeId)
      places[placeId] = {
        id: placeId,
        label,
        ...(photo.city ? { city: photo.city } : {}),
        ...(photo.state ? { state: photo.state } : {}),
        ...(photo.country ? { country: photo.country } : {}),
      };
    metadata[photo.src] = {
      id: photo.id,
      kind: "photo",
      caption: photo.caption,
      message: photo.message,
      width: photo.width,
      height: photo.height,
      peopleIds,
      ...(placeId ? { placeId } : {}),
      ...(photo.date
        ? {
            takenOn: {
              value: photo.date,
              precision:
                photo.date.length === 4
                  ? "year"
                  : photo.date.length === 7
                    ? "month"
                    : "day",
              source: photo.dateSource,
            },
          }
        : {}),
    };
  }
  const header = answers.portrait === null ? null : photos[answers.portrait];
  const data = `import { formatMemoryDate, type MediaMetadata, type Person, type Place } from "./memoryMetadata.ts";\nexport const headerPhotograph: {src:string;title:string} | null = ${literal(header ? { src: header.src, title: answers.name } : null)};\nexport const people: Record<string,Person> = ${literal(people)};\nexport const places: Record<string,Place> = ${literal(places)};\nexport const mediaMetadata: Record<string,MediaMetadata> = ${literal(metadata)};\nexport type PhotoNote = {message:string;date:string;location:string;people?:string;width:number;height:number};\nexport const photoNotes: Record<string,PhotoNote> = Object.fromEntries(Object.entries(mediaMetadata).map(([src,m])=>[src,{message:m.message,date:formatMemoryDate(m.takenOn),location:m.placeId?places[m.placeId]?.label || "":"",width:m.width,height:m.height}]));\n`;
  let memorial = await readFile(path.join(root, "src/memorial.ts"), "utf8");
  const start = memorial.indexOf("export const familyPhotos"),
    end = memorial.indexOf("\nexport function formatDate", start);
  if (start < 0 || end < 0)
    throw new Error(
      "The source layout changed. Ask your assistant to reconcile memorial.ts before running setup.",
    );
  const photoPaths = photos.map((p) => p.src),
    profile = {
      id: answers.workerName,
      name: answers.name,
      birth: answers.birth,
      death: answers.death,
      subtitle: "",
      quote: "",
      attribution: "",
      story: "",
      service: "",
      portrait: header?.src || photoPaths[0] || "",
      photos: photoPaths,
      videos: [],
      memories: [],
      theme: "olive",
    };
  memorial =
    memorial.slice(0, start) +
    `export const familyPhotos: string[] = ${literal(photoPaths)};\nconst bundledImages = new Set<string>(familyPhotos);\nconst bundledVideos = new Set<string>();\nexport function photoCaption(source: string) { return mediaMetadata[source]?.caption || "A moment to remember"; }\nexport const initialMemorial: Memorial = ${literal(profile)};\n` +
    memorial.slice(end);
  const wallSettings = (
    await readFile(path.join(root, "src/wallSettings.ts"), "utf8")
  ).replace(
    /export const wallTimeZone = "[^"]*";/,
    `export const wallTimeZone = ${literal(answers.timeZone)};`,
  );
  const escaped = (value) =>
    value.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const title = escaped(answers.name + " — Forever loved");
  const origin = state.hostname ? `https://${state.hostname}` : "";
  const index = `<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="theme-color" content="#f5f0e6"/><title>${title}</title><meta name="description" content="Photographs and memories, shared with love."/><meta property="og:title" content="${title}"/><meta property="og:type" content="website"/>${origin ? `<meta property="og:url" content="${origin}/"/>` : ""}${origin && header ? `<meta property="og:image" content="${origin}${header.src}"/>` : ""}</head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n`;
  const files = {
    "src/memorial.ts": memorial,
    "src/photoWallData.ts": data,
    "src/sitePolicy.ts": `export const privacyEmail = ${literal(answers.privacyEmail)};\nexport const policyUpdated = ${literal(new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date()))};\n`,
    "src/wallSettings.ts": wallSettings,
    "index.html": index,
  };
  const backup = path.join(
    root,
    ".openmemorial",
    "backups",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
  for (const [file, content] of Object.entries(files)) {
    const destination = path.join(root, file);
    await mkdir(path.dirname(path.join(backup, file)), {
      recursive: true,
      mode: 0o700,
    });
    await writeFile(path.join(backup, file), await readFile(destination), {
      mode: 0o600,
    });
    await writeFile(destination, content);
  }
  await mkdir(path.join(root, "public/memories"), { recursive: true });
  for (const photo of photos)
    await writeFile(path.join(root, "public", photo.src), photo.bytes);
  return { photographs: photos.length, backup };
}
