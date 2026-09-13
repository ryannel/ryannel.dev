/**
 * Regenerates public/og.png (the site-wide social preview card).
 *
 * Run with `npm run og` after changing the text below. The PNG is committed, so
 * the site build never depends on this script — deliberately not a pipeline.
 */
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#fdfcfa"/>
  <rect x="0" y="0" width="1200" height="6" fill="#2d5f80"/>
  <text x="100" y="286" font-family="Charter, Georgia, serif" font-size="72" fill="#1c1b19">Ryan Nel</text>
  <text x="100" y="352" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#5c5a55">Notes on building software, experimenting with AI,</text>
  <text x="100" y="396" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#5c5a55">and what I learn along the way.</text>
  <text x="100" y="556" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#2d5f80" letter-spacing="1">ryannel.dev</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync(new URL('../public/og.png', import.meta.url), png);
console.log('wrote public/og.png');
