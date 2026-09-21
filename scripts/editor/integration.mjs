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
 * The text work itself lives in edits.mjs, as plain functions with tests. This
 * file is the part that touches the disk: paths, hashes, replies, history.
 *
 * The MDX file stays the only source of truth. Every write is a plain file
 * write; Astro re-renders the page afterwards.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enable } from './stamp.mjs';
import {
  applyInsertAfter,
  applyRaw,
  applyReplace,
  importName,
  localDate,
  mdxComments,
  moveBlock,
  newNoteText,
  orphanImports,
  quote,
  readFrontmatter,
  removeImports,
  scanFences,
  setAttrs,
  setFrontmatter,
  sliceBlock,
  slugify,
} from './edits.mjs';

const NOTES_DIR = 'src/content/writing';
const ASSETS_DIR = 'src/assets';
const CONTEXT_FILE = '.astro/editor-context.json';
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
const HISTORY = 100;

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

/** Every note, for the internal-link picker. Files starting `__` are drafts of mine. */
const listNotes = (root) => {
  const dir = resolve(root, NOTES_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /\.mdx?$/.test(name) && !name.startsWith('__'))
    .map((name) => {
      const front = readFrontmatter(readFileSync(join(dir, name), 'utf8'));
      const slug = basename(name, extname(name));
      return { slug, title: front.title || slug, draft: front.draft };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
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
        //
        // Astro can answer one content change with more than one reload, so
        // every reload within two seconds of the last write that changed the
        // file is taken to be that write's, and carries the write's id. A
        // change from anywhere else in that window is caught by the next
        // write's hash check instead.
        let last = null;
        // The hash of each note as the editor last wrote it, so a change on
        // disk can be told apart from the editor's own write.
        const written = new Map();
        const hot = server.environments.client.hot;
        const rawSend = hot.send.bind(hot);
        hot.send = (...args) => {
          const payload = typeof args[0] === 'string' ? null : args[0];
          if (payload?.type === 'full-reload' && last && last.until > Date.now()) {
            toolbar.send('note-editor:refresh', last.shape);
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
         * Undo history, per file, for as long as the dev server runs. A write
         * that finds the file changed underneath it replies `stale` and stops
         * before it gets here, so the stacks survive an edit from Claude or
         * from a text editor: that edit is just another state of the file, and
         * an undo after it puts back what was there before it, which is what
         * you mean when you ask for one.
         */
        const past = new Map();
        const future = new Map();
        const remember = (stack, file, text) => {
          const kept = stack.get(file) ?? [];
          kept.push(text);
          if (kept.length > HISTORY) kept.shift();
          stack.set(file, kept);
        };

        /**
         * Apply `edit(text, base, file) -> newText` to the note if the client's
         * view of the file is current. Every write goes through here.
         */
        /**
         * What the page needs to know about the file after a write: its hash,
         * where the code fences are (the highlighter loses their positions, so
         * they are read off the file and matched up in order on the page), and
         * the front matter. Sent with every `saved` and `refresh`, so the page
         * never has to ask again mid-refresh.
         */
        const shape = (text) => ({
          hash: hashOf(text),
          fences: scanFences(text),
          frontmatter: readFrontmatter(text),
        });

        const write = (msg, edit, { history = true, extra } = {}) => {
          const note = read(msg.slug);
          if (!note) return reply('error', { id: msg.id, message: `No note for “${msg.slug}”.` });
          // The file moved on since the page last saw it (a change from outside
          // that the page has not taken yet): send its shape, and the page
          // refreshes in place and sends the write again.
          if (msg.hash !== note.hash) return reply('stale', { id: msg.id, outside: true, ...shape(note.text) });
          let next;
          try {
            next = edit(note.text, note.base, note.file);
          } catch (err) {
            logger.warn(`note-editor: ${err.message}`);
            return reply('error', { id: msg.id, message: err.message });
          }
          if (next === note.text)
            return reply('saved', { id: msg.id, hash: note.hash, changed: false, ...extra });
          if (history) {
            remember(past, note.file, note.text);
            future.delete(note.file);
          }
          const after = shape(next);
          last = { id: msg.id, until: Date.now() + 2000, shape: { id: msg.id, ...after } };
          written.set(note.file, after.hash);
          writeFileSync(note.file, next);
          reply('saved', { id: msg.id, ...after, changed: true, ...extra });
        };

        // A note the page has said hello for is watched. A change to it that
        // the editor did not write (Claude, a text editor) is sent to the page
        // as a refresh flagged `outside`, and the reload Astro sends for it is
        // swallowed like the editor's own: the page updates in place, keeps
        // its caret, and marks what changed. Anything else still reloads.
        const open = new Set();
        server.watcher.on('change', (path) => {
          const file = resolve(path);
          if (!open.has(file) || !existsSync(file)) return;
          const text = readFileSync(file, 'utf8');
          const current = shape(text);
          if (written.get(file) === current.hash) return;
          written.set(file, current.hash);
          last = { id: 0, until: Date.now() + 2000, shape: { id: 0, outside: true, ...current } };
          // Astro is about to re-render; let it, then ask for the in-place refresh.
          setTimeout(() => toolbar.send('note-editor:refresh', last.shape), 150);
        });

        toolbar.on('note-editor:hello', (msg) => {
          const note = read(msg.slug);
          if (!note) return reply('error', { id: msg.id, message: `No note for “${msg.slug}”.` });
          open.add(note.file);
          if (!written.has(note.file)) written.set(note.file, note.hash);
          reply('hello', { id: msg.id, file: relative(root, note.file), ...shape(note.text) });
        });

        // The source of one range, for editing a block as raw markdown.
        toolbar.on('note-editor:source', (msg) => {
          const note = read(msg.slug);
          if (!note) return reply('error', { id: msg.id, message: `No note for “${msg.slug}”.` });
          try {
            const { current } = sliceBlock(note.text, note.base, { ...msg, expect: undefined });
            reply('source', { id: msg.id, hash: note.hash, text: current });
          } catch (err) {
            reply('error', { id: msg.id, message: err.message });
          }
        });

        toolbar.on('note-editor:replace', (msg) =>
          write(msg, (text, base) => applyReplace(text, base, msg)),
        );

        toolbar.on('note-editor:insert-after', (msg) =>
          write(msg, (text, base) => applyInsertAfter(text, base, msg)),
        );

        // A block's source put back verbatim: fences, tables, MDX comments,
        // anything the editor shows as text rather than as prose.
        toolbar.on('note-editor:raw', (msg) =>
          write(msg, (text, base) => applyRaw(text, base, msg)),
        );

        // Swap a block with its neighbour.
        toolbar.on('note-editor:move', (msg) =>
          write(msg, (text, base) => moveBlock(text, base, msg)),
        );

        // Undo and redo go through the hash check like any other write, but
        // step through the history instead of adding to it.
        const travel = (msg, back) => {
          const [from, to] = back ? [past, future] : [future, past];
          // An undo that starts from text the editor never wrote is undoing a
          // change made outside it (Claude, an editor); the page says so.
          const note = read(msg.slug);
          const outside = Boolean(note && written.has(note.file) && written.get(note.file) !== note.hash);
          write(
            msg,
            (text, _base, file) => {
              const kept = from.get(file);
              if (!kept?.length) throw new Error(`nothing to ${back ? 'undo' : 'redo'}`);
              remember(to, file, text);
              return kept.pop();
            },
            { history: false, extra: { ...(back ? { undone: true } : { redone: true }), outside } },
          );
        };
        toolbar.on('note-editor:undo', (msg) => travel(msg, true));
        toolbar.on('note-editor:redo', (msg) => travel(msg, false));

        // Set, change or remove attributes on a component block (<Figure>,
        // <Callout>).
        toolbar.on('note-editor:attrs', (msg) => {
          write(msg, (text, base) => {
            const { start, end, current } = sliceBlock(text, base, { ...msg, expect: undefined });
            return text.slice(0, start) + setAttrs(current, msg.set) + text.slice(end);
          });
        });

        // The note's own settings live in the front matter.
        toolbar.on('note-editor:frontmatter', (msg) => {
          write(msg, (text) => setFrontmatter(text, String(msg.field ?? ''), msg.value));
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
        // With `replace`, the block in the range is an existing figure and only
        // its `src` changes; its alt, caption and layout are left alone.
        toolbar.on('note-editor:figure', (msg) => {
          write(msg, (text, base) => {
            const file = String(msg.file ?? '');
            if (!IMAGE.test(file) || file.includes('..')) throw new Error('not an image');
            if (!existsSync(resolve(root, ASSETS_DIR, file))) throw new Error('image not found');
            const { start, end, current } = sliceBlock(text, base, msg);
            const rel = `../../assets/${file}`;
            const existing = new RegExp(
              `^import\\s+(\\w+)\\s+from\\s+'${rel.replace(/[.]/g, '\\.')}';?$`,
              'm',
            ).exec(text);
            const name = existing?.[1] ?? importName(file, text);
            let next;
            if (msg.replace) {
              const tag = setAttrs(current, { src: { expr: name } });
              next = text.slice(0, start) + tag + text.slice(end);
            } else {
              const figure = `\n\n<Figure\n  src={${name}}\n  alt=${quote(msg.alt ?? '')}\n/>`;
              next = text.slice(0, end) + figure + text.slice(end);
            }
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

        // Every note, for linking one to another.
        toolbar.on('note-editor:notes', (msg) => {
          reply('notes', { id: msg.id, notes: listNotes(root) });
        });

        // A new note, from its title alone. Not a write: there is no file yet.
        toolbar.on('note-editor:create', (msg) => {
          try {
            const title = String(msg.title ?? '').trim();
            const slug = slugify(title);
            if (!slug || !SLUG.test(slug)) throw new Error('that title makes no slug');
            if (noteFile(root, slug)) throw new Error(`“${slug}” is taken`);
            const file = resolve(root, NOTES_DIR, slug + '.mdx');
            if (!file.startsWith(resolve(root, NOTES_DIR))) throw new Error('bad slug');
            writeFileSync(file, newNoteText(title, localDate()));
            reply('created', { id: msg.id, slug, file: relative(root, file) });
          } catch (err) {
            reply('error', { id: msg.id, message: err.message });
          }
        });

        // Imports left behind by a removed figure: what they are, and taking
        // them out.
        // Whether the note differs from what is committed: publishing is a push.
        toolbar.on('note-editor:git', (msg) => {
          const note = read(msg.slug);
          if (!note) return reply('git', { id: msg.id, state: 'unknown' });
          try {
            const out = execFileSync('git', ['status', '--porcelain', '--', note.file], {
              cwd: root,
              encoding: 'utf8',
              timeout: 3000,
            });
            const code = out.slice(0, 2);
            reply('git', {
              id: msg.id,
              state: !out.trim() ? 'clean' : code.includes('?') ? 'untracked' : 'modified',
            });
          } catch {
            reply('git', { id: msg.id, state: 'unknown' });
          }
        });

        toolbar.on('note-editor:check', (msg) => {
          const note = read(msg.slug);
          if (!note) return reply('error', { id: msg.id, message: `No note for “${msg.slug}”.` });
          reply('check', { id: msg.id, orphans: orphanImports(note.text) });
        });
        toolbar.on('note-editor:tidy', (msg) => {
          write(msg, (text) => removeImports(text, orphanImports(text)));
        });

        // Where the cursor is, for the Claude Code prompt hook.
        toolbar.on('note-editor:context', (msg) => {
          const note = read(msg.slug);
          if (!note) return;
          const dir = join(root, '.astro');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          const lineAt = (offset) => note.text.slice(0, note.base + offset).split('\n').length;
          const line = lineAt(msg.block?.start ?? 0);
          // A heading's scope runs to the next heading of its level or higher;
          // the page sends the range, the lines are counted here.
          const section = msg.section
            ? {
                title: msg.section.title,
                from: lineAt(msg.section.start),
                to: lineAt(Math.max(msg.section.start, msg.section.end - 1)),
              }
            : null;
          writeFileSync(
            join(root, CONTEXT_FILE),
            JSON.stringify(
              {
                updatedAt: new Date().toISOString(),
                file: relative(root, note.file),
                slug: msg.slug,
                url: msg.url,
                scope: msg.selection ? 'selection' : section ? 'section' : msg.block ? 'block' : null,
                block: msg.block ? { line, text: msg.block.text } : null,
                section,
                selection: msg.selection || null,
                // The `{/* … */}` notes left in the file, so a prompt can be
                // "do the ones I left for you".
                notes: mdxComments(note.text),
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
