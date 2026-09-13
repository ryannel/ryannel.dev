/**
 * Regenerates public/grain.png — the dark-mode surface texture.
 *
 * A seeded, tiling RGBA tile: white pixels whose alpha is a few parts in 255.
 * The noise lives in the alpha channel so the CSS needs no opacity, no blend
 * mode and no filter — it is just a repeating background behind the content.
 *
 * Run with `npm run grain`. The PNG is committed; the build never calls this.
 */
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const SIZE = 128; // large enough that the repeat is not perceptible
const MAX_ALPHA = 10; // out of 255, i.e. under 4% at full strength

// Mulberry32 — deterministic, so regenerating produces an identical file.
let seed = 0x9e3779b9;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const px = Buffer.alloc(SIZE * SIZE * 4);
for (let i = 0; i < SIZE * SIZE; i++) {
  px[i * 4] = 255;
  px[i * 4 + 1] = 255;
  px[i * 4 + 2] = 255;
  px[i * 4 + 3] = Math.round(rand() * MAX_ALPHA);
}

const png = await sharp(px, { raw: { width: SIZE, height: SIZE, channels: 4 } })
  .png({ compressionLevel: 9, palette: true, colours: MAX_ALPHA + 1, effort: 10 })
  .toBuffer();

writeFileSync(new URL('../public/grain.png', import.meta.url), png);
console.log(`wrote public/grain.png — ${SIZE}x${SIZE}, ${(png.length / 1024).toFixed(1)} KiB`);
