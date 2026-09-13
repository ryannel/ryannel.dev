/**
 * Assertions about dist/ that a type-check and a green build cannot make.
 *
 * Each one corresponds to something that was once wrong here and rendered
 * perfectly fine while being wrong: a hidden note advertised by a published
 * page, a table that escaped its scroll container, a beacon that would report
 * from a local preview, a 404 claiming to be a page, a heading over nothing.
 *
 * Run after `npm run build`. `node scripts/verify-build.mjs <dir>` checks a
 * build somewhere else, which is how the fixture build in scripts/test-
 * visibility.mjs is checked.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = process.argv[2] ?? 'dist';
const SITE = 'https://ryannel.dev';
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

if (!existsSync(DIST)) {
  console.error(`${DIST}/ not found — run \`npm run build\` first.`);
  process.exit(1);
}

const files = walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const read = (f) => readFileSync(f, 'utf8');
const urlPath = (f) => {
  const rel = relative(DIST, f).split(sep).join('/');
  return rel === 'index.html' ? '/' : '/' + rel.replace(/index\.html$/, '');
};
const pages = htmlFiles.map((file) => ({ file, path: urlPath(file), html: read(file) }));

// --- 1. nothing hidden reaches production, including via another page's related: ---
// draft: unfinished. sample: placeholder. One rule, both hidden; see src/lib/notes.ts.
const contentDirs = ['src/content/writing', 'src/content/projects'].filter(existsSync);
const hidden = contentDirs
  .flatMap((dir) => readdirSync(dir).map((n) => join(dir, n)))
  .filter((f) => /\.mdx?$/.test(f))
  .map((f) => ({ file: f, front: read(f).split('---')[1] ?? '' }))
  .filter(({ front }) => /^(draft|sample):\s*true\s*$/m.test(front))
  .map(({ file, front }) => ({
    id: file.split('/').pop().replace(/\.mdx?$/, ''),
    title: (front.match(/^title:\s*"?(.+?)"?\s*$/m) ?? front.match(/^name:\s*"?(.+?)"?\s*$/m))?.[1],
  }));

for (const entry of hidden) {
  check(!existsSync(join(DIST, 'writing', entry.id)), `hidden "${entry.id}" was built as a route`);
  for (const { path, html } of pages) {
    check(!html.includes(`/writing/${entry.id}/`), `hidden "${entry.id}" is linked from ${path}`);
    if (entry.title) {
      check(!html.includes(entry.title), `hidden "${entry.id}" title appears on ${path}`);
    }
  }
  for (const feed of ['rss.xml', 'sitemap-0.xml']) {
    const p = join(DIST, feed);
    if (existsSync(p)) check(!read(p).includes(entry.id), `hidden "${entry.id}" appears in ${feed}`);
  }
}

// --- 2. every table is inside a scroll container -----------------------------
for (const { path, html } of pages) {
  const tables = (html.match(/<table[\s>]/g) ?? []).length;
  const wrapped = (html.match(/<div class="table-wrap"[^>]*>\s*<table[\s>]/g) ?? []).length;
  check(tables === wrapped, `${path}: ${tables} table(s), ${wrapped} wrapped`);
}

// --- 3. the analytics beacon can only load on the canonical host -------------
const canonicalHost = new URL(SITE).hostname;
for (const { path, html } of pages) {
  if (!html.includes('cloudflareinsights')) continue;
  check(
    !/<script[^>]+src="https:\/\/static\.cloudflareinsights\.com/.test(html),
    `${path}: beacon is a static <script> — it would load on any host`,
  );
  check(
    html.includes(`location.hostname === host`) && html.includes(`"${canonicalHost}"`),
    `${path}: beacon is not guarded by a ${canonicalHost} host check`,
  );
  check((html.match(/__cfBeaconAdded/g) ?? []).length >= 2, `${path}: beacon has no insert-once guard`);
}

// --- 4. head: canonical, title, description, and a social card that exists ---
for (const { file, path, html } of pages) {
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (relative(DIST, file) === '404.html') {
    check(!canonical, '404 has a canonical URL; it is not a page at an address of its own');
    check(html.includes('name="robots" content="noindex"'), '404 is missing noindex');
  } else {
    check(canonical === SITE + path, `${path}: canonical is ${canonical}`);
  }

  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
  check(Boolean(title), `${path}: empty or missing <title>`);
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1]?.trim();
  check(Boolean(description), `${path}: empty or missing meta description`);

  const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  check(Boolean(ogImage), `${path}: no og:image`);
  if (ogImage?.startsWith(SITE)) {
    const asset = join(DIST, ogImage.slice(SITE.length));
    check(existsSync(asset), `${path}: og:image ${ogImage} is not in the build`);
  }
}

// --- 5. internal links and fragments resolve ---------------------------------
// A link may carry a query and a fragment; both have to come off before the
// path is resolved, and the fragment then has to exist on the page it names.
const idsIn = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const idsByPath = new Map(pages.map((p) => [p.path, idsIn(p.html)]));

for (const { path, html } of pages) {
  for (const [, href] of html.matchAll(/href="(\/[^"]*)"/g)) {
    const [withoutFragment, fragment] = href.split('#');
    const pathname = withoutFragment.split('?')[0] || '/';
    const target = pathname.endsWith('/') ? join(DIST, pathname, 'index.html') : join(DIST, pathname);
    if (!existsSync(target)) {
      check(false, `${path} links to ${pathname}, which was not built`);
      continue;
    }
    if (fragment) {
      const ids = idsByPath.get(pathname) ?? idsIn(read(target));
      check(ids.has(fragment), `${path} links to ${href}, but #${fragment} is not on that page`);
    }
  }
  // Same-page fragments, which have no leading slash.
  for (const [, fragment] of html.matchAll(/href="#([^"]+)"/g)) {
    check(idsIn(html).has(fragment), `${path}: #${fragment} does not exist on this page`);
  }
}

// --- 6. the 404 is not offered to crawlers ----------------------------------
const sitemap = join(DIST, 'sitemap-0.xml');
if (existsSync(sitemap)) check(!read(sitemap).includes('/404'), '404 is listed in the sitemap');

// --- 7. filtering leaves no empty list behind --------------------------------
// When every entry in a list is hidden, the list has to go with it.
for (const { path, html } of pages) {
  check(!/<(ul|ol)(\s[^>]*)?>\s*<\/\1>/.test(html), `${path}: an empty list was rendered`);
}

if (failures.length) {
  console.error(
    `verify-build: ${failures.length} failure(s)\n` + failures.map((f) => '  - ' + f).join('\n'),
  );
  process.exit(1);
}
console.log(
  `verify-build: ok (${DIST}: ${pages.length} pages, ${hidden.length} hidden entr(ies) checked)`,
);
