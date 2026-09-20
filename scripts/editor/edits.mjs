/**
 * The text work behind the note editor: source in, new source out. No file
 * system, no Astro, no messages. integration.mjs owns the server side (paths,
 * hashes, replies) and calls into here for anything that decides what the new
 * text actually looks like, so scripts/test-editor.mjs can exercise it all
 * directly.
 */
import { basename, extname } from 'node:path';

/**
 * Re-wrap markdown the way the notes are written by hand: ~95 columns, every
 * line after the first indented with `cont`. Paragraphs (blank-line
 * separated) each start with `indent`. Never breaks inside a word, so links
 * and inline code survive.
 */
const WRAP = 95;
export const wrap = (text, cont = '', indent = cont) => {
  const out = [];
  text.split('\n').forEach((para, i) => {
    let line = i === 0 ? '' : para ? indent : '';
    for (const word of para.split(' ')) {
      if (line.trim() && (line + ' ' + word).length > WRAP) {
        out.push(line);
        line = cont + word;
      } else {
        line = line.trim() ? line + ' ' + word : line + word;
      }
    }
    out.push(line);
  });
  return out.join('\n');
};

/**
 * A block's letters with the markdown taken off, so the page's text and the
 * file's source can be compared before anything is overwritten. All of them,
 * not just the opening words: a block whose end has changed underneath the
 * page is as wrong to overwrite as one whose start has. Tags go too, because
 * the page shows the words inside them and sends those back.
 */
export const letters = (s) =>
  s
    .replace(/^\s*(?:#{1,6}\s+|(?:[-*]|\d+\.|>)\s+)/, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}]/gu, '')
    .toLowerCase();

/* ----------------------------------------------------------------------------
   Block markers. A block's markdown may start with a list bullet, a number or
   a quote mark; the page sends the kind it wants and the file keeps its own
   spelling of it ("*" bullets, "3." numbering).
   ------------------------------------------------------------------------- */
export const MARKER = /^(?:([-*])|(\d+)\.|(>))[ \t]+/;
export const kindOf = (m) => (!m ? 'p' : m[3] ? 'quote' : m[2] ? 'ol' : 'ul');
export const isHeading = (s) => /^#{1,6} /.test(s);

/** Lay one block out: marker, wrapped body, continuation lines prefixed. */
export const layout = (md, indent) => {
  const m = MARKER.exec(md);
  const body = md.slice(m?.[0].length ?? 0);
  const marker = !m ? '' : m[3] ? '> ' : m[0].replace(/[ \t]+$/, ' ');
  const cont = m?.[3] ? indent + '> ' : indent + ' '.repeat(marker.length);
  return { marker, text: marker + wrap(body, cont), kind: kindOf(m), m };
};

/** What separates this block from the next one of the same kind. */
export const separator = (kind, m, indent) =>
  kind === 'ul'
    ? '\n' + indent + m[0].replace(/[ \t]+$/, ' ')
    : kind === 'ol'
      ? `\n${indent}${Number(m[2]) + 1}. `
      : kind === 'quote'
        ? `\n${indent}>\n${indent}> `
        : '\n\n' + indent;

/** Make sure the range [s, e) sits between blank lines. */
export const blankAround = (text, s, e) => {
  let before = text.slice(0, s);
  let after = text.slice(e);
  const lineOf = before.slice(before.lastIndexOf('\n') + 1);
  if (lineOf.trim()) {
    before += '\n\n' + lineOf.match(/^[ \t]*/)[0];
  } else if (before && !/\n[ \t]*\n[ \t]*$/.test(before)) {
    before += '\n' + lineOf;
  }
  if (after.trim() && !/^[ \t]*\n[ \t]*\n/.test(after)) {
    after = (/^[ \t]*\n/.test(after) ? '\n' : '\n\n') + after;
  }
  return before + text.slice(s, e) + after;
};

/* ----------------------------------------------------------------------------
   JSX attributes on a component's opening tag.
   ------------------------------------------------------------------------- */
const ATTR = /([A-Za-z][\w-]*)(?:=("(?:[^"\\]|\\.)*"|\{[^}]*\}))?/g;

export const readTag = (src) => {
  const m = /^<([A-Z]\w*)([^>]*?)(\/?)>/s.exec(src);
  if (!m) throw new Error('not a component block');
  const attrs = [...m[2].matchAll(ATTR)].map(([, name, value]) => ({ name, value }));
  return {
    name: m[1],
    attrs,
    selfClosing: Boolean(m[3]),
    multiline: m[2].includes('\n'),
    end: m[0].length,
  };
};

export const writeTag = ({ name, attrs, selfClosing, multiline }) => {
  const parts = attrs.map((a) => (a.value === undefined ? a.name : `${a.name}=${a.value}`));
  if (multiline || parts.join(' ').length > 80) {
    return `<${name}\n${parts.map((p) => '  ' + p).join('\n')}\n${selfClosing ? '/>' : '>'}`;
  }
  return `<${name}${parts.length ? ' ' + parts.join(' ') : ''}${selfClosing ? ' />' : '>'}`;
};

/** A JSX attribute's string value. A caption can end in a backslash; escape it. */
export const quote = (v) => `"${String(v).replace(/[\\"]/g, '\\$&')}"`;

/**
 * Set, change or remove attributes on a component block (<Figure>, <Callout>):
 * `set` maps names to strings, true for a bare flag, `{ expr: 'name' }` for a
 * JSX expression (`src={name}`), or null to remove.
 */
export const setAttrs = (current, set) => {
  const tag = readTag(current);
  for (const [name, value] of Object.entries(set ?? {})) {
    const gone = value === null || value === undefined || value === false || value === '';
    const written = value === true ? undefined : value?.expr ? `{${value.expr}}` : quote(value);
    const attr = { name, value: written };
    const at = tag.attrs.findIndex((a) => a.name === name);
    if (at >= 0) tag.attrs.splice(at, 1, ...(gone ? [] : [attr]));
    else if (!gone) tag.attrs.push(attr);
  }
  // Keep flags after the values, the way the notes write them.
  tag.attrs.sort((a, b) => (a.value === undefined) - (b.value === undefined));
  return writeTag(tag) + current.slice(tag.end);
};

/** camelCase identifier for an image file, unique among the note's imports. */
export const importName = (file, text) => {
  const base = basename(file, extname(file))
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[^a-zA-Z]+/, '');
  let name = (base || 'image').replace(/^./, (c) => c.toLowerCase());
  const taken = new Set([...text.matchAll(/^import\s+(\w+)\s+from/gm)].map((m) => m[1]));
  let candidate = name;
  for (let i = 2; taken.has(candidate); i++) candidate = name + i;
  return candidate;
};

/* ----------------------------------------------------------------------------
   Ranges. Every write from the page names a block by the character range the
   stamp gave it; these two turn that into something safe to splice.
   ------------------------------------------------------------------------- */

/** The block's source slice, checked against what the browser thinks is there. */
export const sliceBlock = (text, base, msg) => {
  const start = base + msg.start;
  const end = base + msg.end;
  if (!(start >= base && end <= text.length && start < end)) {
    throw new Error('block range is outside the file');
  }
  const current = text.slice(start, end);
  if (msg.expect && letters(current) !== letters(msg.expect)) {
    throw new Error('block on the page no longer matches the file; reload');
  }
  return { start, end, current };
};

/** Where the block's line begins, its indentation, and whether a quote mark precedes it. */
export const lead = (text, start) => {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const before = text.slice(lineStart, start);
  const indent = /^[ \t]*/.exec(before)[0];
  const quoted = /^[ \t]*>[ \t]?$/.test(before);
  return { lineStart, indent, quoted };
};

/* ----------------------------------------------------------------------------
   Fenced code blocks. The highlighter rebuilds a fence as a <pre> of its own
   and loses the source position on the way, so the ranges are found here by
   reading the file and handed to the page in order; the page lines them up
   with the <pre>s it rendered.
   ------------------------------------------------------------------------- */
const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})[ \t]*(\S*)[ \t]*(.*)$/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

export const scanFences = (text) => {
  const out = [];
  const lines = text.split('\n');
  let at = 0;
  let open = null;
  for (const line of lines) {
    if (!open) {
      const m = FENCE_OPEN.exec(line);
      // An opening fence with a marker; the info string is the language and
      // whatever follows it (`js title="x"`).
      if (m) open = { start: at + m[1].length, marker: m[2], lang: m[3], meta: m[4].trim() };
    } else {
      const m = FENCE_CLOSE.exec(line);
      if (m && m[1][0] === open.marker[0] && m[1].length >= open.marker.length) {
        out.push({
          start: open.start,
          end: at + line.indexOf(m[1]) + m[1].length,
          lang: open.lang,
          meta: open.meta,
        });
        open = null;
      }
    }
    at += line.length + 1;
  }
  // A fence nobody closed runs to the end of the file, the way a parser reads it.
  if (open) out.push({ start: open.start, end: text.length, lang: open.lang, meta: open.meta });
  return out;
};

/** The MDX comments left in a note (`{/* … *\/}`), for the Claude Code hook. */
export const mdxComments = (text) => {
  const out = [];
  for (const m of text.matchAll(/\{\/\*([\s\S]*?)\*\/\}/g)) {
    out.push({ line: text.slice(0, m.index).split('\n').length, text: m[1].trim() });
  }
  return out;
};

/* ----------------------------------------------------------------------------
   Front matter. Read as plain values for the page's note settings, written
   back one field at a time. The multi-line `links:`/`related:` blocks are
   never touched; nothing here can be asked for them.
   ------------------------------------------------------------------------- */
// Anchored at the very start of the file and no `m` flag, so a `title:` line
// in the body or inside a code fence is never what gets rewritten.
const FRONT = /^(---\n)([\s\S]*?)(\n---)/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// The order the notes write their fields in; a missing field is added after
// the last one present that comes before it here.
const ORDER = [
  'title',
  'description',
  'published',
  'updated',
  'featured',
  'draft',
  'sample',
  'tags',
  'image',
  'links',
  'related',
];
const EDITABLE = ['title', 'description', 'published', 'updated', 'draft', 'featured', 'tags'];

/** A YAML scalar as its plain value: JSON-quoted, single-quoted or bare. */
const unquote = (v) => {
  const s = String(v ?? '').trim();
  if (s.startsWith('"')) {
    try {
      return JSON.parse(s);
    } catch {
      return s.replace(/^"|"$/g, '').replace(/\\"/g, '"');
    }
  }
  if (s.startsWith("'")) {
    const inner = s.length > 1 && s.endsWith("'") ? s.slice(1, -1) : s.slice(1);
    return inner.replace(/''/g, "'");
  }
  return s;
};

/** The front matter's lines, and where they sit in the file. */
const frontLines = (text) => {
  const m = FRONT.exec(text);
  if (!m) throw new Error('no front matter in this note');
  return { lines: m[2].split('\n'), head: m[1].length, tail: m[1].length + m[2].length };
};

const fieldAt = (lines, field) => lines.findIndex((l) => l.startsWith(field + ':'));

/** How far a field's value runs: its own line plus any indented list lines. */
const fieldEnd = (lines, at) => {
  let end = at;
  while (end + 1 < lines.length && /^[ \t]+\S/.test(lines[end + 1])) end++;
  return end;
};

export const readFrontmatter = (text) => {
  const out = {
    title: '',
    description: '',
    published: null,
    updated: null,
    draft: false,
    featured: false,
    tags: [],
  };
  let lines;
  try {
    ({ lines } = frontLines(text));
  } catch {
    return out;
  }
  const value = (field) => {
    const at = fieldAt(lines, field);
    return at < 0 ? null : { at, raw: lines[at].slice(field.length + 1).trim() };
  };
  for (const field of ['title', 'description']) {
    const v = value(field);
    if (v) out[field] = unquote(v.raw);
  }
  for (const field of ['published', 'updated']) {
    const v = value(field);
    const date = v ? unquote(v.raw) : '';
    out[field] = DATE.test(date) ? date : null;
  }
  for (const field of ['draft', 'featured']) {
    const v = value(field);
    out[field] = unquote(v?.raw ?? '') === 'true';
  }
  const tags = value('tags');
  if (tags && tags.raw.startsWith('[')) {
    try {
      out.tags = JSON.parse(tags.raw).map((t) => String(t));
    } catch {
      out.tags = tags.raw
        .slice(1, -1)
        .split(',')
        .map((t) => unquote(t))
        .filter(Boolean);
    }
  } else if (tags && !tags.raw) {
    // The block form: `tags:` and then `  - a` on the lines under it.
    for (let i = tags.at + 1; i <= fieldEnd(lines, tags.at); i++) {
      const item = /^[ \t]+-[ \t]*(.*)$/.exec(lines[i]);
      if (item) out.tags.push(unquote(item[1]));
    }
  }
  return out;
};

/** The line a field is written as, or null to leave the value empty. */
const fieldLine = (field, value) => {
  if (field === 'title' || field === 'description') {
    const v = String(value ?? '').trim();
    if (field === 'title' && !v) throw new Error("title can't be empty");
    return `${field}: ${JSON.stringify(v)}`;
  }
  if (field === 'published' || field === 'updated') {
    const v = unquote(value ?? '');
    // `updated` is the one date a note can do without.
    if (!v && field === 'updated') return null;
    if (!DATE.test(v) || Number.isNaN(Date.parse(v))) {
      throw new Error(`${field} needs a date like 2026-09-20`);
    }
    return `${field}: ${v}`;
  }
  if (field === 'draft' || field === 'featured') return `${field}: ${value === true}`;
  const tags = (Array.isArray(value) ? value : [])
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((t) => JSON.stringify(t));
  return `tags: [${tags.join(', ')}]`;
};

export const setFrontmatter = (text, field, value) => {
  if (!EDITABLE.includes(field)) throw new Error(`${field} is not editable from the page`);
  const { lines, head, tail } = frontLines(text);
  const line = fieldLine(field, value);
  const at = fieldAt(lines, field);
  if (at >= 0) {
    // An empty `updated:` keeps the line, so the note still says it has one.
    lines.splice(at, fieldEnd(lines, at) - at + 1, line ?? `${field}:`);
  } else if (line === null) {
    return text;
  } else {
    // After the last field the notes would write before this one.
    const before = ORDER.slice(0, ORDER.indexOf(field));
    let after = -1;
    for (const name of before) {
      const seen = fieldAt(lines, name);
      if (seen >= 0) after = Math.max(after, fieldEnd(lines, seen));
    }
    lines.splice(after + 1, 0, line);
  }
  return text.slice(0, head) + lines.join('\n') + text.slice(tail);
};

/* ----------------------------------------------------------------------------
   The block edits themselves.
   ------------------------------------------------------------------------- */

/**
 * Replace one block's source with new markdown. The text may start with a
 * marker ("- ", "2. ", "> ") or heading hashes; the block becomes that kind,
 * keeping the file's own bullet or number where the kind is the same. With
 * `after`, the block is split in two (Enter); with `delete`, it is removed.
 */
export const applyReplace = (text, base, msg) => {
  const { start, end, current } = sliceBlock(text, base, msg);
  const { lineStart, indent, quoted } = lead(text, start);
  const md = String(msg.text ?? '');
  if (msg.delete || (typeof msg.after !== 'string' && !md.trim())) {
    // Take the block, its indentation, and one of the blank lines around it.
    const after = /^\r?\n(\r?\n)?/.exec(text.slice(end))?.[0].length ?? 0;
    return text.slice(0, lineStart) + text.slice(end + after);
  }
  // Joining with the block after this one (Backspace at its start): the text
  // sent is both together, so the next block is taken out. It is found here,
  // from the file as it is now, never from an offset the page remembered.
  if (msg.joinNext) {
    const rest = text.slice(end);
    const gap = /^(?:[ \t]*\r?\n)+/.exec(rest)?.[0] ?? '';
    const body = rest.slice(gap.length);
    // After a blank line, a paragraph runs to the next blank line; after a
    // single newline (a list), the next item is one line.
    const stop = /\n[ \t]*\n/.test(gap)
      ? /\r?\n[ \t]*\r?\n|$(?![\s\S])/.exec(body).index
      : (body.indexOf('\n') + 1 || body.length + 1) - 1;
    if (!body.slice(0, stop).trim()) throw new Error('nothing after this block to join');
    // The block being swallowed is found in the file, so check it is the one
    // the page meant, the same way the block being replaced is checked.
    if (msg.expectNext && letters(body.slice(0, stop)) !== letters(msg.expectNext)) {
      throw new Error('the block after this one is not the one on the page');
    }
    const tail = rest.slice(gap.length + stop);
    text = text.slice(0, end) + (tail || (rest.endsWith('\n') ? '\n' : ''));
  }
  // A quoted paragraph's range starts after its "> "; fold it in.
  const from = quoted ? lineStart + indent.length : start;
  const was = quoted ? '> ' + current : current;
  const had = MARKER.exec(was);
  const want = MARKER.exec(md);
  const spelled =
    had && want && kindOf(had) === kindOf(want) && kindOf(want) !== 'quote'
      ? had[0].replace(/[ \t]+$/, ' ') + md.slice(want[0].length)
      : md;
  const block = layout(spelled, indent);
  let body = block.text;
  if (typeof msg.after === 'string') {
    const sep = separator(block.kind, block.m, indent);
    const cont = block.kind === 'quote' ? indent + '> ' : indent + ' '.repeat(block.marker.length);
    body += sep + wrap(msg.after, cont);
  }
  let next = text.slice(0, from) + body + text.slice(end);
  const changed = kindOf(had) !== block.kind || isHeading(was) !== isHeading(spelled);
  return changed ? blankAround(next, from, from + body.length) : next;
};

/**
 * Insert a new block after an existing one. `tight` puts it on the next line
 * (a new item in the same list) instead of after a blank line; `atEnd` ignores
 * the range and puts it at the bottom of the file, which is how a note with no
 * body gets its first paragraph.
 */
export const applyInsertAfter = (text, base, msg) => {
  const md = String(msg.text ?? '');
  if (msg.atEnd) {
    return text.replace(/\s*$/, '') + '\n\n' + layout(md, '').text + '\n';
  }
  const { start, end } = sliceBlock(text, base, msg);
  const { indent, quoted } = lead(text, start);
  const block = layout(md, indent);
  // A quote after a quote stays in the same quote; an item after an item
  // (tight) in the same list.
  const sep =
    block.kind === 'quote' && quoted
      ? `\n${indent}>\n${indent}`
      : msg.tight
        ? '\n' + indent
        : '\n\n' + indent;
  return text.slice(0, end) + sep + block.text + text.slice(end);
};

/**
 * Replace a block's source verbatim: no wrapping, no markers. This is how the
 * page edits what it can't render as text it could send back — code fences,
 * tables, MDX comments, a component it has no card for.
 */
export const applyRaw = (text, base, msg) => {
  const { start, end } = sliceBlock(text, base, msg);
  const { lineStart } = lead(text, start);
  const body = String(msg.text ?? '').replace(/\r?\n$/, '');
  if (!body.trim()) {
    // Emptied out, so it goes the way a deleted block goes.
    const after = /^\r?\n(\r?\n)?/.exec(text.slice(end))?.[0].length ?? 0;
    return text.slice(0, lineStart) + text.slice(end + after);
  }
  return blankAround(text.slice(0, start) + body + text.slice(end), start, start + body.length);
};

/**
 * Swap a block with the one next to it. The page sends both ranges and the
 * direction; the gap between them has to be blank, so the two really are
 * neighbours and nothing is stepped over on the way.
 */
export const moveBlock = (text, base, msg) => {
  if (Number(msg.dir) !== 1 && Number(msg.dir) !== -1) throw new Error('no direction to move in');
  const here = sliceBlock(text, base, msg);
  const there = sliceBlock(text, base, { ...msg.other, expect: undefined });
  const down = Number(msg.dir) > 0;
  if (down ? there.start < here.end : there.end > here.start) {
    throw new Error(`nothing to move ${down ? 'down' : 'up'} into`);
  }
  const [first, second] = down ? [here, there] : [there, here];
  const gap = text.slice(first.end, second.start);
  // A quoted block's lines each carry their "> "; moving one out of or across
  // a quote would have to rewrite both blocks, and the page can do that as a
  // plain edit instead.
  if (gap.includes('>') || lead(text, first.start).quoted || lead(text, second.start).quoted) {
    throw new Error("can't move inside a quote");
  }
  if (gap.trim()) throw new Error('those blocks are not next to each other');
  const aM = MARKER.exec(first.current);
  const bM = MARKER.exec(second.current);
  let [above, below] = [second.current, first.current];
  // Two numbered items keep their numbers where they are, so the list still
  // counts up; only the words move.
  if (aM?.[2] && bM?.[2]) {
    above = aM[0] + second.current.slice(bM[0].length);
    below = bM[0] + first.current.slice(aM[0].length);
  }
  return text.slice(0, first.start) + above + gap + below + text.slice(second.end);
};

/* ----------------------------------------------------------------------------
   Imports left behind. Removing a figure leaves its `import` line; these find
   the ones nothing refers to any more and take them out.
   ------------------------------------------------------------------------- */
const IMPORT = /^import\s+(\w+)\s+from\s+'[^']*';?$/;

export const orphanImports = (text) => {
  const out = [];
  for (const m of text.matchAll(new RegExp(IMPORT.source, 'gm'))) {
    const rest = text.slice(0, m.index) + text.slice(m.index + m[0].length);
    if (!new RegExp(`\\b${m[1]}\\b`).test(rest)) out.push(m[1]);
  }
  return out;
};

export const removeImports = (text, names) => {
  const drop = new Set(names ?? []);
  if (!drop.size) return text;
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = IMPORT.exec(lines[i]);
    if (m && drop.has(m[1])) {
      // Taking the line out can leave the blank line above it sitting on the
      // blank line below; keep one of the two.
      if (out.length && !out.at(-1).trim() && lines[i + 1] !== undefined && !lines[i + 1].trim()) {
        i++;
      }
      continue;
    }
    out.push(lines[i]);
  }
  return out.join('\n');
};

/* ----------------------------------------------------------------------------
   A new note.
   ------------------------------------------------------------------------- */

/** Today where the machine is, not where UTC is. */
export const localDate = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const slugify = (title) =>
  String(title ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');

export const newNoteText = (title, today) =>
  [
    '---',
    `title: ${JSON.stringify(String(title ?? '').trim())}`,
    'description: "TK"',
    `published: ${today}`,
    'featured: false',
    'draft: true',
    '---',
    '',
    '',
  ].join('\n');
