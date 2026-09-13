/**
 * The publication rule, tested end to end.
 *
 * There is one rule — isPublished in src/lib/notes.ts — and several places that
 * have to obey it: the routes, the home page, the archive, the feed, the
 * sitemap, and the related lists on notes and on projects. The related lists are
 * the ones that have gone wrong before, because they resolve references rather
 * than query the collection, so they can advertise something the build never
 * made.
 *
 * The fixtures live in tests/fixtures/, outside src/content/, where no build can
 * reach them. This copies the project into a temporary directory, drops them in
 * there, and checks that build — so the fixtures cannot become real articles and
 * the real content is never touched.
 *
 * Only the build half of the rule is asserted here. The other half — that hidden
 * entries are still visible in `astro dev` — is the first thing you see every
 * time you run the dev server, so it does not need a spawned server to watch it.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = process.cwd();
const COPY = ['src', 'public', 'scripts', 'astro.config.mjs', 'tsconfig.json', 'package.json'];

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

const work = mkdtempSync(join(tmpdir(), 'ryannel-fixtures-'));
try {
  for (const entry of COPY) cpSync(join(ROOT, entry), join(work, entry), { recursive: true });
  cpSync(join(ROOT, 'tests/fixtures/writing'), join(work, 'src/content/writing'), { recursive: true });
  cpSync(join(ROOT, 'tests/fixtures/projects'), join(work, 'src/content/projects'), { recursive: true });
  symlinkSync(join(ROOT, 'node_modules'), join(work, 'node_modules'));

  const run = (cmd, args) =>
    execFileSync(cmd, args, { cwd: work, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  run('node', [join(work, 'node_modules/astro/bin/astro.mjs'), 'build']);

  const dist = join(work, 'dist');
  const read = (p) => (existsSync(join(dist, p)) ? readFileSync(join(dist, p), 'utf8') : null);
  const hiddenIds = ['__fixture-hidden-draft', '__fixture-hidden-sample'];

  // The generic assertions — no route, no link, no title, no feed, no sitemap
  // entry, no empty list left behind — are the ones the deploy gate makes.
  // Running them here proves they fire on content designed to break them.
  try {
    run('node', [join(work, 'scripts/verify-build.mjs'), 'dist']);
  } catch (error) {
    const output = (error.stderr ?? error.stdout ?? String(error)).trim();
    check(false, `verify-build failed on the fixture build:\n    ${output.split('\n').join('\n    ')}`);
  }

  // 1. A published note keeps the references it can show and drops the rest.
  const referencing = read('writing/__fixture-references-hidden/index.html');
  check(referencing !== null, 'the published note referencing hidden entries was not built');
  if (referencing) {
    check(
      referencing.includes('/writing/__fixture-visible-note/'),
      'the one visible reference was filtered out along with the hidden ones',
    );
    check(referencing.includes('Related notes'), 'the related section vanished while it still had an entry');
    for (const id of hiddenIds) {
      check(!referencing.includes(id), `${id} is still linked from the note that references it`);
    }
  }

  // 2. When every reference is hidden the section goes, rather than emptying.
  const allHidden = read('writing/__fixture-all-refs-hidden/index.html');
  check(allHidden !== null, 'the published note whose references are all hidden was not built');
  if (allHidden) {
    check(!allHidden.includes('Related notes'), 'an empty "Related notes" heading was rendered');
  }

  // 3. The same on the projects page, which renders its own list.
  const projects = read('projects/index.html');
  check(projects !== null, 'the projects page was not built');
  if (projects) {
    check(projects.includes('Fixture project'), 'the fixture project was not rendered at all');
    check(
      !projects.includes('project-related-heading'),
      'the projects page rendered a "Related notes" heading with nothing under it',
    );
  }

  // 4. Tables reach the scroll wrapper from every format that can produce one.
  //     verify-build counts <table> against wrapped <table> on every page; these
  //     assertions are what stop that count being 0 = 0 on a page with no table.
  const tableCases = [
    ['writing/__fixture-visible-note/index.html', 2, 'a Markdown table and a table written as markup in .mdx'],
    ['writing/__fixture-markdown-table/index.html', 1, 'a Markdown table in a plain .md note'],
  ];
  for (const [file, expected, what] of tableCases) {
    const html = read(file) ?? '';
    const wrapped = (html.match(/<div class="table-wrap"[^>]*>\s*<table[\s>]/g) ?? []).length;
    check(wrapped === expected, `${what}: expected ${expected} wrapped table(s), found ${wrapped}`);
  }

  // 5. A figure from /public keeps the dimensions that reserve its space...
  const figurePage = read('writing/__fixture-visible-note/index.html') ?? '';
  check(
    /<img[^>]+src="\/diagrams\/repo-vs-system-model\.svg"[^>]+width="640"[^>]+height="280"/.test(figurePage),
    'the public-path figure lost its width/height, so the page reflows when it loads',
  );

  // ...and one without them has to stop the build rather than ship a reflow.
  writeFileSync(
    join(work, 'src/content/writing/__fixture-figure-no-dimensions.mdx'),
    ['---', 'title: "Fixture — a figure missing its dimensions"', 'description: "Must fail the build."',
     'published: 2026-01-08', '---', '', '<Figure src="/diagrams/repo-vs-system-model.svg" alt="No dimensions." />', ''].join('\n'),
  );
  let buildFailed = false;
  let buildOutput = '';
  try {
    run('node', [join(work, 'node_modules/astro/bin/astro.mjs'), 'build', '--outDir', 'dist-bad']);
  } catch (error) {
    buildFailed = true;
    buildOutput = String(error.stderr ?? '') + String(error.stdout ?? '');
  }
  rmSync(join(work, 'src/content/writing/__fixture-figure-no-dimensions.mdx'), { force: true });
  check(buildFailed, 'a <Figure> from /public with no width or height built successfully');
  check(
    buildOutput.includes('needs width and height'),
    'the missing-dimensions build failed for some other reason than the missing dimensions',
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures.length) {
  console.error(
    `test-visibility: ${failures.length} failure(s)\n` + failures.map((f) => '  - ' + f).join('\n'),
  );
  process.exit(1);
}
console.log('test-visibility: ok (hidden entries stayed out of the build)');
