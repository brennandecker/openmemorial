import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFile } from "node:fs/promises";
import exifr from "exifr";
import { cameraDateFromMetadata } from "../src/photoDateChoice.ts";
import { readJSON, saveJSON, validateAnswers, slug } from "./setup/core.mjs";
import { preparePhotos, applyContent } from "./setup/content.mjs";
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(
      "npm run setup\nnpm run setup -- --answers path/to/answers.json\nLocal-only: prepares public content and private setup settings. Does not publish or change Cloudflare.",
    );
    return;
  }
  const position = args.indexOf("--answers");
  let input,
    base = root;
  if (position >= 0) {
    if (!args[position + 1])
      throw new Error("Add the path to your answers JSON.");
    const file = path.resolve(args[position + 1]);
    input = await readJSON(file);
    base = path.dirname(file);
  } else {
    if (!process.stdin.isTTY)
      throw new Error(
        "Use --answers with a JSON file when an assistant runs setup. See memorial.example.json.",
      );
    const previous = await readJSON(
        path.join(root, ".openmemorial/draft.json"),
        await readJSON(path.join(root, ".openmemorial/answers.json"), {}),
      ),
      rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = async (label, fallback = "", key) => {
      const answer =
        (
          await rl.question(`${label}${fallback ? ` [${fallback}]` : ""}: `)
        ).trim() || fallback;
      if (key) {
        previous[key] = answer;
        await saveJSON(path.join(root, ".openmemorial/draft.json"), previous);
      }
      return answer;
    };
    try {
      console.log(
        "OpenMemorial · create a place for their memories. You can leave life dates blank.\n",
      );
      const name = await ask("Who are we remembering?", previous.name, "name");
      input = {
        ...previous,
        name,
        workerName: await ask(
          "A short site name (letters and hyphens)",
          previous.workerName || ("remembering-" + slug(name)).slice(0, 55),
          "workerName",
        ),
        birth: await ask(
          "Birth date, YYYY-MM-DD (optional)",
          previous.birth,
          "birth",
        ),
        death: await ask(
          "Death date, YYYY-MM-DD (optional)",
          previous.death,
          "death",
        ),
        timeZone: await ask(
          "Home time zone",
          previous.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          "timeZone",
        ),
        privacyEmail: await ask(
          "Public email for privacy or removal requests",
          previous.privacyEmail,
          "privacyEmail",
        ),
        notes: !/^n/i.test(
          await ask(
            "Allow visitor notes, with family approval? yes/no",
            previous.notes === false ? "no" : "yes",
          ),
        ),
        managers: (
          await ask(
            "Family manager emails, separated by commas",
            (previous.managers || []).join(", "),
          )
        )
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        accountId: await ask(
          "Cloudflare account ID (optional for now)",
          previous.accountId,
        ),
        photos: previous.photos || [],
        portrait: previous.portrait ?? null,
      };
      console.log(
        "Add photographs now, or leave the path blank to continue. Local files are not uploaded during setup.",
      );
      while (input.photos.length < 200) {
        const value = await ask("Photograph file path (blank to finish)");
        if (!value) break;
        const file = path.resolve(value.replace(/^["']|["']$/g, ""));
        let suggestion = "";
        try {
          const bytes = await readFile(file);
          if (bytes.length > 20 * 1024 * 1024) throw new Error();
          const tags = await exifr.parse(bytes, {
            pick: ["DateTimeOriginal", "CreateDate"],
            reviveValues: false,
            gps: false,
            xmp: false,
            iptc: false,
            icc: false,
          });
          suggestion = cameraDateFromMetadata(tags);
        } catch {}
        const caption = await ask(
            "Caption on the front",
            "A moment to remember",
          ),
          people = (
            await ask("Who is pictured? Names separated by commas (optional)")
          )
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
        const useCamera =
          suggestion &&
          /^y/i.test(
            await ask(
              `The camera suggests ${suggestion}. Use that date? yes/no`,
              "no",
            ),
          );
        const date = useCamera
          ? suggestion
          : await ask(
              "Confirmed photo date: YYYY, YYYY-MM, or YYYY-MM-DD (optional)",
            );
        const photo = {
          file,
          caption,
          people,
          date,
          dateSource: useCamera ? "camera" : "family",
          city: await ask("City (optional)"),
          state: await ask("State / region (optional)"),
          country: await ask("Country (optional)"),
          message: await ask("Note on the back (optional)"),
        };
        input.photos.push(photo);
        previous.photos = input.photos;
        await saveJSON(path.join(root, ".openmemorial/draft.json"), {
          ...previous,
          ...input,
        });
      }
      if (input.photos.length) {
        const selection = await ask(
          "Which photo belongs next to the name? Enter its number, or none",
          String((input.portrait ?? 0) + 1),
        );
        input.portrait =
          selection.toLowerCase() === "none" ? null : Number(selection) - 1;
      }
    } finally {
      rl.close();
    }
  }
  const answers = validateAnswers(input);
  const photos = await preparePhotos(answers.photos, base);
  const saved = {
    ...answers,
    photos: answers.photos.map((photo) => ({
      ...photo,
      file: path.resolve(base, photo.file),
    })),
  };
  const state = await readJSON(path.join(root, ".openmemorial/state.json"), {});
  if (
    state.workerName &&
    (state.workerName !== answers.workerName ||
      state.accountId !== answers.accountId)
  )
    throw new Error(
      "This folder already belongs to a connected memorial. Use a new folder to create another site.",
    );
  const result = await applyContent(root, answers, photos, state);
  await saveJSON(path.join(root, ".openmemorial/answers.json"), saved);
  await saveJSON(path.join(root, ".openmemorial/draft.json"), saved);
  console.log(
    `Prepared ${answers.name} with ${result.photographs} photographs. Nothing has been published.\nPreview: npm run dev\nNext: npm run setup:cloudflare -- plan\nOriginal source files were backed up privately under .openmemorial/backups/.`,
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
