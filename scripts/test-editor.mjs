/**
 * The note editor's text work, checked against notes shaped like the real
 * ones. Everything here is pure: source in, new source out, no dev server.
 *
 *   node --test scripts/test-editor.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyInsertAfter,
  applyRaw,
  applyReplace,
  blankAround,
  importName,
  isHeading,
  kindOf,
  layout,
  lead,
  letters,
  localDate,
  MARKER,
  mdxComments,
  moveBlock,
  newNoteText,
  orphanImports,
  quote,
  readFrontmatter,
  readTag,
  removeImports,
  scanFences,
  separator,
  setAttrs,
  setFrontmatter,
  sliceBlock,
  slugify,
  wrap,
  writeTag,
} from './editor/edits.mjs';

/* ---- fixtures: a scratch note with one of everything, and a figure note ---- */

const NOTE = [
  '---',
  'title: "Editor test note"',
  'description: "A scratch note for exercising the in-page editor."',
  'published: 2026-09-20',
  'draft: true',
  'tags: ["scratch"]',
  '---',
  '',
  'A first paragraph with *italic*, **bold**, `code` and a [link](https://example.com).',
  '',
  '{/* claude: this paragraph is hand-wavy, tighten it */}',
  '',
  '## A heading',
  '',
  '- one item',
  '- two item',
  '',
  '1. first',
  '2. second',
  '',
  '> A quoted line.',
  '',
  '```sh',
  'git clone https://example.com/repo',
  'cd repo',
  '```',
  '',
  '| Column A | Column B |',
  '| --- | --- |',
  '| a1 | b1 |',
  '',
  '<Callout type="surprise">Something unexpected.</Callout>',
  '',
  'Last paragraph TK.',
  '',
].join('\n');

const FIGURES = [
  '---',
  'title: "Painting a 100-megapixel world"',
  'description: "One tile at a time."',
  'published: 2026-09-20',
  'featured: false',
  'draft: false',
  'tags: ["experiments", "generative"]',
  'links:',
  '  - label: "The map-making kit on GitHub"',
  '    href: "https://github.com/ryannel/experiments"',
  '---',
  '',
  "import world from '../../assets/atlas-experiment/world-and-detail.jpg';",
  "import asterfall from '../../assets/atlas-experiment/asterfall.jpg';",
  "import crownmere from '../../assets/atlas-experiment/crownmere.jpg';",
  '',
  '<Figure',
  '  src={world}',
  '  alt="The complete Lantern Sea world map."',
  '  caption="The whole map, with the marked piece at its own pixels."',
  '  wide',
  '/>',
  '',
  'I’ve always been drawn to maps.',
  '',
  '<Figure src={asterfall} alt="The observatory at Asterfall." />',
  '',
  'Ten days and 433 turns later, I have one.',
  '',
  '<Figure src={crownmere} alt="Crownmere." caption="The castle is too big, on purpose." wide />',
  '',
].join('\n');

/** The range of a block, found in the fixture by its own source. */
const at = (text, block) => {
  const start = text.indexOf(block);
  assert.notEqual(start, -1, `fixture has no ${JSON.stringify(block.slice(0, 20))}`);
  return { start, end: start + block.length };
};

/* ---- wrapping and layout ---- */

test('wrap breaks at 95 columns and never inside a word', () => {
  const long = 'word '.repeat(40).trim();
  const out = wrap(long);
  for (const line of out.split('\n')) assert.ok(line.length <= 95, line);
  assert.equal(out.replace(/\n/g, ' '), long);
});

test('wrap indents continuation lines and later paragraphs', () => {
  const out = wrap('a '.repeat(60).trim() + '\n\n' + 'second', '  ');
  assert.ok(out.split('\n')[1].startsWith('  '));
  assert.ok(out.endsWith('\n\n  second'));
});

test('wrap keeps a long link on one line', () => {
  const url = '[link](https://example.com/' + 'x'.repeat(120) + ')';
  assert.equal(wrap(url), url);
});

test('letters strips markers and link syntax', () => {
  assert.equal(letters('- A **bold** item'), 'abolditem');
  assert.equal(letters('## A heading'), 'aheading');
  assert.equal(letters('> [A link](https://example.com) here'), 'alinkhere');
});

test('letters compares the whole block, not just its opening words', () => {
  const long = 'The quick brown fox jumps over the lazy dog and keeps going.';
  assert.notEqual(letters(long), letters(long.replace('going.', 'stopping.')));
  assert.equal(letters(long).length, long.replace(/[^a-z]/gi, '').length);
  assert.equal(letters('- one item'), letters('one item'));
});

test('letters drops inline HTML and a component tag', () => {
  const html = 'A word in <abbr title="x">HTML</abbr> here';
  assert.equal(letters(html), letters('A word in HTML here'));
  assert.equal(letters('<Figure\n  src={one}\n  alt="One."\n/>'), '');
  const callout = '<Callout type="surprise">Something unexpected.</Callout>';
  assert.equal(letters(callout), 'somethingunexpected');
});

test('kindOf and isHeading read the marker', () => {
  assert.equal(kindOf(MARKER.exec('- one')), 'ul');
  assert.equal(kindOf(MARKER.exec('3. one')), 'ol');
  assert.equal(kindOf(MARKER.exec('> one')), 'quote');
  assert.equal(kindOf(MARKER.exec('plain')), 'p');
  assert.equal(isHeading('## A heading'), true);
  assert.equal(isHeading('#hash'), false);
});

test('layout keeps the marker and hangs the rest under it', () => {
  const block = layout('1. ' + 'word '.repeat(40).trim(), '');
  assert.equal(block.kind, 'ol');
  assert.equal(block.marker, '1. ');
  assert.ok(block.text.startsWith('1. word'));
  assert.ok(block.text.split('\n')[1].startsWith('   word'));
});

test('separator spells the next block of the same kind', () => {
  assert.equal(separator('ul', MARKER.exec('* one'), ''), '\n* ');
  assert.equal(separator('ol', MARKER.exec('3. one'), ''), '\n4. ');
  assert.equal(separator('quote', MARKER.exec('> one'), ''), '\n>\n> ');
  assert.equal(separator('p', null, ''), '\n\n');
});

test('blankAround opens a blank line on each side', () => {
  const text = 'a\nBLOCK\nb';
  const out = blankAround(text, text.indexOf('BLOCK'), text.indexOf('BLOCK') + 5);
  assert.equal(out, 'a\n\nBLOCK\n\nb');
});

test('blankAround leaves a block that already has its blank lines', () => {
  const text = 'a\n\nBLOCK\n\nb';
  const out = blankAround(text, text.indexOf('BLOCK'), text.indexOf('BLOCK') + 5);
  assert.equal(out, text);
});

/* ---- ranges ---- */

test('sliceBlock returns the block and refuses a range outside the file', () => {
  const range = at(NOTE, '## A heading');
  assert.equal(sliceBlock(NOTE, 0, range).current, '## A heading');
  assert.throws(() => sliceBlock(NOTE, 0, { start: 5, end: NOTE.length + 1 }), /outside the file/);
  assert.throws(() => sliceBlock(NOTE, 0, { start: 5, end: 5 }), /outside the file/);
});

test('sliceBlock checks the page against the file when expect is sent', () => {
  const range = at(NOTE, '## A heading');
  assert.ok(sliceBlock(NOTE, 0, { ...range, expect: 'A heading' }));
  assert.throws(
    () => sliceBlock(NOTE, 0, { ...range, expect: 'Something else entirely' }),
    /no longer matches/,
  );
});

test('lead finds the indentation and a quote mark', () => {
  const text = '> quoted\n  - item';
  assert.equal(lead(text, text.indexOf('quoted')).quoted, true);
  assert.equal(lead(text, text.indexOf('- item')).indent, '  ');
});

/* ---- fences ---- */

test('scanFences finds the fence with its language', () => {
  const fences = scanFences(NOTE);
  assert.equal(fences.length, 1);
  const [fence] = fences;
  assert.equal(fence.lang, 'sh');
  assert.equal(fence.meta, '');
  const source = '```sh\ngit clone https://example.com/repo\ncd repo\n```';
  assert.equal(NOTE.slice(fence.start, fence.end), source);
});

test('scanFences reads the info string, an indented fence and a tilde one', () => {
  const text = [
    '<Callout>',
    '',
    '  ```js title="one.js"',
    '  const a = 1;',
    '  ```',
    '',
    '</Callout>',
    '',
    '~~~',
    'plain',
    '~~~~',
    '',
  ].join('\n');
  const [js, tilde] = scanFences(text);
  assert.equal(js.lang, 'js');
  assert.equal(js.meta, 'title="one.js"');
  assert.equal(text.slice(js.start, js.end), '```js title="one.js"\n  const a = 1;\n  ```');
  assert.equal(tilde.lang, '');
  assert.equal(text.slice(tilde.start, tilde.end), '~~~\nplain\n~~~~');
});

test('scanFences runs an unclosed fence to the end, and never closes it on another marker', () => {
  const text = '```\none\n~~~\ntwo\n';
  const [fence] = scanFences(text);
  assert.equal(fence.end, text.length);
  assert.equal(scanFences('text with no fences at all').length, 0);
});

test('mdxComments lists the notes left in the file, with line numbers', () => {
  assert.deepEqual(mdxComments(NOTE), [
    { line: 11, text: 'claude: this paragraph is hand-wavy, tighten it' },
  ]);
  assert.deepEqual(mdxComments(FIGURES), []);
});

/* ---- front matter ---- */

test('readFrontmatter reads the fields as plain values', () => {
  assert.deepEqual(readFrontmatter(NOTE), {
    title: 'Editor test note',
    description: 'A scratch note for exercising the in-page editor.',
    published: '2026-09-20',
    updated: null,
    draft: true,
    featured: false,
    tags: ['scratch'],
  });
});

test('readFrontmatter takes bare and single-quoted strings, and the block tag list', () => {
  const text = [
    '---',
    'title: Bare title',
    "description: 'It''s fine'",
    'tags:',
    '  - one',
    '  - "two"',
    '---',
    '',
    'Body.',
    '',
  ].join('\n');
  const front = readFrontmatter(text);
  assert.equal(front.title, 'Bare title');
  assert.equal(front.description, "It's fine");
  assert.deepEqual(front.tags, ['one', 'two']);
  assert.equal(front.published, null);
  assert.equal(front.draft, false);
});

test('readFrontmatter reads a note with a links block, or with no front matter at all', () => {
  assert.deepEqual(readFrontmatter(FIGURES).tags, ['experiments', 'generative']);
  assert.equal(readFrontmatter(FIGURES).featured, false);
  assert.equal(readFrontmatter('Just a body.').title, '');
});

test('setFrontmatter rewrites the fields that are there', () => {
  assert.ok(setFrontmatter(NOTE, 'title', '  A new title  ').includes('title: "A new title"'));
  assert.ok(setFrontmatter(NOTE, 'description', '').includes('description: ""'));
  assert.ok(setFrontmatter(NOTE, 'draft', false).includes('draft: false'));
  assert.ok(setFrontmatter(NOTE, 'published', '2027-01-02').includes('published: 2027-01-02'));
  assert.ok(setFrontmatter(NOTE, 'tags', [' a ', '', 'b']).includes('tags: ["a", "b"]'));
  assert.ok(setFrontmatter(NOTE, 'tags', []).includes('tags: []'));
});

test('setFrontmatter keeps a quote inside a title', () => {
  const out = setFrontmatter(NOTE, 'title', 'The "quoted" one');
  assert.ok(out.includes('title: "The \\"quoted\\" one"'));
  assert.equal(readFrontmatter(out).title, 'The "quoted" one');
});

test('setFrontmatter adds a missing field in the order the notes use', () => {
  const out = setFrontmatter(NOTE, 'updated', '2026-09-21');
  assert.ok(out.includes('published: 2026-09-20\nupdated: 2026-09-21\ndraft: true'));
  const featured = setFrontmatter(NOTE, 'featured', true);
  assert.ok(featured.includes('published: 2026-09-20\nfeatured: true'));
});

test('setFrontmatter adds tags before the links block, never inside it', () => {
  const without = FIGURES.replace('tags: ["experiments", "generative"]\n', '');
  const out = setFrontmatter(without, 'tags', ['maps']);
  assert.ok(out.includes('draft: false\ntags: ["maps"]\nlinks:'));
  assert.ok(out.includes('  - label: "The map-making kit on GitHub"'));
});

test('setFrontmatter clears updated but only when the line is there', () => {
  const withUpdated = setFrontmatter(NOTE, 'updated', '2026-09-21');
  assert.ok(setFrontmatter(withUpdated, 'updated', '').includes('\nupdated:\n'));
  assert.equal(setFrontmatter(NOTE, 'updated', null), NOTE);
});

test('setFrontmatter refuses an empty title, a bad date and a field it does not own', () => {
  assert.throws(() => setFrontmatter(NOTE, 'title', '   '), /title can't be empty/);
  assert.throws(() => setFrontmatter(NOTE, 'published', '20th'), /needs a date/);
  assert.throws(() => setFrontmatter(NOTE, 'published', '2026-13-45'), /needs a date/);
  assert.throws(() => setFrontmatter(NOTE, 'links', 'x'), /not editable/);
  assert.throws(() => setFrontmatter('no front matter here', 'title', 'x'), /no front matter/);
});

test('setFrontmatter only ever touches the block at the top of the file', () => {
  const text = [
    '---',
    'title: "The real one"',
    'draft: true',
    '---',
    '',
    'Front matter looks like this:',
    '',
    '```yaml',
    'title: "Not this one"',
    'draft: false',
    '```',
    '',
    'And `title: "nor this"` inline.',
    '',
  ].join('\n');
  const renamed = setFrontmatter(text, 'title', 'Renamed');
  assert.ok(renamed.startsWith('---\ntitle: "Renamed"\ndraft: true\n---'));
  assert.ok(renamed.includes('title: "Not this one"'));
  assert.ok(renamed.includes('And `title: "nor this"` inline.'));
  const published = setFrontmatter(text, 'draft', false);
  assert.ok(published.startsWith('---\ntitle: "The real one"\ndraft: false\n---'));
  assert.equal(scanFences(published).length, 1);
});

test('setFrontmatter replaces a block tag list with the inline form', () => {
  const text = ['---', 'title: "T"', 'tags:', '  - one', '  - two', '---', '', 'Body.', ''].join(
    '\n',
  );
  const out = setFrontmatter(text, 'tags', ['one', 'three']);
  assert.ok(out.includes('tags: ["one", "three"]\n---'));
  assert.equal(out.includes('  - one'), false);
});

/* ---- component attributes ---- */

test('readTag and writeTag round-trip a multi-line figure', () => {
  const src = FIGURES.slice(at(FIGURES, '<Figure\n').start);
  const tag = readTag(src);
  assert.equal(tag.name, 'Figure');
  assert.equal(tag.selfClosing, true);
  assert.equal(tag.multiline, true);
  assert.deepEqual(tag.attrs.map((a) => a.name), ['src', 'alt', 'caption', 'wide']);
});

test('quote escapes a quote and a backslash rather than curling them', () => {
  assert.equal(quote('a "quoted" word'), '"a \\"quoted\\" word"');
  assert.equal(quote('ends in a backslash \\'), '"ends in a backslash \\\\"');
  const tag = setAttrs('<Figure src={one} />', { caption: 'A path C:\\ and a "quote".' });
  assert.equal(tag, '<Figure src={one} caption="A path C:\\\\ and a \\"quote\\"." />');
  assert.deepEqual(
    readTag(tag).attrs.map((a) => a.name),
    ['src', 'caption'],
  );
});

test('setAttrs sets, removes and flags, keeping flags last', () => {
  const out = setAttrs('<Figure src={world} alt="One." />', { caption: 'Two.', wide: true });
  assert.equal(out, '<Figure src={world} alt="One." caption="Two." wide />');
  assert.equal(setAttrs(out, { caption: null }), '<Figure src={world} alt="One." wide />');
  assert.equal(setAttrs(out, { wide: false }), '<Figure src={world} alt="One." caption="Two." />');
});

test('setAttrs writes an expression value unquoted', () => {
  const out = setAttrs('<Figure src={world} alt="One." />', { src: { expr: 'crownmere' } });
  assert.equal(out, '<Figure src={crownmere} alt="One." />');
});

test('setAttrs keeps the children of a block that is not self-closing', () => {
  const src = '<Callout type="surprise">Something unexpected.</Callout>';
  const out = '<Callout type="aside">Something unexpected.</Callout>';
  assert.equal(setAttrs(src, { type: 'aside' }), out);
});

test('importName is camelCase and never collides', () => {
  assert.equal(importName('atlas-experiment/tile-grid.jpg', FIGURES), 'tileGrid');
  assert.equal(importName('atlas-experiment/world-and-detail.jpg', FIGURES), 'worldAndDetail');
  assert.equal(importName('crownmere.jpg', FIGURES), 'crownmere2');
  assert.equal(importName('2026-map.png', ''), 'map');
});

/* ---- replace ---- */

test('applyReplace swaps a paragraph for new text', () => {
  const range = at(NOTE, 'Last paragraph TK.');
  const out = applyReplace(NOTE, 0, { ...range, text: 'The last paragraph, finished.' });
  assert.ok(out.endsWith('The last paragraph, finished.\n'));
  assert.equal(scanFences(out).length, 1);
});

test('applyReplace keeps the file s own bullet when the kind is the same', () => {
  const range = at(NOTE, '- one item');
  const out = applyReplace(NOTE, 0, { ...range, text: '* one item, reworded' });
  assert.ok(out.includes('- one item, reworded\n- two item'));
});

test('applyReplace opens blank lines when a paragraph becomes a heading', () => {
  const range = at(NOTE, 'Last paragraph TK.');
  const out = applyReplace(NOTE, 0, { ...range, text: '### Last' });
  assert.ok(out.includes('</Callout>\n\n### Last'));
});

test('applyReplace splits a block in two on Enter', () => {
  const range = at(NOTE, '- one item');
  const out = applyReplace(NOTE, 0, { ...range, text: '- one item', after: 'one and a half' });
  assert.ok(out.includes('- one item\n- one and a half\n- two item'));
});

test('applyReplace splits a numbered item with the next number', () => {
  const range = at(NOTE, '1. first');
  const out = applyReplace(NOTE, 0, { ...range, text: '1. first', after: 'first and a half' });
  assert.ok(out.includes('1. first\n2. first and a half\n2. second'));
});

test('applyReplace deletes a block and one of its blank lines', () => {
  const range = at(NOTE, '## A heading');
  const out = applyReplace(NOTE, 0, { ...range, text: '' });
  assert.equal(out.includes('## A heading'), false);
  assert.ok(out.includes('*/}\n\n- one item'));
});

test('applyReplace joins a paragraph with the one after it', () => {
  const text = 'One.\n\nTwo.\n\nThree.\n';
  const range = at(text, 'One.');
  const out = applyReplace(text, 0, { ...range, text: 'One. Two.', joinNext: true });
  assert.equal(out, 'One. Two.\n\nThree.\n');
});

test('applyReplace joins list items one line at a time', () => {
  const range = at(NOTE, '- one item');
  const out = applyReplace(NOTE, 0, { ...range, text: '- one itemtwo item', joinNext: true });
  assert.ok(out.includes('- one itemtwo item\n\n1. first'));
});

test('applyReplace checks the block it is about to swallow when expectNext is sent', () => {
  const text = 'One.\n\nTwo.\n\nThree.\n';
  const range = at(text, 'One.');
  const join = { ...range, text: 'One. Two.', joinNext: true };
  assert.equal(applyReplace(text, 0, { ...join, expectNext: 'Two.' }), 'One. Two.\n\nThree.\n');
  assert.throws(
    () => applyReplace(text, 0, { ...join, expectNext: 'Something else' }),
    /not the one on the page/,
  );
});

test('applyReplace refuses to join when there is nothing after the block', () => {
  const text = 'Only one.\n';
  assert.throws(
    () => applyReplace(text, 0, { ...at(text, 'Only one.'), text: 'x', joinNext: true }),
    /nothing after this block/,
  );
});

test('applyReplace folds the quote mark back in', () => {
  const range = at(NOTE, 'A quoted line.');
  const out = applyReplace(NOTE, 0, { ...range, text: '> A quoted line, longer now.' });
  assert.ok(out.includes('> A quoted line, longer now.'));
});

/* ---- insert-after ---- */

test('applyInsertAfter puts a paragraph after the block', () => {
  const range = at(NOTE, '## A heading');
  const out = applyInsertAfter(NOTE, 0, { ...range, text: 'A new paragraph.' });
  assert.ok(out.includes('## A heading\n\nA new paragraph.\n\n- one item'));
});

test('applyInsertAfter tight adds an item to the same list', () => {
  const range = at(NOTE, '- one item');
  const out = applyInsertAfter(NOTE, 0, { ...range, text: '- one and a half', tight: true });
  assert.ok(out.includes('- one item\n- one and a half\n- two item'));
});

test('applyInsertAfter keeps a quote in the same quote', () => {
  const range = at(NOTE, 'A quoted line.');
  const out = applyInsertAfter(NOTE, 0, { ...range, text: '> A second line.' });
  assert.ok(out.includes('> A quoted line.\n>\n> A second line.'));
});

test('applyInsertAfter with atEnd writes the first paragraph of an empty note', () => {
  const empty = newNoteText('A new note', '2026-09-20');
  const out = applyInsertAfter(empty, 0, { atEnd: true, text: 'The first paragraph.' });
  assert.equal(out, empty.replace(/\s*$/, '') + '\n\nThe first paragraph.\n');
  assert.ok(out.endsWith('---\n\nThe first paragraph.\n'));
});

test('applyInsertAfter with atEnd ignores the range and keeps one trailing newline', () => {
  const out = applyInsertAfter(NOTE, 0, { start: 0, end: 4, atEnd: true, text: 'A coda.' });
  assert.ok(out.endsWith('Last paragraph TK.\n\nA coda.\n'));
});

/* ---- raw ---- */

test('applyRaw puts a fence back verbatim, with no wrapping', () => {
  const fence = scanFences(NOTE)[0];
  const text = '```sh\ngit clone https://example.com/a/very/long/repository/name/that/would/wrap.git\n```';
  const out = applyRaw(NOTE, 0, { start: fence.start, end: fence.end, text });
  assert.ok(out.includes(text));
  assert.equal(scanFences(out)[0].lang, 'sh');
});

test('applyRaw trims one trailing newline and opens blank lines around the block', () => {
  const range = at(NOTE, '| Column A | Column B |\n| --- | --- |\n| a1 | b1 |');
  const table = '| A | B |\n| --- | --- |\n| 1 | 2 |\n';
  const out = applyRaw(NOTE, 0, { ...range, text: table });
  assert.ok(out.includes('\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n'));
});

test('applyRaw with nothing in it deletes the block', () => {
  const range = at(NOTE, '{/* claude: this paragraph is hand-wavy, tighten it */}');
  const out = applyRaw(NOTE, 0, { ...range, text: '  \n' });
  assert.equal(out.includes('hand-wavy'), false);
  assert.ok(out.includes('example.com).\n\n## A heading'));
});

test('applyRaw checks the range and the letters when expect is sent', () => {
  const range = at(NOTE, '| Column A | Column B |');
  const bad = { ...range, expect: 'nothing like it', text: 'x' };
  assert.throws(() => applyRaw(NOTE, 0, bad), /reload/);
});

/* ---- move ---- */

test('moveBlock swaps two list items', () => {
  const here = at(NOTE, '- one item');
  const other = at(NOTE, '- two item');
  const out = moveBlock(NOTE, 0, { ...here, other, dir: 1 });
  assert.ok(out.includes('- two item\n- one item\n'));
});

test('moveBlock keeps the numbers ascending', () => {
  const here = at(NOTE, '1. first');
  const other = at(NOTE, '2. second');
  assert.ok(moveBlock(NOTE, 0, { ...here, other, dir: 1 }).includes('1. second\n2. first'));
  const up = moveBlock(NOTE, 0, { ...other, other: here, dir: -1 });
  assert.ok(up.includes('1. second\n2. first'));
});

test('moveBlock swaps a paragraph with the block above it', () => {
  const here = at(NOTE, 'Last paragraph TK.');
  const other = at(NOTE, '<Callout type="surprise">Something unexpected.</Callout>');
  const out = moveBlock(NOTE, 0, { ...here, other, dir: -1 });
  assert.ok(out.includes('Last paragraph TK.\n\n<Callout type="surprise">'));
  assert.ok(out.endsWith('</Callout>\n'));
});

test('moveBlock refuses two blocks that are not neighbours', () => {
  const here = at(NOTE, '- one item');
  const other = at(NOTE, '1. first');
  assert.throws(() => moveBlock(NOTE, 0, { ...here, other, dir: 1 }), /not next to each other/);
});

test('moveBlock refuses the wrong direction and no direction', () => {
  const here = at(NOTE, '- one item');
  const other = at(NOTE, '- two item');
  assert.throws(() => moveBlock(NOTE, 0, { ...here, other, dir: -1 }), /nothing to move up/);
  assert.throws(() => moveBlock(NOTE, 0, { ...here, other, dir: 0 }), /no direction/);
});

test('moveBlock refuses to move inside a quote', () => {
  const text = '> one\n>\n> two\n';
  const here = { start: text.indexOf('one'), end: text.indexOf('one') + 3 };
  const other = { start: text.indexOf('two'), end: text.indexOf('two') + 3 };
  assert.throws(() => moveBlock(text, 0, { ...here, other, dir: 1 }), /inside a quote/);
});

/* ---- orphan imports ---- */

test('orphanImports names the imports nothing uses any more', () => {
  assert.deepEqual(orphanImports(FIGURES), []);
  const figure = '<Figure src={asterfall} alt="The observatory at Asterfall." />\n\n';
  const gone = FIGURES.replace(figure, '');
  assert.deepEqual(orphanImports(gone), ['asterfall']);
});

test('orphanImports is not fooled by a name inside a longer one', () => {
  const text = [
    "import world from '../../assets/a/world.jpg';",
    '',
    '<Figure src={worldMap} />',
    '',
  ].join('\n');
  assert.deepEqual(orphanImports(text), ['world']);
});

test('removeImports takes the lines out and leaves one blank line', () => {
  const figure = '<Figure src={asterfall} alt="The observatory at Asterfall." />\n\n';
  const gone = FIGURES.replace(figure, '');
  const out = removeImports(gone, orphanImports(gone));
  assert.equal(out.includes('asterfall'), false);
  const kept = "import crownmere from '../../assets/atlas-experiment/crownmere.jpg';\n\n<Figure";
  assert.ok(out.includes(kept));
  assert.equal(removeImports(FIGURES, []), FIGURES);
});

test('removeImports collapses the gap when the whole import block goes', () => {
  const text = [
    '---',
    'title: "T"',
    '---',
    '',
    "import a from '../../assets/a.jpg';",
    "import b from '../../assets/b.jpg';",
    '',
    'Body.',
    '',
  ].join('\n');
  assert.equal(removeImports(text, ['a', 'b']), '---\ntitle: "T"\n---\n\nBody.\n');
});

/* ---- a new note ---- */

test('slugify keeps letters, digits and hyphens', () => {
  assert.equal(slugify('Painting a 100-megapixel world'), 'painting-a-100-megapixel-world');
  assert.equal(slugify('  What I’d do — again!  '), 'what-i-d-do-again');
  assert.equal(slugify('Café über alles'), 'cafe-uber-alles');
  assert.equal(slugify('...'), '');
  assert.equal(slugify(''), '');
});

test('slugify stops at 80 characters and never ends on a hyphen', () => {
  const slug = slugify('word '.repeat(40));
  assert.ok(slug.length <= 80);
  assert.equal(/^[a-z0-9][a-z0-9-]*$/.test(slug), true);
});

test('newNoteText writes front matter, a blank line and no body', () => {
  assert.equal(
    newNoteText('A new note', '2026-09-20'),
    '---\ntitle: "A new note"\ndescription: "TK"\npublished: 2026-09-20\nfeatured: false\ndraft: true\n---\n\n',
  );
  const front = readFrontmatter(newNoteText('A new note', '2026-09-20'));
  assert.equal(front.title, 'A new note');
  assert.equal(front.draft, true);
  assert.equal(front.published, '2026-09-20');
});

test('localDate is the day where the machine is, not where UTC is', () => {
  assert.equal(localDate(new Date(2026, 8, 20, 23, 30)), '2026-09-20');
  assert.equal(localDate(new Date(2026, 0, 2, 0, 5)), '2026-01-02');
});
