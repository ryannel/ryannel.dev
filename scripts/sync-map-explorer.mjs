/** Copy the explicitly selected public viewer; the website never needs its source repo at runtime. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/sync-map-explorer.mjs /path/to/map_creation/showcase/explorer');
  process.exit(1);
}
const root = path.resolve(source);
const destination = path.resolve('public/lantern-sea');
const config = JSON.parse(await fs.readFile(path.join(root, 'map.json'), 'utf8'));
if (config.width !== 12276 || config.height !== 8184 || config.tileSize !== 512 || config.overlap !== 1 || config.maxLevel !== 14)
  throw Error('Unexpected map delivery. Review the source and encoder contract before syncing a different atlas.');
const files = ['index.html', 'viewer.css', 'viewer.js', 'map.json', 'overview.jpg', 'README.md'];
for (const [mode, metadata] of Object.entries(config.modes)) {
  if (!['artwork', 'labels'].includes(mode)) throw Error('Unexpected map mode');
  let count = 0;
  for (let level = 0; level <= config.maxLevel; level++) {
    const factor = 2 ** (config.maxLevel - level);
    const w = Math.ceil(config.width / factor), h = Math.ceil(config.height / factor);
    for (let y = 0; y < Math.ceil(h / config.tileSize); y++)
      for (let x = 0; x < Math.ceil(w / config.tileSize); x++) {
        files.push(`tiles/${mode}/${level}/${x}_${y}.webp`); count++;
      }
  }
  if (count !== metadata.tile_count) throw Error('Source tile count differs from its manifest');
}
const digest = createHash('sha256');
await fs.mkdir(path.dirname(destination), {recursive: true});
const stage = await fs.mkdtemp(path.join(path.dirname(destination), '.lantern-sea-'));
try {
  for (const relative of files.sort()) {
    const input = path.join(root, relative);
    if (!(await fs.lstat(input)).isFile()) throw Error(`Expected a regular public file: ${relative}`);
    const bytes = await fs.readFile(input);
    digest.update(relative + '\0').update(bytes);
    const output = path.join(stage, relative);
    await fs.mkdir(path.dirname(output), {recursive: true});
    await fs.writeFile(output, bytes);
  }
  await fs.writeFile(path.join(stage, 'source.json'), JSON.stringify({
    repository: 'https://github.com/ryannel/experiments/tree/main/map_creation',
    folder: 'showcase/explorer',
    release: config.source_release,
    artworkRevision: config.revision,
    files: files.length,
    sha256: digest.digest('hex'),
    note: 'Byte-for-byte copy of the selected public explorer. Edit upstream and resync; no original PNG masters are bundled.'
  }, null, 2) + '\n');
  await fs.rm(destination, {recursive: true, force: true});
  await fs.rename(stage, destination);
} finally {
  await fs.rm(stage, {recursive: true, force: true});
}
console.log(`Synced ${files.length} public explorer files and provenance to public/lantern-sea.`);
