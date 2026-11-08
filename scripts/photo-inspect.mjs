import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import exifr from "exifr";
import { cameraDateFromMetadata } from "../src/photoDateChoice.ts";
const files = process.argv.slice(2);
if (!files.length) {
  console.log(
    "npm run photos:inspect -- /path/to/photo.jpg\nLocal only. Reports a suggested camera date; ask the family to confirm it before using it. GPS is not read.",
  );
}
for (const file of files) {
  try {
    const bytes = await readFile(file);
    if (bytes.length > 20 * 1024 * 1024)
      throw new Error("Choose a file under 20 MB.");
    const metadata = await sharp(bytes, {
      limitInputPixels: 40_000_000,
    }).metadata();
    const tags = await exifr.parse(bytes, {
      pick: ["DateTimeOriginal", "CreateDate"],
      reviveValues: false,
      gps: false,
      xmp: false,
      iptc: false,
      icc: false,
    });
    console.log(
      JSON.stringify({
        file: path.basename(file),
        width: metadata.width,
        height: metadata.height,
        suggestedDate: cameraDateFromMetadata(tags) || null,
        confirmationRequired: true,
      }),
    );
  } catch (error) {
    console.error(`${path.basename(file)}: ${error.message}`);
    process.exitCode = 1;
  }
}
