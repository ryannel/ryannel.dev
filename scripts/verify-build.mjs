/**
 * Assertions about dist/ that a type-check and a green build cannot make.
 *
 * Each one corresponds to something that was once wrong here and rendered
 * perfectly fine while being wrong: a draft advertised by a published page, a
 * table that escaped its scroll container, a beacon that would report from a
 * local preview, a 404 claiming to be a page. Run after `npm run build`.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = 'dist';
const SITE = 'https://ryannel.dev';
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

if (!existsSync(DIST)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const files = walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const read = (f) => readFileSync(f, 'utf8');
const urlPath = (f) => {
  const rel = relative(DIST, f).split(sep).join('/');
  return rel === 'index.html' ? '/' : '/' + rel.replace(/index\.html$/, '');
};

// --- 1. drafts are absent from production, including other pages' related: ---
const contentDirs = ['src/content/writing', 'src/content/projects'].filter(existsSync);
const drafts = contentDirs
  .flatMap((dir) => readdirSync(dir).map((n) => join(dir, n)))
  .filter((f) => /\.mdx?$/.test(f))
  .map((f) => ({ file: f, front: read(f).split('---')[1] ?? '' }))
  .filter(({ front }) => /^draft:\s*true\s*$/m.test(front))
  .map(({ file, front }) => ({
    id: file.split('/').pop().replace(/\.mdx?$/, ''),
    title: (front.match(/^title:\s*"?(.+?)"?\s*$/m) ?? front.match(/^name:\s*"?(.+?)"?\s*$/m))?.[1],
  }));

for (const draft of drafts) {
  check(!existsSync(join(DIST, 'writing', draft.id)), `draft "${draft.id}" was built as a route`);
  for (const f of htmlFiles) {
    const html = read(f);
    check(!html.includes(`/writing/${draft.id}/`), `draft "${draft.id}" is linked from ${urlPath(f)}`);
    if (draft.title) {
      check(!html.includes(draft.title), `draft "${draft.id}" title appears on ${urlPath(f)}`);
    }
  }
  for (const feed of ['rss.xml', 'sitemap-0.xml']) {
    const p = join(DIST, feed);
    if (existsSync(p)) check(!read(p).includes(draft.id), `draft "${draft.id}" appears in ${feed}`);
  }
}

// --- 2. every table is inside a scroll container -----------------------------
for (const f of htmlFiles) {
  const html = read(f);
  const tables = (html.match(/<table[\s>]/g) ?? []).length;
  const wrapped = (html.match(/<div class="table-wrap"[^>]*>\s*<table[\s>]/g) ?? []).length;
  check(tables === wrapped, `${urlPath(f)}: ${tables} table(s), ${wrapped} wrapped`);
}

// --- 3. the analytics beacon can only load on the canonical host -------------
const canonicalHost = new URL(SITE).hostname;
for (const f of htmlFiles) {
  const html = read(f);
  if (!html.includes('cloudflareinsights')) continue;
  check(
    !/<script[^>]+src="https:\/\/static\.cloudflareinsights\.com/.test(html),
    `${urlPath(f)}: beacon is a static <script> — it would load on any host`,
  );
  check(
    html.includes(`location.hostname === host`) && html.includes(`"${canonicalHost}"`),
    `${urlPath(f)}: beacon is not guarded by a ${canonicalHost} host check`,
  );
  check(
    (html.match(/__cfBeaconAdded/g) ?? []).length >= 2,
    `${urlPath(f)}: beacon has no insert-once guard`,
  );
}

// --- 4. canonical URLs, and the 404 which should not have one ----------------
for (const f of htmlFiles) {
  const html = read(f);
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (relative(DIST, f) === '404.html') {
    check(!canonical, '404 has a canonical URL; it is not a page at an address of its own');
    check(html.includes('name="robots" content="noindex"'), '404 is missing noindex');
  } else {
    check(canonical === SITE + urlPath(f), `${urlPath(f)}: canonical is ${canonical}`);
  }
}

// --- 5. internal links all resolve ------------------------------------------
for (const f of htmlFiles) {
  for (const [, href] of read(f).matchAll(/href="(\/[^"#?]*)"/g)) {
    const target = href.endsWith('/') ? join(DIST, href, 'index.html') : join(DIST, href);
    check(existsSync(target), `${urlPath(f)} links to ${href}, which was not built`);
  }
}

// --- 6. the 404 is not offered to crawlers ----------------------------------
const sitemap = join(DIST, 'sitemap-0.xml');
if (existsSync(sitemap)) check(!read(sitemap).includes('/404'), '404 is listed in the sitemap');

if (failures.length) {
  console.error(`verify-build: ${failures.length} failure(s)\n` + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log(`verify-build: ok (${htmlFiles.length} pages, ${drafts.length} draft(s) checked)`);
