/**
 * The in-browser note editor. Only ever active under `astro dev`.
 *
 *   - `astro:config:setup` turns on source stamping (see stamp.mjs) and registers
 *     the dev-toolbar app that makes blocks editable.
 *   - `astro:server:setup` (a dev-only hook) answers the app's messages: read a
 *     note, splice new text into a block's range, rewrite a front-matter line
 *     or a component's attributes, add an image, and record where the cursor
 *     is for Claude.
 *
 * The MDX file stays the only source of truth. Every write is a plain file
 * write; Astro re-renders the page afterwards.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enable } from './stamp.mjs';

const NOTES_DIR = 'src/content/writing';
const ASSETS_DIR = 'src/assets';
const CONTEXT_FILE = '.astro/editor-context.json';
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

const hashOf = (text) => createHash('sha1').update(text).digest('hex').slice(0, 12);

/** Resolve a slug to a note file inside NOTES_DIR, or null. Never trusts the path. */
const noteFile = (root, slug) => {
  if (typeof slug !== 'string' || !SLUG.test(slug)) return null;
  for (const ext of ['.mdx', '.md']) {
    const file = resolve(root, NOTES_DIR, slug + ext);
    if (file.startsWith(resolve(root, NOTES_DIR)) && existsSync(file)) return file;
  }
  return null;
};

/**
 * Re-wrap markdown the way the notes are written by hand: ~95 columns, every
 * line after the first indented with `cont`. Paragraphs (blank-line
 * separated) each start with `indent`. Never breaks inside a word, so links
 * and inline code survive.
 */
const WRAP = 95;
const wrap = (text, cont = '', indent = cont) => {
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
 * A block's opening letters with markdown syntax stripped, so the page's text
 * and the file's source can be compared before anything is overwritten.
 */
const letters = (s) =>
  s
    .replace(/^\s*(?:#{1,6}\s+|(?:[-*]|\d+\.|>)\s+)/, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[^\p{L}]/gu, '')
    .slice(0, 12)
    .toLowerCase();

/* ----------------------------------------------------------------------------
   Block markers. A block's markdown may start with a list bullet, a number or
   a quote mark; the page sends the kind it wants and the file keeps its own
   spelling of it ("*" bullets, "3." numbering).
   ------------------------------------------------------------------------- */
const MARKER = /^(?:([-*])|(\d+)\.|(>))[ \t]+/;
const kindOf = (m) => (!m ? 'p' : m[3] ? 'quote' : m[2] ? 'ol' : 'ul');
const isHeading = (s) => /^#{1,6} /.test(s);

/** Lay one block out: marker, wrapped body, continuation lines prefixed. */
const layout = (md, indent) => {
  const m = MARKER.exec(md);
  const body = md.slice(m?.[0].length ?? 0);
  const marker = !m ? '' : m[3] ? '> ' : m[0].replace(/[ \t]+$/, ' ');
  const cont = m?.[3] ? indent + '> ' : indent + ' '.repeat(marker.length);
  return { marker, text: marker + wrap(body, cont), kind: kindOf(m), m };
};

/** What separates this block from the next one of the same kind. */
const separator = (kind, m, indent) =>
  kind === 'ul'
    ? '\n' + indent + m[0].replace(/[ \t]+$/, ' ')
    : kind === 'ol'
      ? `\n${indent}${Number(m[2]) + 1}. `
      : kind === 'quote'
        ? `\n${indent}>\n${indent}> `
        : '\n\n' + indent;

/** Make sure the range [s, e) sits between blank lines. */
const blankAround = (text, s, e) => {
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

const readTag = (src) => {
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

const writeTag = ({ name, attrs, selfClosing, multiline }) => {
  const parts = attrs.map((a) => (a.value === undefined ? a.name : `${a.name}=${a.value}`));
  if (multiline || parts.join(' ').length > 80) {
    return `<${name}\n${parts.map((p) => '  ' + p).join('\n')}\n${selfClosing ? '/>' : '>'}`;
  }
  return `<${name}${parts.length ? ' ' + parts.join(' ') : ''}${selfClosing ? ' />' : '>'}`;
};

const quote = (v) => `"${String(v).replace(/"/g, '”')}"`;

/** camelCase identifier for an image file, unique among the note's imports. */
const importName = (file, text) => {
  const base = basename(file, extname(file))
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[^a-zA-Z]+/, '');
  let name = (base || 'image').replace(/^./, (c) => c.toLowerCase());
  const taken = new Set([...text.matchAll(/^import\s+(\w+)\s+from/gm)].map((m) => m[1]));
  let candidate = name;
  for (let i = 2; taken.has(candidate); i++) candidate = name + i;
  return candidate;
};

const listImages = (root) => {
  const dir = resolve(root, ASSETS_DIR);
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (IMAGE.test(name)) out.push(relative(dir, full).split('\\').join('/'));
    }
  };
  walk(dir);
  return out.sort();
};

export default function noteEditor() {
  let root = process.cwd();

  return {
    name: 'note-editor',
    hooks: {
      'astro:config:setup': ({ command, config, addDevToolbarApp }) => {
        if (command !== 'dev') return;
        root = fileURLToPath(config.root);
        enable();
        addDevToolbarApp({
          id: 'note-editor',
          name: 'Edit note',
          // Astro accepts a built-in icon name or an SVG string; a pencil, drawn here.
          icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
          entrypoint: new URL('./app.js', import.meta.url),
        });
      },

      'astro:server:setup': ({ server, toolbar, logger }) => {
        // Astro answers every content change with a full page reload. For a
        // change the editor itself just wrote, that reload is a flash and a
        // lost caret for nothing: the browser already shows the text. Swallow
        // the reload that follows an editor write and ask the app to refresh
        // its blocks in place instead. Changes from anywhere else (Claude, an
        // editor) still reload as normal.
        let quietUntil = 0;
        const hot = server.environments.client.hot;
        const rawSend = hot.send.bind(hot);
        hot.send = (...args) => {
          const payload = typeof args[0] === 'string' ? null : args[0];
          if (payload?.type === 'full-reload' && Date.now() < quietUntil) {
            toolbar.send('note-editor:refresh', {});
            return;
          }
          return rawSend(...args);
        };

        const read = (slug) => {
          const file = noteFile(root, slug);
          if (!file) return null;
          const text = readFileSync(file, 'utf8');
          // Stamped offsets count from the start of the file, front matter included.
          return { file, text, hash: hashOf(text), base: 0 };
        };

        const reply = (event, payload) => toolbar.send(`note-editor:${event}`, payload);

        /**
         * Apply `edit(text, base) -> newText` to the note if the client's view of
         * the file is current. Every write goes through here.
         */
        const write = (msg, edit) => {
          const note = read(msg.slug);
          if (!note) return reply('error', { id: msg.id, message: `No note for “${msg.slug}”.` });
          if (msg.hash !== note.hash) return reply('stale', { id: msg.id, hash: note.hash });
          let next;
          try {
            next = edit(note.text, note.base);
          } catch (err) {
            logger.warn(`note-editor: ${err.message}`);
            return reply('error', { id: msg.id, message: err.message });
          }
          if (next === note.text)
            return reply('saved', { id: msg.id, hash: note.hash, changed: false });
          quietUntil = Date.now() + 2000;
          writeFileSync(note.file, next);
          reply('saved', { id: msg.id, hash: hashOf(next), changed: true });
        };

        /** The block's source slice, checked against what the browser thinks is there. */
        const slice = (text, base, msg) => {
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
        const lead = (text, start) => {
          const lineStart = text.lastIndexOf('\n', start - 1) + 1;
          const before = text.slice(lineStart, start);
          const indent = /^[ \t]*/.exec(before)[0];
          const quoted = /^[ \t]*>[ \t]?$/.test(before);
          return { lineStart, indent, quoted };
        };

        toolbar.on('note-editor:hello', (msg) => {
          const note = read(msg.slug);
          if (!note) return reply('error', { id: msg.id, message: `No note for “${msg.slug}”.` });
          reply('hello', { id: msg.id, hash: note.hash, file: relative(root, note.file) });
        });

        // Replace one block's source with new markdown. The text may start with
        // a marker ("- ", "2. ", "> ") or heading hashes; the block becomes that
        // kind, keeping the file's own bullet or number where the kind is the
        // same. With `after`, the block is split in two (Enter); with `delete`,
        // it is removed.
        toolbar.on('note-editor:replace', (msg) => {
          write(msg, (text, base) => {
            const { start, end, current } = slice(text, base, msg);
            const { lineStart, indent, quoted } = lead(text, start);
            const md = String(msg.text ?? '');
            if (msg.delete || (typeof msg.after !== 'string' && !md.trim())) {
              // Take the block, its indentation, and one of the blank lines around it.
              const after = /^\r?\n(\r?\n)?/.exec(text.slice(end))?.[0].length ?? 0;
              return text.slice(0, lineStart) + text.slice(end + after);
            }
            // Joining two blocks: the one after this is taken out first, so
            // this block's offsets still hold.
            if (msg.remove) {
              const r = slice(text, base, { ...msg.remove, expect: undefined });
              if (r.start <= end) throw new Error('can only join with a later block');
              const rl = text.lastIndexOf('\n', r.start - 1) + 1;
              const after = /^\r?\n(\r?\n)?/.exec(text.slice(r.end))?.[0].length ?? 0;
              text = text.slice(0, rl) + text.slice(r.end + after);
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
              const cont =
                block.kind === 'quote' ? indent + '> ' : indent + ' '.repeat(block.marker.length);
              body += sep + wrap(msg.after, cont);
            }
            let next = text.slice(0, from) + body + text.slice(end);
            const changed = kindOf(had) !== block.kind || isHeading(was) !== isHeading(spelled);
            return changed ? blankAround(next, from, from + body.length) : next;
          });
        });

        // Insert a new block after an existing one. `tight` puts it on the next
        // line (a new item in the same list) instead of after a blank line.
        toolbar.on('note-editor:insert-after', (msg) => {
          write(msg, (text, base) => {
            const { start, end } = slice(text, base, msg);
            const { indent, quoted } = lead(text, start);
            const md = String(msg.text ?? '');
            const block = layout(md, indent);
            // A quote after a quote stays in the same quote; an item after an
            // item (tight) in the same list.
            const sep =
              block.kind === 'quote' && quoted
                ? `\n${indent}>\n${indent}`
                : msg.tight
                  ? '\n' + indent
                  : '\n\n' + indent;
            return text.slice(0, end) + sep + block.text + text.slice(end);
          });
        });

        // Set, change or remove attributes on a component block (<Figure>,
        // <Callout>): `set` maps names to strings, true for a bare flag, or
        // null to remove.
        const setAttrs = (current, set) => {
          const tag = readTag(current);
          for (const [name, value] of Object.entries(set ?? {})) {
            const gone = value === null || value === undefined || value === false || value === '';
            const attr = { name, value: value === true ? undefined : quote(value) };
            const at = tag.attrs.findIndex((a) => a.name === name);
            if (at >= 0) tag.attrs.splice(at, 1, ...(gone ? [] : [attr]));
            else if (!gone) tag.attrs.push(attr);
          }
          // Keep flags after the values, the way the notes write them.
          tag.attrs.sort((a, b) => (a.value === undefined) - (b.value === undefined));
          return writeTag(tag) + current.slice(tag.end);
        };
        toolbar.on('note-editor:attrs', (msg) => {
          write(msg, (text, base) => {
            const { start, end, current } = slice(text, base, { ...msg, expect: undefined });
            return text.slice(0, start) + setAttrs(current, msg.set) + text.slice(end);
          });
        });

        // Title and description live in the front matter.
        toolbar.on('note-editor:frontmatter', (msg) => {
          write(msg, (text) => {
            const field =
              msg.field === 'title' ? 'title' : msg.field === 'description' ? 'description' : null;
            if (!field) throw new Error('only title and description can be edited here');
            const line = new RegExp(`^${field}:.*$`, 'm');
            if (!line.test(text)) throw new Error(`${field}: not found in front matter`);
            return text.replace(
              line,
              `${field}: ${JSON.stringify(String(msg.value ?? '').trim())}`,
            );
          });
        });

        // Images: the ones already under src/assets, and new ones from the page.
        toolbar.on('note-editor:assets', (msg) => {
          reply('assets', { id: msg.id, files: listImages(root) });
        });
        toolbar.on('note-editor:upload', (msg) => {
          try {
            const name = String(msg.name ?? 'image')
              .toLowerCase()
              .replace(/[^a-z0-9.]+/g, '-')
              .replace(/^-+|-+$/g, '');
            if (!IMAGE.test(name)) throw new Error('not an image file');
            if (!SLUG.test(String(msg.slug))) throw new Error('bad note');
            const dir = resolve(root, ASSETS_DIR, msg.slug);
            mkdirSync(dir, { recursive: true });
            let file = join(dir, name);
            for (let i = 2; existsSync(file); i++) {
              file = join(dir, name.replace(/(\.[^.]+)$/, `-${i}$1`));
            }
            writeFileSync(file, Buffer.from(String(msg.data), 'base64'));
            reply('uploaded', { id: msg.id, file: relative(resolve(root, ASSETS_DIR), file) });
          } catch (err) {
            reply('error', { id: msg.id, message: err.message });
          }
        });

        // A <Figure> for an image under src/assets, after the given block: the
        // import goes with the others at the top, the block after the anchor.
        toolbar.on('note-editor:figure', (msg) => {
          write(msg, (text, base) => {
            const file = String(msg.file ?? '');
            if (!IMAGE.test(file) || file.includes('..')) throw new Error('not an image');
            if (!existsSync(resolve(root, ASSETS_DIR, file))) throw new Error('image not found');
            const { end } = slice(text, base, msg);
            const rel = `../../assets/${file}`;
            const existing = new RegExp(
              `^import\\s+(\\w+)\\s+from\\s+'${rel.replace(/[.]/g, '\\.')}';?$`,
              'm',
            ).exec(text);
            const name = existing?.[1] ?? importName(file, text);
            const figure = `\n\n<Figure\n  src={${name}}\n  alt=${quote(msg.alt ?? '')}\n/>`;
            let next = text.slice(0, end) + figure + text.slice(end);
            if (!existing) {
              const line = `import ${name} from '${rel}';`;
              const imports = [...next.matchAll(/^import .*$/gm)];
              if (imports.length) {
                const last = imports.at(-1);
                const at = last.index + last[0].length;
                next = next.slice(0, at) + '\n' + line + next.slice(at);
              } else {
                const fm = /^---\n[\s\S]*?\n---\n/.exec(next);
                const at = fm ? fm[0].length : 0;
                next = next.slice(0, at) + '\n' + line + '\n' + next.slice(at);
              }
            }
            return next;
          });
        });

        // Where the cursor is, for the Claude Code prompt hook.
        toolbar.on('note-editor:context', (msg) => {
          const note = read(msg.slug);
          if (!note) return;
          const dir = join(root, '.astro');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          const start = note.base + (msg.block?.start ?? 0);
          const line = note.text.slice(0, start).split('\n').length;
          writeFileSync(
            join(root, CONTEXT_FILE),
            JSON.stringify(
              {
                updatedAt: new Date().toISOString(),
                file: relative(root, note.file),
                slug: msg.slug,
                url: msg.url,
                block: msg.block ? { line, text: msg.block.text } : null,
                selection: msg.selection || null,
              },
              null,
              2,
            ),
          );
        });
      },
    },
  };
}
