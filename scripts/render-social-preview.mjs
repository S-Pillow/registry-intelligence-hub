/**
 * Render docs/assets/social/rih-social-preview.svg → public/social/rih-og-preview.png
 * Uses sharp (available via Next.js). Exact output: 1200 × 630 PNG.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = join(root, "docs/assets/social/rih-social-preview.svg");
const pngPath = join(root, "public/social/rih-og-preview.png");

const WIDTH = 1200;
const HEIGHT = 630;

const svg = await readFile(svgPath);
const png = await sharp(svg, { density: 144 })
  .resize(WIDTH, HEIGHT, { fit: "fill" })
  .png()
  .toBuffer();

const meta = await sharp(png).metadata();
if (meta.width !== WIDTH || meta.height !== HEIGHT || meta.format !== "png") {
  throw new Error(
    `Expected ${WIDTH}x${HEIGHT} png, got ${meta.width}x${meta.height} ${meta.format}`,
  );
}

await mkdir(dirname(pngPath), { recursive: true });
await writeFile(pngPath, png);
console.log(`Wrote ${pngPath} (${meta.width}x${meta.height} ${meta.format}, ${png.byteLength} bytes)`);
