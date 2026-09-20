/**
 * Dev-toolbar app: edit a note in place, the way a Ghost post is edited.
 *
 * Toggle it on from Astro's dev toolbar and every paragraph, heading, list
 * item, quote, callout, caption, the title and the description become
 * editable. Each block knows its character range in the MDX file
 * (`data-src`, stamped by stamp.mjs; code fences get theirs from the server,
 * because the highlighter drops them); when you pause, the block's new text
 * is written into exactly that range. Astro re-renders the page; the reload
 * it would send is held back (integration.mjs) and this app swaps the fresh
 * blocks in instead, with the caret where it was. Changes from anywhere else
 * still reload the page, and the blocks they touched flash gold afterwards.
 *
 * Writing: markdown converts as you type (**bold**, *italic*, `code`,
 * [text](url), ~~struck~~; "## ", "- ", "1. ", "> " at the start of a block;
 * "---" for a divider; curly quotes and an ellipsis as you go). Select text
 * for a formatting bar. Type "/" in an empty block, or click its "+", for
 * headings, lists, quotes, dividers, images, callouts and a note to Claude.
 * "[[" links to another note. Enter splits, Backspace at the start of a
 * heading, item or quote makes it a paragraph, arrow keys move between
 * blocks, ⌘⇧↑/↓ moves a block. A figure, divider, code block, table or
 * comment is a card: click to select, Enter to edit its source, Backspace to
 * remove. ⌘Z undoes the last write to the file, ⌘⇧Z redoes it. ⌘. opens the
 * note's settings and a ready-to-publish checklist; ⌘/ lists every shortcut.
 */
import {
  blockMarkdown,
  htmlToBlocks,
  inlineToHtml,
  isUrl,
  shortcutAt,
  textToBlocks,
  toMarkdown,
} from './markdown.js';
import { createUi } from './ui.js';

const GOLD = '#d3a74e';
const KEY_ON = 'note-editor:on';
const KEY_STASH = 'note-editor:stash';
const KEY_SCROLL = 'note-editor:scroll';
const KEY_TEXTS = 'note-editor:texts';
const KEY_FOCUS = 'note-editor:focus';
const IDLE_MS = 2000;
const EDITABLE = 'P, H1, H2, H3, H4, LI, FIGCAPTION';
const CARD = 'FIGURE, HR, PRE, TABLE, .note-editor-comment';
const CALLOUT_LABELS = {
  hypothesis: 'Current hypothesis',
  surprise: 'What surprised me',
  failed: 'What didn’t work',
  update: 'Update',
  note: 'Note',
};
const TK = /\bTK\b/g;

const slugOf = () => /^\/writing\/([a-z0-9-]+)\/?$/.exec(location.pathname)?.[1] ?? null;
const escapeHtml = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* ----------------------------------------------------------------------------
   Caret helpers: character offsets within a block's text.
   ------------------------------------------------------------------------- */
const caretOffset = (el) => {
  const sel = getSelection();
  if (!sel?.rangeCount || !el.contains(sel.anchorNode)) return null;
  const r = sel.getRangeAt(0).cloneRange();
  r.selectNodeContents(el);
  r.setEnd(sel.anchorNode, sel.anchorOffset);
  return r.toString().replace(/\u200B/g, '').length;
};

/** A range over the characters [from, to) of a block's text. */
const rangeOfChars = (el, from, to) => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let seen = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const next = seen + node.data.length;
    if (!started && from <= next) {
      range.setStart(node, from - seen);
      started = true;
    }
    if (started && to <= next) {
      range.setEnd(node, to - seen);
      return range;
    }
    seen = next;
  }
  if (!started) range.selectNodeContents(el);
  else range.setEnd(el, el.childNodes.length);
  return range;
};

const placeCaret = (el, offset) => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let left = offset;
  let node = walker.nextNode();
  if (!node) {
    el.focus({ preventScroll: true });
    return;
  }
  while (left > node.data.length) {
    const next = walker.nextNode();
    if (!next) {
      left = node.data.length;
      break;
    }
    left -= node.data.length;
    node = next;
  }
  const range = document.createRange();
  range.setStart(node, Math.min(left, node.data.length));
  range.collapse(true);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  el.focus({ preventScroll: true });
};

/** Split a block's contents at the caret: two markdown strings. */
const splitAtCaret = (el) => {
  const at = getSelection().getRangeAt(0);
  const before = document.createRange();
  before.selectNodeContents(el);
  before.setEnd(at.startContainer, at.startOffset);
  const after = document.createRange();
  after.selectNodeContents(el);
  after.setStart(at.endContainer, at.endOffset);
  const md = (range) => {
    const box = document.createElement('div');
    box.append(range.cloneContents());
    return toMarkdown(box)
      .replace(/[ \t]+/g, ' ')
      .trim();
  };
  return [md(before), md(after)];
};

/** The caret's rectangle, or the block's when the block is empty. */
const caretRect = (el) => {
  const sel = getSelection();
  if (!sel?.rangeCount) return el.getBoundingClientRect();
  const rects = sel.getRangeAt(0).getClientRects();
  return rects.length ? rects[rects.length - 1] : el.getBoundingClientRect();
};
const onFirstLine = (el) => {
  const r = caretRect(el);
  const b = el.getBoundingClientRect();
  return r.top - b.top < r.height * 0.8;
};
const onLastLine = (el) => {
  const r = caretRect(el);
  const b = el.getBoundingClientRect();
  return b.bottom - r.bottom < r.height * 0.8;
};
const selectionInside = (el) => {
  const sel = getSelection();
  return Boolean(sel?.rangeCount && el.contains(sel.anchorNode) && el.contains(sel.focusNode));
};

const wordCount = (text) =>
  (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? []).length;

/** Curly quote for a straight one, given the character before it. */
const smartQuote = (ch, prev) => {
  const opening = !prev || /[\s(\[{"'“‘—–\-]/.test(prev);
  if (ch === '"') return opening ? '“' : '”';
  return opening ? '‘' : '’';
};

const SHORTCUTS = [
  ['⌘B · ⌘I · ⌘E', 'Bold · italic · inline code'],
  ['⌘⇧X', 'Strikethrough'],
  ['⌘K', 'Link — with nothing selected, paste a URL; type a title to link a note'],
  ['[[', 'Link to another note, as you type'],
  ['⌘⌥0 · ⌘⌥2 · ⌘⌥3', 'Paragraph · heading · subheading'],
  ['⌘⇧7 · ⌘⇧8 · ⌘⇧9', 'Numbered list · bullet list · quote'],
  ['/ or +', 'Menu in an empty block: heading, list, quote, divider, image, callout, note to Claude'],
  ['Enter', 'New block (or leave a list or quote from an empty line); on a card, edit it'],
  ['⇧Enter', 'Line break inside the block'],
  ['⌘Enter', 'New paragraph after whatever this block sits in'],
  ['Backspace', 'At the start: heading, item or quote back to a paragraph, or join with the block above'],
  ['↑ ↓ ← →', 'Between blocks, onto cards'],
  ['⌘⇧↑ · ⌘⇧↓', 'Move the block up or down'],
  ['⌘D', 'Duplicate the block'],
  ['⌘Z · ⌘⇧Z', 'Undo · redo the last change to the file'],
  ['⌘S', 'Save now (it saves when you pause anyway)'],
  ['⌘.', 'Note settings and the ready-to-publish checklist'],
  ['⌘⌥N', 'New note'],
  ['⌘⇧F', 'Focus mode: dim everything but the block you are in'],
  ['⌘/', 'This list'],
  ['Escape', 'Close what is open, then leave the block'],
];

/* ----------------------------------------------------------------------------
   The app
   ------------------------------------------------------------------------- */
export default {
  init(canvas, app, server) {
    const slug = slugOf();
    const article = document.querySelector('article');
    const isNote = Boolean(slug && article?.querySelector('.prose'));
    const ui = createUi();

    // Notes left for Claude render as cards in dev; readers never see them.
    const commentStyle = document.createElement('style');
    commentStyle.id = 'note-editor-comment-style';
    commentStyle.textContent = `.note-editor-comment { display: none; }`;
    document.head.append(commentStyle);

    let msgId = 0;
    const pending = new Map(); // id -> { block, kind, then }
    const sendRaw = (event, payload, meta) => {
      const id = ++msgId;
      if (meta) pending.set(id, meta);
      server.send(`note-editor:${event}`, { id, slug, ...payload });
      return id;
    };
    server.on('note-editor:created', async (msg) => {
      pending.delete(msg.id);
      sessionStorage.setItem(KEY_ON, '1');
      // Astro learns about the new file a moment after it is written; go
      // once the page actually renders rather than land on a 404.
      const url = `/writing/${msg.slug}/`;
      for (let i = 0; i < 20; i++) {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok && (await res.text()).includes('note-header')) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 250));
      }
      location.href = url;
    });

    /** Ask for a title and make the note. Works on any page in dev. */
    const newNote = () => {
      ui.mount();
      const rect = {
        left: innerWidth / 2 - 150,
        right: innerWidth / 2 + 150,
        top: 72,
        bottom: 72,
        width: 300,
        height: 0,
      };
      ui.toolbar.prompt(
        rect,
        {
          placeholder: 'Title for the new note, Enter to create it',
          onSubmit: (title) => {
            if (!title) return;
            sendRaw('create', { title });
          },
          onCancel: () => ui.toolbar.hide(),
        },
        { below: true },
      );
    };

    if (!isNote) {
      // Not a note page: the toolbar button offers a new note and nothing else.
      app.onToggled(({ state }) => {
        if (!state) return;
        newNote();
        app.toggleState({ state: false });
      });
      server.on('note-editor:error', (msg) => console.warn('[note-editor]', msg.message));
      document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === 'KeyN') {
          e.preventDefault();
          newNote();
        }
      });
      return;
    }

    let hash = null;
    let on = false;
    let file = '';
    let fences = [];
    let frontmatter = {};
    let notesList = null;
    const timers = new Map(); // block -> timeout
    const dirty = new Set();

    /* ---- chrome: a small status pill in the toolbar's shadow root ---- */
    const pill = document.createElement('div');
    pill.hidden = true;
    pill.innerHTML = `
      <style>
        div.pill { position: fixed; top: 12px; right: 12px; z-index: 2147483000;
          font: 500 12px/1 system-ui, sans-serif; letter-spacing: .02em; color: #1c1b19;
          background: ${GOLD}; padding: 7px 10px; border-radius: 999px; cursor: pointer;
          box-shadow: 0 1px 6px rgba(0,0,0,.25); display: flex; gap: 8px; align-items: center;
          transition: background .2s; }
        div.pill:hover { background: color-mix(in srgb, ${GOLD} 85%, white); }
        div.pill .state { opacity: .75; }
        div.pill .state.is-note { opacity: 1; font-weight: 600; }
        div.pill .words, div.pill .tk { opacity: .6; font-weight: 400; }
        div.pill .tk:not(:empty) { opacity: 1; font-weight: 600; }
        div.pill .tk:not(:empty)::before { content: '·'; margin-right: 8px; font-weight: 400; opacity: .6; }
      </style>
      <div class="pill" title="Note settings, shortcuts, new note"><strong>Editing</strong> <span class="state">Saved</span>
        <span class="words"></span><span class="tk"></span></div>`;
    canvas.append(pill);
    const pillEl = pill.querySelector('.pill');
    const stateEl = pill.querySelector('.state');
    const wordsEl = pill.querySelector('.words');
    const tkEl = pill.querySelector('.tk');
    let stateTimer = null;
    /** The save state; with `ms`, a passing message that gives way to it. */
    const setState = (text, ms = 0) => {
      clearTimeout(stateTimer);
      stateEl.textContent = text;
      stateEl.classList.toggle('is-note', ms > 0);
      if (ms) stateTimer = setTimeout(() => setState(dirty.size ? 'Unsaved' : 'Saved'), ms);
    };
    let wordsTimer = null;
    const countWords = () => {
      clearTimeout(wordsTimer);
      wordsTimer = setTimeout(updateWords, 400);
    };
    const updateWords = () => {
      const prose = article.querySelector('.prose');
      if (!prose) return;
      const total = wordCount(prose.textContent);
      const sel = getSelection();
      const picked =
        sel && !sel.isCollapsed && article.contains(sel.anchorNode) ? wordCount(sel.toString()) : 0;
      wordsEl.textContent = picked
        ? `${picked.toLocaleString()} of ${total.toLocaleString()} words`
        : `${total.toLocaleString()} words`;
      markTK();
    };

    /* ---- TK: the placeholders still to fill in, counted and lit ---- */
    let tkRanges = [];
    const markTK = () => {
      tkRanges = [];
      const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.parentElement?.closest('.note-editor-source, .endmatter')) continue;
        for (const m of node.data.matchAll(TK)) {
          const r = document.createRange();
          r.setStart(node, m.index);
          r.setEnd(node, m.index + 2);
          tkRanges.push(r);
        }
      }
      tkEl.textContent = tkRanges.length ? `${tkRanges.length} TK` : '';
      if (globalThis.CSS?.highlights) {
        CSS.highlights.set('note-editor-tk', new Highlight(...tkRanges));
      }
    };
    /** Select the next TK after the caret, wrapping round. */
    const nextTK = () => {
      if (!tkRanges.length) return;
      const sel = getSelection();
      const from = sel?.rangeCount ? sel.getRangeAt(0) : null;
      let target = tkRanges.find(
        (r) => !from || r.compareBoundaryPoints(Range.START_TO_START, from) > 0,
      );
      if (!target || (from && target.compareBoundaryPoints(Range.START_TO_START, from) === 0)) {
        target = tkRanges[0];
      }
      const block = target.startContainer.parentElement?.closest('[contenteditable="true"]');
      block?.focus({ preventScroll: true });
      sel.removeAllRanges();
      sel.addRange(target);
      target.startContainer.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    tkEl.addEventListener('click', (e) => {
      e.stopPropagation();
      nextTK();
    });

    /* ---- page styles for editable blocks and cards ---- */
    const style = document.createElement('style');
    style.id = 'note-editor-style';
    style.textContent = `
      [contenteditable="true"] { outline: 1px dashed transparent; outline-offset: 6px; border-radius: 2px;
        transition: outline-color .15s; cursor: text; }
      [contenteditable="true"]:hover { outline-color: color-mix(in srgb, ${GOLD} 45%, transparent); }
      [contenteditable="true"]:focus { outline: 2px solid ${GOLD}; }
      [contenteditable="true"] a { cursor: text; }
      .note-editor-card { cursor: pointer; outline: 1px dashed transparent; outline-offset: 6px; transition: outline-color .15s; }
      .note-editor-card:hover { outline-color: color-mix(in srgb, ${GOLD} 45%, transparent); }
      .note-editor-card.is-selected, .note-editor-card:focus { outline: 2px solid ${GOLD}; }
      .note-editor-card:focus-visible { outline: 2px solid ${GOLD}; }
      .table-wrap:has(> .note-editor-card) { overflow: visible; }
      .note-editor-new:empty::before, [contenteditable="true"]:is(p, li, h1, h2, h3, figcaption):empty::before {
        content: attr(data-placeholder); color: color-mix(in srgb, currentColor 40%, transparent); pointer-events: none; }
      .note-editor-drop { outline: 2px dashed ${GOLD} !important; outline-offset: 8px; }
      .note-editor-comment { display: block; margin: 1.5rem 0; padding: .6rem .9rem .7rem; border-radius: 4px;
        background: color-mix(in srgb, ${GOLD} 14%, transparent); border-left: 3px solid ${GOLD};
        font: 400 .9rem/1.5 ui-sans-serif, system-ui, sans-serif; white-space: pre-wrap; }
      .note-editor-comment::before { content: 'Note to Claude'; display: block; font-size: .7rem; font-weight: 600;
        letter-spacing: .06em; text-transform: uppercase; color: ${GOLD}; margin-bottom: .2rem; }
      .note-editor-source { margin: 1.5rem 0; }
      .note-editor-source textarea { display: block; box-sizing: border-box; width: 100%; min-height: 3.2em; resize: vertical;
        padding: .7rem .9rem; border: 2px solid ${GOLD}; border-radius: 4px; background: var(--surface, #f4f2ed); color: inherit;
        font: .85rem/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; tab-size: 2; white-space: pre; overflow-wrap: normal; overflow-x: auto; }
      .note-editor-source textarea:focus { outline: none; }
      .note-editor-source .lang { display: flex; gap: .5rem; align-items: baseline; margin-bottom: .35rem;
        font: .75rem ui-sans-serif, system-ui, sans-serif; color: var(--ink-muted, #777); }
      .note-editor-source .lang input { all: unset; width: 8em; padding: 2px 6px; border-radius: 3px;
        background: color-mix(in srgb, ${GOLD} 18%, transparent); font: inherit; color: inherit; }
      .note-editor-source .lang span { opacity: .7; }
      ::highlight(note-editor-tk) { background: color-mix(in srgb, ${GOLD} 45%, transparent); }
      @keyframes note-editor-flash { from { background: color-mix(in srgb, ${GOLD} 40%, transparent); box-shadow: 0 0 0 8px color-mix(in srgb, ${GOLD} 40%, transparent); }
        to { background: transparent; box-shadow: 0 0 0 8px transparent; } }
      .note-editor-changed { animation: note-editor-flash 2.6s ease-out; border-radius: 2px; }
      @media (prefers-reduced-motion: reduce) { .note-editor-changed { animation: none; outline: 2px solid color-mix(in srgb, ${GOLD} 60%, transparent); outline-offset: 6px; } }
      article.note-editor-focus :is(.prose > *, .note-header > *):not(:focus-within, .is-selected, :has(.note-editor-source)) {
        opacity: .28; transition: opacity .35s; }
      article.note-editor-focus :is(.prose > *, .note-header > *):hover { opacity: .7; }
    `;

    /* ---- messaging ---- */
    // Writes go one at a time. Each waits for the previous write's refresh
    // (which brings new source ranges) and only then reads the range of the
    // block it is about, so a split landing right after an idle save never
    // splices with offsets the earlier save moved.
    const WRITES = new Set([
      'replace',
      'insert-after',
      'attrs',
      'frontmatter',
      'figure',
      'raw',
      'move',
      'undo',
      'redo',
      'tidy',
    ]);
    const writes = [];
    let writing = false;
    let awaitingRefresh = false;
    let writeTimer = null;
    const nextWrite = () => {
      clearTimeout(writeTimer);
      writing = false;
      awaitingRefresh = false;
      const next = writes.shift();
      if (next) dispatch(next);
    };
    const dispatch = ({ event, payload, id, el, other, index }) => {
      writing = true;
      if (el) {
        // Where the block is now: the same element after a refresh in place,
        // or the block at its index after the article was swapped.
        const holder = el.isConnected ? el : blocks()[index];
        const range = holder && rangeOf(holder);
        if (!range) {
          console.warn('[note-editor] dropped a write: its block is gone', event, payload);
          pending.delete(id);
          nextWrite();
          return;
        }
        payload = { ...payload, ...range };
        // What the file holds there now, as last rendered, not as first loaded.
        if ('expect' in payload && original.has(holder)) payload.expect = original.get(holder);
        if (other) {
          const otherRange = other.isConnected && rangeOf(other);
          if (!otherRange) {
            console.warn('[note-editor] dropped a move: the other block is gone');
            pending.delete(id);
            nextWrite();
            return;
          }
          payload.other = otherRange;
        }
      }
      server.send(`note-editor:${event}`, { id, slug, hash, ...payload });
      // No reply within a few seconds means the server is gone; don't hold the rest.
      clearTimeout(writeTimer);
      writeTimer = setTimeout(nextWrite, 5000);
    };
    /**
     * `meta.el` is the [data-src] block a write's range refers to (for a block
     * save, its holder); the range is read when the write actually goes out.
     */
    const send = (event, payload, meta) => {
      const id = ++msgId;
      if (meta) pending.set(id, meta);
      if (WRITES.has(event)) {
        const el =
          meta?.el ??
          (meta?.block && !meta.block.__anchor && !meta.block.__atEnd
            ? holderOf(meta.block)
            : null);
        const entry = {
          event,
          payload,
          id,
          el,
          other: meta?.other,
          index: el ? blocks().indexOf(el) : -1,
        };
        if (writing) writes.push(entry);
        else dispatch(entry);
      } else {
        server.send(`note-editor:${event}`, { id, slug, hash, ...payload });
      }
      return id;
    };
    /** A read that resolves with the reply's payload. */
    const ask = (event, payload = {}) => new Promise((then) => send(event, payload, { then }));

    /** Take in what a reply says about the file now. */
    const take = (msg) => {
      if (msg.hash) hash = msg.hash;
      if (msg.file) file = msg.file;
      if (msg.fences) fences = msg.fences;
      if (msg.frontmatter) frontmatter = msg.frontmatter;
    };
    server.on('note-editor:hello', (msg) => {
      take(msg);
      const meta = pending.get(msg.id);
      pending.delete(msg.id);
      meta?.then?.(msg);
    });
    let stashFor = null; // the write whose refresh will consume the stash
    server.on('note-editor:saved', (msg) => {
      take(msg);
      const meta = pending.get(msg.id);
      pending.delete(msg.id);
      // Nothing changed, so no refresh is coming to use the caret stash.
      if (msg.changed === false && stashFor === msg.id) sessionStorage.removeItem(KEY_STASH);
      if (msg.changed !== false) {
        // The next write waits for this one's refresh; if none comes, don't wait forever.
        awaitingRefresh = true;
        clearTimeout(writeTimer);
        writeTimer = setTimeout(nextWrite, 3000);
      }
      // Typing that landed after the save went out is still unsaved.
      if (meta?.block && baseline.get(meta.block) === blockMarkdown(meta.block))
        dirty.delete(meta.block);
      if (msg.undone) setState('Undone', 1800);
      else if (msg.redone) setState('Redone', 1800);
      else if (meta?.said) setState(meta.said, 1800);
      else setState(dirty.size ? 'Unsaved' : 'Saved');
      meta?.then?.(msg);
      if (!awaitingRefresh) nextWrite();
      // A `refresh` follows from the server; if the write changed nothing, it won't.
    });
    server.on('note-editor:stale', () => {
      setState('Changed elsewhere, reloading');
      pending.clear();
      writes.length = 0;
      writing = false;
      // The content change that made us stale also triggers Astro's reload.
    });
    server.on('note-editor:refresh', (msg) => refresh(msg));
    server.on('note-editor:error', (msg) => {
      setState(`Not saved: ${msg.message}`);
      console.warn('[note-editor]', msg.message);
      // Don't keep retrying the same rejected text across reloads.
      const meta = pending.get(msg.id);
      pending.delete(msg.id);
      if (meta?.block) dirty.delete(meta.block);
      meta?.fail?.(msg.message);
      sessionStorage.removeItem(KEY_STASH);
      nextWrite();
      // A split that was refused leaves a half on the page the file never had;
      // the only honest page is the file's.
      if (meta?.block?.nextElementSibling?.__split) setTimeout(() => location.reload(), 800);
    });
    for (const event of ['assets', 'uploaded', 'source', 'notes', 'check']) {
      server.on(`note-editor:${event}`, (msg) => {
        const meta = pending.get(msg.id);
        pending.delete(msg.id);
        meta?.then?.(msg.files ?? msg.file ?? msg.text ?? msg.notes ?? msg.orphans ?? msg);
      });
    }
    // The server answers in a few ms unless it is busy re-rendering; an old or
    // absent one must not hang the page, so give up after a while.
    const hello = () =>
      Promise.race([ask('hello'), new Promise((r) => setTimeout(() => r(null), 10000))]);
    const notes = async () => (notesList ??= await ask('notes'));

    /* ---- what is editable ---- */
    const BLOCK_SELECTOR = '.prose [data-src], .note-header h1, .note-header .description';
    const blocks = () => [...article.querySelectorAll(BLOCK_SELECTOR)];
    const editableOf = (el) =>
      el.matches(EDITABLE)
        ? el
        : el.tagName === 'FIGURE'
          ? el.querySelector('figcaption')
          : el.tagName === 'ASIDE' && !el.classList.contains('note-editor-comment')
            ? el.querySelector('p:not(.callout-label)')
            : el.tagName === 'BLOCKQUOTE'
              ? el.querySelector('p')
              : null;
    const holderOf = (el) => el.closest('[data-src]') ?? el;
    const rangeOf = (el) => {
      const src = holderOf(el)?.dataset.src;
      if (!src) return null;
      const [start, end] = src.split('-').map(Number);
      return { start, end };
    };
    const isCard = (el) =>
      Boolean(
        el?.matches?.(CARD) ||
          (el?.dataset?.src && el.tagName !== 'BLOCKQUOTE' && !el.matches(EDITABLE) && !editableOf(el)),
      );
    const kindOf = (el) => {
      if (el.classList.contains('note-editor-new')) return 'new';
      if (el.matches('.note-header h1')) return 'title';
      if (el.matches('.note-header .description')) return 'description';
      if (el.tagName === 'FIGCAPTION') return 'caption';
      if (el.classList.contains('callout-label')) return 'label';
      return 'block';
    };
    const isText = (el) => kindOf(el) === 'block' || kindOf(el) === 'new';
    const plainText = (el) => el.textContent.replace(/[\u00A0\u200B]/g, (c) => (c === '\u00A0' ? ' ' : '')).replace(/\s+/g, ' ').trim();
    const placeholderFor = (el) =>
      el.tagName === 'FIGCAPTION'
        ? 'Caption'
        : el.tagName === 'LI'
          ? 'List item'
          : el.matches('.note-header h1')
            ? 'What’s this one about?'
            : el.matches('.note-header .description')
              ? 'One sentence, for the list and the link preview.'
              : /^H/.test(el.tagName)
                ? 'Heading'
                : el.__atEnd
                  ? 'Start anywhere. You can move it later.'
                  : 'Type here, or "/" for a menu…';

    /** Code fences carry no stamp from the compiler; give them the server's. */
    const stampFences = (root) => {
      const pres = [...root.querySelectorAll('.prose pre')];
      pres.forEach((pre, i) => {
        const f = fences[i];
        if (f) {
          pre.dataset.src = `${f.start}-${f.end}`;
          if (f.lang) pre.dataset.language = f.lang;
        } else delete pre.dataset.src;
      });
    };

    /* ---- saving ---- */
    const original = new Map(); // holder -> text as rendered from the file, before any typing
    // block -> the markdown the file is believed to hold for it: what was
    // rendered at load, then whatever was last sent. Typing is "unsaved" when
    // the block's markdown differs from this.
    const baseline = new Map();

    /**
     * Remember where the caret is across the refresh that follows a save, and
     * enough to put unsaved typing back without ever overwriting a different
     * block: `base` is the markdown the target block must still show, and a
     * never-inserted new block records its anchor instead.
     */
    const stash = (block, extra = {}) => {
      // A new block lands after its anchor and everything the anchor contains.
      const index = block.__atEnd
        ? blocks().length
        : block.__anchor
          ? blocks().indexOf(block.__anchor) +
            1 +
            block.__anchor.querySelectorAll('[data-src]').length
          : blocks().indexOf(holderOf(block));
      const caret = Math.max(0, caretOffset(block) ?? 0);
      const base = baseline.get(block) ?? null;
      const anchorIndex = block.__anchor ? blocks().indexOf(block.__anchor) : undefined;
      const { skip = 0, ...rest } = extra;
      sessionStorage.setItem(
        KEY_STASH,
        JSON.stringify({ index: index + skip, caret, base, anchorIndex, atEnd: block.__atEnd, ...rest }),
      );
    };

    /**
     * Open an empty block after `anchor`, in the page only. Markdown has no
     * empty paragraph, so nothing is written until something is typed; then it
     * is inserted after the anchor's range. After a list item, the new block is
     * the next item. With no anchor (an empty note), it goes at the end.
     */
    const newBlockAfter = (anchor, { asListItem = anchor?.tagName === 'LI' } = {}) => {
      const el = document.createElement(asListItem ? 'li' : 'p');
      el.className = 'note-editor-new';
      el.contentEditable = 'true';
      if (anchor) {
        el.__anchor = anchor;
        anchor.after(el);
      } else {
        el.__atEnd = true;
        article.querySelector('.prose').append(el);
      }
      el.dataset.placeholder = placeholderFor(el);
      placeCaret(el, 0);
      setState('New block');
      return el;
    };

    /**
     * Write one block. `structural` overrides the message for a split or a
     * delete; `focus` says where the caret goes after the refresh that follows.
     */
    const save = (block, structural, focus = {}) => {
      clearTimeout(timers.get(block));
      timers.delete(block);
      if (!dirty.has(block) && !structural) return;
      const kind = kindOf(block);
      setState('Saving…');
      stash(block, focus);
      if (kind === 'title' || kind === 'description') {
        send('frontmatter', { field: kind, value: plainText(block) }, { block });
        return;
      }
      if (kind === 'new') {
        // Not in the file yet: insert after the block it was opened under. A
        // list item typed under a list item joins that list.
        const text = blockMarkdown(block);
        if (!text || !block.textContent.trim()) {
          dirty.delete(block);
          setState(dirty.size ? 'Unsaved' : 'Saved');
          return;
        }
        if (block.__split) return; // the split already put this text in the file
        baseline.set(block, text);
        if (block.__atEnd) {
          send('insert-after', { text, atEnd: true }, { block });
          return;
        }
        const anchor = block.__anchor;
        const tight = anchor.tagName === 'LI' && /^([-*]|\d+\.) /.test(text);
        send('insert-after', { text, tight }, { block, el: anchor });
        return;
      }
      const range = rangeOf(block);
      if (!range) return;
      if (kind === 'caption') {
        baseline.set(block, blockMarkdown(block));
        send(
          'attrs',
          { set: { caption: plainText(block) } },
          { block, el: holderOf(block) },
        );
        return;
      }
      if (kind === 'label') {
        const aside = block.closest('aside');
        const type = /callout-(\w+)/.exec(aside.className)?.[1];
        const label = plainText(block);
        send(
          'attrs',
          { ...range, set: { label: label === CALLOUT_LABELS[type] ? null : label } },
          { block },
        );
        return;
      }
      // What the file is expected to hold there: the block as it was rendered,
      // not as it reads now. The server refuses to overwrite anything else.
      const holder = holderOf(block);
      const expect = original.get(holder) ?? holder.textContent;
      const message = { ...range, expect, text: blockMarkdown(block), ...structural };
      baseline.set(block, blockMarkdown(block));
      stashFor = send('replace', message, { block });
    };

    const schedule = (block) => {
      dirty.add(block);
      setState('Unsaved');
      clearTimeout(timers.get(block));
      timers.set(
        block,
        setTimeout(() => save(block), IDLE_MS),
      );
      countWords();
    };

    const saveAll = () => {
      for (const block of [...dirty]) save(block);
    };

    /* ---- changing what kind of block something is ---- */
    /**
     * Turn `el` into a paragraph, heading, list item or quote in the page,
     * keeping its text, then save it so the file follows. `kind` is one of
     * p, h2, h3, ul, ol, quote.
     */
    const convert = (el, kind) => {
      const caret = caretOffset(el) ?? 0;
      const tag = kind === 'ul' || kind === 'ol' ? 'li' : kind === 'quote' ? 'p' : kind;
      const next = document.createElement(tag);
      next.innerHTML = el.innerHTML;
      if (el.dataset.src) next.dataset.src = el.dataset.src;
      next.className = el.className;
      next.contentEditable = 'true';
      next.__anchor = el.__anchor;
      next.__split = el.__split;
      next.__atEnd = el.__atEnd;
      next.dataset.placeholder = placeholderFor(next);
      // Lists and quotes live in a wrapper. Entering one means a new wrapper;
      // leaving one means stepping out of it, with the items after this one
      // carried into a wrapper of their own so the page keeps its order.
      const wants =
        kind === 'ul' ? 'UL' : kind === 'ol' ? 'OL' : kind === 'quote' ? 'BLOCKQUOTE' : null;
      const parent = el.parentElement;
      const inside = parent.matches('ul, ol, blockquote') ? parent : null;
      if (inside && inside.tagName === wants) {
        el.replaceWith(next);
      } else {
        const target = wants ? document.createElement(wants.toLowerCase()) : next;
        if (wants) target.append(next);
        if (inside) {
          const later = [];
          for (let sib = el.nextElementSibling; sib; sib = sib.nextElementSibling) later.push(sib);
          el.remove();
          inside.after(target);
          if (later.length) {
            const tail = document.createElement(inside.tagName.toLowerCase());
            tail.append(...later);
            target.after(tail);
          }
          if (!inside.children.length) inside.remove();
        } else {
          el.replaceWith(target);
        }
      }
      // Carry the bookkeeping over to the new element.
      if (baseline.has(el)) baseline.set(next, baseline.get(el));
      baseline.delete(el);
      if (original.has(el)) original.set(next, original.get(el));
      if (dirty.delete(el)) dirty.add(next);
      clearTimeout(timers.get(el));
      timers.delete(el);
      placeCaret(next, Math.min(caret, next.textContent.length));
      if (kindOf(next) === 'new') schedule(next);
      else {
        dirty.add(next);
        save(next);
      }
      return next;
    };
    const kindOfBlock = (el) =>
      el.tagName === 'LI'
        ? el.parentElement?.tagName === 'OL'
          ? 'ol'
          : 'ul'
        : el.parentElement?.tagName === 'BLOCKQUOTE'
          ? 'quote'
          : el.tagName.toLowerCase();

    /* ---- inserting things after a block ---- */
    /** Write `text` (one or more blocks of markdown) after `anchor`; `focus` shapes the stash. */
    const insertAfter = (anchor, text, focus = {}) => {
      const { skip = 0, ...rest } = focus;
      const index =
        blocks().indexOf(anchor) + 1 + anchor.querySelectorAll('[data-src]').length + skip;
      sessionStorage.setItem(KEY_STASH, JSON.stringify({ index, caret: 0, base: null, ...rest }));
      setState('Saving…');
      send('insert-after', { text, tight: focus.tight }, { el: anchor });
    };
    const insertDivider = (anchor) => insertAfter(anchor, '---', { selectCard: true });
    const insertCallout = (anchor) =>
      insertAfter(anchor, '<Callout type="note">\n  Something worth setting apart.\n</Callout>', {
        selectAll: true,
      });
    const insertComment = (anchor) =>
      insertAfter(anchor, '{/* claude: TK */}', { editSource: true });
    const insertFigure = (anchor, file) => {
      const index = blocks().indexOf(anchor) + 1 + anchor.querySelectorAll('[data-src]').length;
      sessionStorage.setItem(
        KEY_STASH,
        JSON.stringify({ index, caret: 0, base: null, selectCard: true }),
      );
      setState('Adding image…');
      send('figure', { file, alt: '' }, { el: anchor });
    };
    const replaceFigure = (card, file) => {
      stash(card, { selectCard: true });
      setState('Replacing image…');
      send('figure', { file, replace: true }, { el: card });
    };
    const uploadImage = (file, anchor) => {
      const reader = new FileReader();
      reader.onload = () => {
        setState('Uploading…');
        send(
          'upload',
          { name: file.name, data: reader.result.split(',')[1] },
          { then: (path) => insertFigure(anchor, path) },
        );
      };
      reader.readAsDataURL(file);
    };
    /** Duplicate a block right after itself. */
    const duplicate = (block) => {
      const holder = holderOf(block);
      if (!holder.dataset.src) return;
      if (dirty.has(block)) save(block);
      const text = isCard(holder) ? null : blockMarkdown(block);
      if (text === null) {
        // A card: copy its source as it is.
        ask('source', rangeOf(holder)).then((src) =>
          insertAfter(holder, src, { selectCard: true, tight: holder.tagName === 'LI' }),
        );
        return;
      }
      insertAfter(holder, text, { caret: 0, tight: block.tagName === 'LI' });
    };

    /**
     * The block menu ("/" or "+"): what an empty block can become, or what can
     * come after a card.
     */
    const menuItems = (el) => {
      const anchor = el.__anchor ?? (el.__atEnd ? null : holderOf(el));
      const asBlock = isText(el);
      const items = [];
      if (asBlock) {
        items.push(
          { key: 'H2', label: 'Heading', keywords: 'h2 section', run: () => convert(el, 'h2') },
          { key: 'H3', label: 'Subheading', keywords: 'h3', run: () => convert(el, 'h3') },
          { key: '•', label: 'Bullet list', keywords: 'ul', run: () => convert(el, 'ul') },
          { key: '1.', label: 'Numbered list', keywords: 'ol', run: () => convert(el, 'ol') },
          { key: '“', label: 'Quote', keywords: 'blockquote', run: () => convert(el, 'quote') },
        );
      }
      // An empty new block gives way to what is inserted; a real one stays.
      const after = () => {
        if (kindOf(el) === 'new' && !el.textContent.trim()) {
          dirty.delete(el);
          el.remove();
        }
        return anchor;
      };
      const needsAnchor = (run) => () => {
        const a = after();
        if (a) run(a);
        else setState('Write something first, then add this after it', 2500);
      };
      items.push(
        { key: '—', label: 'Divider', keywords: 'hr rule', run: needsAnchor(insertDivider) },
        {
          key: '▣',
          label: 'Image',
          hint: 'from src/assets',
          keywords: 'figure picture photo',
          run: needsAnchor(pickImage),
        },
        { key: '❝', label: 'Callout', keywords: 'aside note', run: needsAnchor(insertCallout) },
        {
          key: '✎',
          label: 'Note to Claude',
          hint: 'readers never see it',
          keywords: 'comment todo agent',
          run: needsAnchor(insertComment),
        },
      );
      return items;
    };
    const pickImage = (anchor, onPick = (f) => insertFigure(anchor, f)) => {
      send(
        'assets',
        {},
        {
          then: (files) => {
            const rect = anchor.getBoundingClientRect();
            ui.menu.show(
              rect,
              files.map((f) => ({ label: f, run: () => onPick(f) })),
              (item) => item.run(),
              { search: true, placeholder: 'Find an image… (or drop one onto the page)' },
            );
          },
        },
      );
    };

    /* ---- the formatting bar ---- */
    const exec = (block, cmd, arg) => {
      document.execCommand(cmd, false, arg);
      schedule(block);
      showBar();
    };
    const linkAt = () => {
      const sel = getSelection();
      const node = sel?.anchorNode;
      const el = node && (node.nodeType === 1 ? node : node.parentElement);
      return el?.closest?.('a') ?? null;
    };
    const noteHref = (n) => `/writing/${n.slug}/`;
    const askLink = (block, rect) => {
      const a = linkAt();
      if (!getSelection().rangeCount) return;
      const saved = getSelection().getRangeAt(0).cloneRange();
      const apply = (href) => {
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(saved);
        if (a && sel.isCollapsed) {
          // Caret inside a link: act on the whole link.
          const r = document.createRange();
          r.selectNodeContents(a);
          sel.removeAllRanges();
          sel.addRange(r);
        }
        if (href && sel.isCollapsed) {
          document.execCommand(
            'insertHTML',
            false,
            `<a href="${href.replace(/"/g, '%22')}">${escapeHtml(href.label ?? href)}</a>​`,
          );
        } else if (href) document.execCommand('createLink', false, href);
        else document.execCommand('unlink');
        schedule(block);
        ui.toolbar.hide();
        ui.menu.hide();
        block.focus({ preventScroll: true });
      };
      // As the title of another note is typed, offer it below the field.
      const suggest = async (value) => {
        const q = value.trim().toLowerCase();
        if (!q || /^(https?:|mailto:|\/|#)/.test(q)) {
          ui.menu.hide();
          return;
        }
        const list = (await notes()).filter((n) => n.title.toLowerCase().includes(q)).slice(0, 8);
        if (!list.length) {
          ui.menu.hide();
          return;
        }
        ui.menu.show(
          rect,
          list.map((n) => ({
            label: n.title,
            hint: n.draft ? 'draft' : n.slug,
            run: () => {
              const href = new String(noteHref(n));
              href.label = n.title;
              apply(href);
            },
          })),
          (item) => item.run(),
        );
      };
      ui.toolbar.prompt(rect, {
        value: a?.getAttribute('href') ?? '',
        placeholder: 'Paste a link, or type a note’s title · Enter applies, empty removes',
        onInput: suggest,
        onKey: (e) => ui.menu.open && ui.menu.key(e),
        onSubmit: (href) => apply(href),
        onCancel: () => {
          ui.toolbar.hide();
          ui.menu.hide();
          const sel = getSelection();
          sel.removeAllRanges();
          sel.addRange(saved);
          block.focus({ preventScroll: true });
        },
      });
    };
    /** "[[" typed: pick a note, and the link goes in where the brackets were. */
    const linkNoteAt = async (block) => {
      // Where the brackets are, as character offsets: the DOM under them may
      // be swapped by a save before the pick.
      const end = caretOffset(block) ?? block.textContent.length;
      const list = await notes();
      const rect = rangeOfChars(block, end - 2, end).getBoundingClientRect();
      let picked = false;
      ui.menu.show(
        rect,
        list.map((n) => ({
          label: n.title,
          hint: n.draft ? 'draft' : n.slug,
          keywords: n.slug,
          run: () => {
            picked = true;
            const sel = getSelection();
            sel.removeAllRanges();
            sel.addRange(rangeOfChars(block, end - 2, end));
            block.focus({ preventScroll: true });
            document.execCommand(
              'insertHTML',
              false,
              `<a href="${noteHref(n)}">${escapeHtml(n.title)}</a>​`,
            );
            schedule(block);
          },
        })),
        (item) => item.run(),
        {
          search: true,
          placeholder: 'Link to a note…',
          onHide: () => {
            // The pick runs after the menu hides; only a cancel puts the caret back.
            setTimeout(() => {
              if (!picked && block.isConnected) placeCaret(block, end);
            }, 0);
          },
        },
      );
    };
    const barItems = (block, rect) => {
      const kind = kindOfBlock(block);
      const items = [
        {
          html: '<span class="b">B</span>',
          title: 'Bold ⌘B',
          active: document.queryCommandState('bold'),
          run: () => exec(block, 'bold'),
        },
        {
          html: '<span class="i">I</span>',
          title: 'Italic ⌘I',
          active: document.queryCommandState('italic'),
          run: () => exec(block, 'italic'),
        },
        {
          html: '<span class="c">&lt;/&gt;</span>',
          title: 'Code ⌘E',
          active: Boolean(getSelection().anchorNode?.parentElement?.closest('code')),
          run: () => wrapSelection(block, 'code'),
        },
        {
          html: '<span class="s">S</span>',
          title: 'Strikethrough ⌘⇧X',
          active: document.queryCommandState('strikeThrough'),
          run: () => exec(block, 'strikeThrough'),
        },
        {
          html: '🔗',
          title: 'Link ⌘K',
          active: Boolean(linkAt()),
          run: () => askLink(block, rect),
        },
      ];
      if (isText(block) && !block.closest('aside')) {
        items.push(
          { sep: true },
          {
            label: 'H2',
            title: 'Heading ⌘⌥2',
            active: kind === 'h2',
            run: () => convert(block, kind === 'h2' ? 'p' : 'h2'),
          },
          {
            label: 'H3',
            title: 'Subheading ⌘⌥3',
            active: kind === 'h3',
            run: () => convert(block, kind === 'h3' ? 'p' : 'h3'),
          },
          {
            html: '“ ”',
            title: 'Quote ⌘⇧9',
            active: kind === 'quote',
            run: () => convert(block, kind === 'quote' ? 'p' : 'quote'),
          },
        );
      }
      const aside = block.closest('aside.callout');
      if (aside) {
        const type = /callout-(\w+)/.exec(aside.className)?.[1] ?? 'note';
        items.push(
          { sep: true },
          {
            select: Object.entries(CALLOUT_LABELS).map(([value, label]) => ({ value, label })),
            value: type,
            onChange: (value) => setCalloutType(aside, value),
          },
          { label: 'Remove callout', danger: true, run: () => removeCard(aside) },
        );
      }
      return items;
    };
    /** Inline code has no execCommand; wrap (or unwrap) the selection by hand. */
    const wrapSelection = (block, tag) => {
      const sel = getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const inside = (
        range.commonAncestorContainer.nodeType === 1
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement
      ).closest(tag);
      if (inside && block.contains(inside)) {
        inside.replaceWith(...inside.childNodes);
      } else {
        const text = range.toString();
        if (!text) return;
        document.execCommand('insertHTML', false, `<${tag}>${escapeHtml(text)}</${tag}>`);
      }
      schedule(block);
      showBar();
    };
    const setCalloutType = (aside, type) => {
      const label = aside.querySelector('.callout-label');
      const custom =
        label &&
        label.textContent.trim() !== CALLOUT_LABELS[/callout-(\w+)/.exec(aside.className)?.[1]];
      stash(editableOf(aside) ?? label, {});
      setState('Saving…');
      send('attrs', { set: { type, ...(custom ? {} : { label: null }) } }, { el: aside });
    };

    let barTimer = null;
    const showBar = () => {
      clearTimeout(barTimer);
      barTimer = setTimeout(() => {
        if (ui.menu.open) return;
        const sel = getSelection();
        const block = document.activeElement?.closest?.('[contenteditable="true"]');
        if (!sel?.rangeCount || !block || !selectionInside(block)) {
          if (!ui.toolbar.contains(document.activeElement)) ui.toolbar.hide();
          return;
        }
        const kind = kindOf(block);
        if (kind === 'title' || kind === 'description' || kind === 'label') {
          ui.toolbar.hide();
          return;
        }
        const a = linkAt();
        if (sel.isCollapsed) {
          if (a && block.contains(a)) {
            const rect = a.getBoundingClientRect();
            ui.toolbar.show(rect, [
              { href: a.getAttribute('href') },
              { label: 'Edit', run: () => askLink(block, rect) },
              {
                label: 'Remove',
                danger: true,
                run: () => {
                  a.replaceWith(...a.childNodes);
                  schedule(block);
                  ui.toolbar.hide();
                },
              },
            ]);
          } else {
            ui.toolbar.hide();
          }
          return;
        }
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        ui.toolbar.show(rect, barItems(block, rect));
      }, 120);
    };

    /* ---- the "+" beside an empty block, and the "/" menu ---- */
    const showPlus = () => {
      const block = document.activeElement?.closest?.('[contenteditable="true"]');
      if (block && isText(block) && !block.textContent.trim() && !block.closest('aside')) {
        ui.plus.show(block.getBoundingClientRect(), () => openMenu(block));
      } else {
        ui.plus.hide();
      }
    };
    let menuFor = null;
    const openMenu = (block) => {
      menuFor = block;
      ui.menu.show(block.getBoundingClientRect(), menuItems(block), (item) => {
        // Drop the "/query" that opened the menu before acting on the pick.
        if (block.isConnected && /^\/\S*$/.test(block.textContent.replace(/ /g, ' ').trim()))
          block.textContent = '';
        menuFor = null;
        item.run();
      });
    };

    /* ---- cards: figures, dividers, code, tables, notes to Claude ---- */
    let selectedCard = null;
    const cardKind = (card) =>
      card.tagName === 'PRE'
        ? 'code'
        : card.classList.contains('note-editor-comment')
          ? 'comment'
          : card.tagName === 'TABLE'
            ? 'table'
            : card.tagName === 'FIGURE'
              ? 'figure'
              : card.tagName === 'HR'
                ? 'divider'
                : 'source';
    const selectCard = (card) => {
      deselectCard();
      ui.menu.hide();
      selectedCard = card;
      card.classList.add('is-selected');
      card.focus({ preventScroll: true });
      const kind = cardKind(card);
      const items = [];
      if (kind === 'figure' && card.querySelector(':scope > img')) {
        const img = card.querySelector(':scope > img');
        items.push(
          {
            label: 'Alt text',
            title: img?.alt ? `Alt: ${img.alt}` : 'No alt text yet',
            active: Boolean(img?.alt),
            run: () =>
              ui.toolbar.prompt(
                card.getBoundingClientRect(),
                {
                  value: img?.alt ?? '',
                  placeholder: 'Describe the image for people who cannot see it',
                  onSubmit: (alt) => {
                    ui.toolbar.hide();
                    stash(card, { selectCard: true });
                    send('attrs', { set: { alt } }, { el: card });
                  },
                  onCancel: () => selectCard(card),
                },
                { below: true },
              ),
          },
          {
            label: 'Caption',
            active: Boolean(card.querySelector('figcaption')),
            run: () => editCaption(card),
          },
          {
            label: 'Wide',
            active: card.classList.contains('figure-wide'),
            run: () => {
              stash(card, { selectCard: true });
              send(
                'attrs',
                { ...rangeOf(card), set: { wide: !card.classList.contains('figure-wide') } },
                {},
              );
            },
          },
          { label: 'Replace', run: () => pickImage(card, (f) => replaceFigure(card, f)) },
          { sep: true },
        );
      }
      if (kind === 'code' || kind === 'table' || kind === 'comment' || kind === 'source') {
        items.push(
          {
            label: kind === 'code' ? 'Edit code' : 'Edit',
            title: 'Enter',
            run: () => editSource(card),
          },
          { sep: true },
        );
      }
      items.push(
        { label: '↑', title: 'Move up ⌘⇧↑', run: () => moveBlock(card, -1) },
        { label: '↓', title: 'Move down ⌘⇧↓', run: () => moveBlock(card, 1) },
        { label: 'Remove', danger: true, run: () => removeCard(card) },
      );
      ui.toolbar.show(card.getBoundingClientRect(), items, { below: true });
    };
    const deselectCard = () => {
      if (!selectedCard) return;
      selectedCard.classList.remove('is-selected');
      selectedCard = null;
      ui.toolbar.hide();
    };
    const removeCard = (card) => {
      const index = blocks().indexOf(card);
      deselectCard();
      sessionStorage.setItem(
        KEY_STASH,
        JSON.stringify({ index: Math.max(0, index - 1), caret: 1e9, base: null }),
      );
      setState('Saving…');
      send('replace', { delete: true }, { el: card });
    };
    const editCaption = (card) => {
      deselectCard();
      let cap = card.querySelector('figcaption');
      if (!cap) {
        cap = document.createElement('figcaption');
        cap.contentEditable = 'true';
        cap.dataset.placeholder = 'Caption';
        card.append(cap);
        baseline.set(cap, '');
      }
      placeCaret(cap, cap.textContent.length);
    };

    /**
     * Edit a card as the markdown it is in the file: a code fence with its
     * language, a table, a note to Claude, anything else the page can't edit
     * in place. The card stays in the page, hidden, so its range is still
     * known when the write goes out.
     */
    const editSource = async (card) => {
      const range = rangeOf(card);
      if (!range || card.hidden) return;
      const src = await ask('source', range);
      if (typeof src !== 'string') return;
      const kind = cardKind(card);
      let body = src;
      let lang = '';
      let fenceOf = null;
      if (kind === 'code') {
        const m = /^(`{3,}|~{3,})[ \t]*(\S*)([^\n]*)\n([\s\S]*?)\n?\1[ \t]*$/.exec(src);
        if (m) {
          lang = m[2];
          body = m[4];
          fenceOf = (l, text) => `${m[1]}${l}${m[3]}\n${text}\n${m[1]}`;
        }
      }
      if (kind === 'comment') {
        const m = /^\{\s*\/\*([\s\S]*?)\*\/\s*\}$/.exec(src);
        if (m) body = m[1].replace(/^ ?/, '').replace(/ ?$/, '');
      }
      deselectCard();
      const box = document.createElement('div');
      box.className = 'note-editor-source';
      const ta = document.createElement('textarea');
      ta.value = body;
      ta.spellcheck = kind !== 'code';
      let langInput = null;
      if (kind === 'code' && fenceOf) {
        const row = document.createElement('div');
        row.className = 'lang';
        langInput = document.createElement('input');
        langInput.value = lang;
        langInput.placeholder = 'language';
        langInput.title = 'The fence’s language, for highlighting';
        const hint = document.createElement('span');
        hint.textContent = '⌘Enter to keep it, Escape to leave it as it was';
        row.append(langInput, hint);
        box.append(row);
      }
      box.append(ta);
      card.hidden = true;
      card.after(box);
      const size = () => {
        ta.style.height = 'auto';
        ta.style.height = `${ta.scrollHeight + 4}px`;
      };
      ta.addEventListener('input', size);
      size();
      let done = false;
      const leave = () => {
        if (done) return;
        done = true;
        box.remove();
        card.hidden = false;
      };
      const cancel = () => {
        leave();
        selectCard(card);
      };
      const commit = () => {
        if (done) return;
        const value = ta.value.replace(/\s+$/, '');
        const text =
          kind === 'code' && fenceOf
            ? fenceOf(langInput.value.trim(), value)
            : kind === 'comment'
              ? `{/* ${value.trim()} */}`
              : value;
        if (text === src) return cancel();
        leave();
        stash(card, { selectCard: true });
        setState('Saving…');
        // No `expect`: the fence line or the tag is not in the page's text; the
        // file hash already guards against writing over someone else's change.
        send('raw', { text }, { el: card, said: 'Saved' });
        if (!text.trim()) {
          const index = blocks().indexOf(card);
          sessionStorage.setItem(
            KEY_STASH,
            JSON.stringify({ index: Math.max(0, index - 1), caret: 1e9, base: null }),
          );
        }
      };
      const onKey = (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          cancel();
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          commit();
        } else if (e.key === 'Tab' && e.target === ta && kind === 'code') {
          e.preventDefault();
          document.execCommand('insertText', false, '  ');
        }
      };
      ta.addEventListener('keydown', onKey);
      langInput?.addEventListener('keydown', onKey);
      const onLeave = () => {
        // Focus moving between the language field and the text stays inside.
        setTimeout(() => {
          if (!done && !box.contains(document.activeElement)) commit();
        }, 0);
      };
      ta.addEventListener('blur', onLeave);
      langInput?.addEventListener('blur', onLeave);
      ta.focus();
      if (kind === 'comment' && /^claude: TK$/.test(body)) {
        ta.setSelectionRange(8, 10);
      } else ta.setSelectionRange(ta.value.length, ta.value.length);
    };

    /** Move a block past its neighbour in the page; the file follows. */
    const moveBlock = (block, dir) => {
      const holder = isCard(block) ? block : holderOf(block);
      if (!holder.dataset.src) return;
      if (holder.parentElement?.tagName === 'BLOCKQUOTE') {
        setState('Quotes move as one: convert the lines first', 2500);
        return;
      }
      let sib = dir < 0 ? holder.previousElementSibling : holder.nextElementSibling;
      while (sib && !sib.dataset.src) {
        if (sib.classList.contains('note-editor-new') || sib.classList.contains('note-editor-source'))
          sib = dir < 0 ? sib.previousElementSibling : sib.nextElementSibling;
        else break;
      }
      if (!sib?.dataset.src) {
        setState(dir < 0 ? 'Already at the top' : 'Already at the end', 1500);
        return;
      }
      if (dirty.has(block)) save(block);
      const caret = isCard(block) ? 0 : (caretOffset(block) ?? 0);
      const index = blocks().indexOf(holder);
      const otherIndex = blocks().indexOf(sib);
      const target = dir < 0 ? otherIndex : otherIndex + sib.querySelectorAll('[data-src]').length;
      const inner = holder.querySelectorAll('[data-src]').length;
      sessionStorage.setItem(
        KEY_STASH,
        JSON.stringify({
          index: dir < 0 ? target : target - inner,
          caret,
          base: null,
          selectCard: isCard(holder),
        }),
      );
      void index;
      setState('Saving…');
      send('move', { dir }, { el: holder, other: sib, said: 'Moved' });
    };

    /* ---- undo and redo: the file's last change, from the server's history ---- */
    const history = (which) => {
      ui.toolbar.hide();
      ui.menu.hide();
      const active = document.activeElement?.closest?.('[contenteditable="true"]');
      if (active) stash(active, {});
      setState(which === 'undo' ? 'Undoing…' : 'Redoing…');
      send(which, {}, { fail: () => setState(`Nothing to ${which}`, 1500) });
    };

    /* ---- focus mode ---- */
    const setFocusMode = (state) => {
      article.classList.toggle('note-editor-focus', state);
      sessionStorage.setItem(KEY_FOCUS, state ? '1' : '');
      setState(state ? 'Focus on' : 'Focus off', 1200);
    };

    /* ---- panels: the note's settings, the shortcut list ---- */
    const el = (tag, props = {}, ...children) => {
      const node = document.createElement(tag);
      Object.assign(node, props);
      node.append(...children);
      return node;
    };
    const showSettings = () => {
      const fm = frontmatter ?? {};
      ui.panel.show('settings', (root) => {
        root.append(el('h2', { textContent: 'This note' }));
        const field = (name, input) => {
          const row = el('div', { className: 'row' });
          row.append(el('label', { textContent: name }), input);
          root.append(row);
          return input;
        };
        const set = (name, value, said) =>
          send('frontmatter', { field: name, value }, { said: said ?? 'Saved' });
        const check = (name, label, on) => {
          const input = el('input', { type: 'checkbox', checked: Boolean(on) });
          input.addEventListener('change', () => set(name, input.checked));
          field(label, input);
        };
        check('draft', 'Draft — kept out of the build', fm.draft);
        check('featured', 'Featured on the home page', fm.featured);
        const date = (name, label, value) => {
          const input = el('input', { type: 'date', value: value ?? '' });
          input.addEventListener('change', () => set(name, input.value || null));
          field(label, input);
        };
        date('published', 'Published', fm.published);
        date('updated', 'Updated', fm.updated);
        const tags = el('input', {
          type: 'text',
          value: (fm.tags ?? []).join(', '),
          placeholder: 'comma, separated',
        });
        const commitTags = () => {
          const value = tags.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          if (value.join('|') !== (fm.tags ?? []).join('|')) set('tags', value);
        };
        tags.addEventListener('change', commitTags);
        tags.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') commitTags();
        });
        field('Tags', tags);
        const path = el('div', { className: 'path', textContent: file, title: 'Click to copy' });
        path.addEventListener('click', () => {
          navigator.clipboard?.writeText(file);
          path.textContent = 'Copied';
          setTimeout(() => (path.textContent = file), 900);
        });
        root.append(el('div', { className: 'row' }, path));

        root.append(el('h2', { textContent: 'Ready to publish?' }));
        const item = (ok, text, action) => {
          const row = el('div', { className: 'check' + (ok ? ' ok' : '') });
          row.append(el('span', { className: 'm', textContent: ok ? '✓' : '•' }));
          row.append(el('span', { textContent: text }));
          if (!ok && action) {
            const b = el('button', { type: 'button', textContent: action.label });
            b.addEventListener('click', action.run);
            row.append(b);
          }
          root.append(row);
          return row;
        };
        const desc = article.querySelector('.note-header .description')?.textContent.trim() ?? '';
        item(desc && !TK.test(desc), 'A description, for the list and the link preview');
        TK.lastIndex = 0;
        const noAlt = [...article.querySelectorAll('.prose figure img')].filter((i) => !i.alt.trim());
        item(!noAlt.length, noAlt.length ? `${noAlt.length} image(s) without alt text` : 'Alt text on every image', {
          label: 'Show',
          run: () => {
            ui.panel.hide();
            selectCard(noAlt[0].closest('figure'));
            noAlt[0].scrollIntoView({ block: 'center' });
          },
        });
        item(!tkRanges.length, tkRanges.length ? `${tkRanges.length} TK still to fill in` : 'No TK left', {
          label: 'Next',
          run: () => {
            ui.panel.hide();
            nextTK();
          },
        });
        const comments = article.querySelectorAll('.note-editor-comment').length;
        item(!comments, comments ? `${comments} note(s) to Claude still in the file` : 'No notes to Claude left', {
          label: 'Show',
          run: () => {
            ui.panel.hide();
            const c = article.querySelector('.note-editor-comment');
            selectCard(c);
            c.scrollIntoView({ block: 'center' });
          },
        });
        const orphans = item(true, 'Checking imports…');
        ask('check').then((list) => {
          if (!orphans.isConnected) return;
          const ok = !list?.length;
          const fresh = item(ok, ok ? 'No unused imports' : `${list.length} unused import(s): ${list.join(', ')}`, {
            label: 'Tidy',
            run: () => send('tidy', {}, { said: 'Imports tidied' }),
          });
          orphans.replaceWith(fresh);
        });
        item(!fm.draft, fm.draft ? 'Still a draft' : 'Not a draft: it ships on the next push');
        root.append(
          el('div', { className: 'row' }, el('label', { textContent: 'Publishing is a push: commit when it is ready.' })),
        );
      });
    };
    const showShortcuts = () => {
      ui.panel.show('shortcuts', (root) => {
        root.append(el('h2', { textContent: 'Shortcuts' }));
        const table = el('table');
        for (const [keys, what] of SHORTCUTS) {
          table.append(el('tr', {}, el('td', { textContent: keys }), el('td', { textContent: what })));
        }
        root.append(table);
      });
    };
    const pillMenu = () => {
      const rect = pillEl.getBoundingClientRect();
      const items = [
        { label: 'Note settings', hint: '⌘.', run: showSettings },
        { label: 'Keyboard shortcuts', hint: '⌘/', run: showShortcuts },
        { label: 'New note', hint: '⌘⌥N', run: newNote },
        { label: 'Undo last change', hint: '⌘Z', run: () => history('undo') },
        { label: 'Redo', hint: '⌘⇧Z', run: () => history('redo') },
        {
          label: article.classList.contains('note-editor-focus') ? 'Focus mode off' : 'Focus mode',
          hint: '⌘⇧F',
          run: () => setFocusMode(!article.classList.contains('note-editor-focus')),
        },
        { label: file, hint: 'file', run: () => navigator.clipboard?.writeText(file) },
      ];
      ui.menu.show(rect, items, (item) => item.run());
    };
    pillEl.addEventListener('click', (e) => {
      if (e.target === tkEl) return;
      if (ui.menu.open) ui.menu.hide();
      else pillMenu();
    });

    /* ---- context for Claude: which block the caret is in ---- */
    let contextTimer = null;
    const reportContext = () => {
      clearTimeout(contextTimer);
      contextTimer = setTimeout(() => {
        const sel = getSelection();
        const el =
          sel?.anchorNode &&
          (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
        const block = el?.closest?.('[data-src]');
        if (!block) return;
        const range = rangeOf(block);
        const copy = block.cloneNode(true);
        for (const el of copy.querySelectorAll('.callout-label')) el.remove();
        send('context', {
          url: location.href,
          block: { ...range, text: copy.textContent.trim().replace(/\s+/g, ' ').slice(0, 400) },
          selection: sel.toString().trim().slice(0, 600),
        });
      }, 300);
    };

    /* ---- event handlers ---- */
    /**
     * Typographer's quotes and an ellipsis as you type, outside code. Done
     * before the character lands: a browser ignores execCommand from inside
     * an input event.
     */
    const onBeforeInput = (e) => {
      if (e.inputType !== 'insertText' || composing) return;
      const block = e.target.closest?.('[contenteditable="true"]');
      if (!block || !isText(block)) return;
      const sel = getSelection();
      const node = sel?.anchorNode;
      if (!sel.isCollapsed || node?.nodeType !== Node.TEXT_NODE) return;
      if (node.parentElement?.closest('code')) return;
      const before = node.data.slice(0, sel.anchorOffset);
      if (e.data === '"' || e.data === "'") {
        e.preventDefault();
        document.execCommand('insertText', false, smartQuote(e.data, before.slice(-1)));
      } else if (e.data === '.' && before.endsWith('..')) {
        e.preventDefault();
        const r = document.createRange();
        r.setStart(node, sel.anchorOffset - 2);
        r.setEnd(node, sel.anchorOffset);
        sel.removeAllRanges();
        sel.addRange(r);
        document.execCommand('insertText', false, '…');
      }
    };
    let composing = false;
    const onComposition = (e) => {
      composing = e.type === 'compositionstart';
      if (!composing) {
        const block = e.target.closest?.('[contenteditable="true"]');
        if (block) schedule(block);
      }
    };
    const onInput = (e) => {
      const block = e.target.closest?.('[contenteditable="true"]');
      if (!block || composing) return;
      // Deleting the last character leaves a <br> behind, which hides the
      // placeholder and can sit under the caret; an empty block stays empty.
      if (!block.textContent && block.childNodes.length) block.replaceChildren();
      if (e.inputType === 'insertText' && isText(block)) {
        const sel = getSelection();
        const node = sel.anchorNode;
        if (node?.nodeType === Node.TEXT_NODE && sel.isCollapsed) {
          const inCode = Boolean(node.parentElement?.closest('code'));
          const before = node.data.slice(0, sel.anchorOffset);
          if (!inCode && e.data === '[' && before.endsWith('[[')) {
            linkNoteAt(block);
            return;
          } else {
            // Markdown as you type: inline shortcuts close on their last character.
            const hit = shortcutAt(before);
            if (hit) {
              const r = document.createRange();
              r.setStart(node, sel.anchorOffset - hit.length);
              r.setEnd(node, sel.anchorOffset);
              sel.removeAllRanges();
              sel.addRange(r);
              document.execCommand('insertHTML', false, hit.html);
            }
          }
        }
        {
          // Block shortcuts close on the space after their marker. A trailing
          // space in a contenteditable is a no-break space.
          const head = block.textContent.slice(0, caretOffset(block) ?? 0).replace(/ /g, ' ');
          const m = /^(#{1,3}|[-*]|1\.|>) $/.exec(head);
          const kind =
            m &&
            (m[1].startsWith('#')
              ? m[1].length >= 3
                ? 'h3'
                : 'h2'
              : m[1] === '1.'
                ? 'ol'
                : m[1] === '>'
                  ? 'quote'
                  : 'ul');
          if (kind && block.tagName !== 'LI' && !(kind === 'quote' && block.closest('aside'))) {
            const r = document.createRange();
            r.setStart(block, 0);
            const at = getSelection().getRangeAt(0);
            r.setEnd(at.endContainer, at.endOffset);
            r.deleteContents();
            convert(block, kind);
            ui.menu.hide();
            return;
          }
        }
      }
      const plain = block.textContent.replace(/ /g, ' ').trim();
      if (isText(block) && block.tagName === 'P' && (plain === '---' || plain === '```')) {
        // A divider, or a code block, written as its own block replacing this empty one.
        const text = plain === '---' ? '---' : '```\n\n```';
        block.textContent = '';
        const anchor = block.__anchor ?? (block.__atEnd ? null : holderOf(block));
        const focus = plain === '---' ? { selectCard: true } : { editSource: true };
        if (kindOf(block) === 'new') {
          dirty.delete(block);
          if (!anchor) {
            block.remove();
            sessionStorage.setItem(
              KEY_STASH,
              JSON.stringify({ index: blocks().length, caret: 0, base: null, ...focus }),
            );
            send('insert-after', { text, atEnd: true }, {});
          } else {
            block.remove();
            insertAfter(anchor, text, focus);
          }
        } else {
          dirty.add(block);
          save(block, { text }, focus);
        }
        return;
      }
      // "/" at the start of an empty block opens the menu; keep it filtered.
      if (isText(block) && /^\/\S*$/.test(plain)) {
        if (!ui.menu.open || menuFor !== block) openMenu(block);
        ui.menu.filter(plain.slice(1));
      } else if (ui.menu.open && menuFor === block) {
        ui.menu.hide();
        menuFor = null;
      }
      if (block.__split) {
        dirty.add(block); // kept across the refresh, saved after it
        return;
      }
      schedule(block);
      showPlus();
    };

    /** Move the caret to the block before or after `el`, or select the card there. */
    const stops = () => {
      const out = [];
      for (const holder of blocks()) {
        if (holder.hidden) continue;
        if (isCard(holder)) out.push(holder);
        else if (holder.tagName === 'ASIDE' || holder.tagName === 'BLOCKQUOTE') continue;
        else {
          const el = editableOf(holder);
          if (el && !out.includes(el)) out.push(el);
        }
        if (holder.tagName === 'FIGURE' && holder.querySelector('figcaption'))
          out.push(holder.querySelector('figcaption'));
      }
      for (const el of article.querySelectorAll('.note-editor-new')) {
        const i = out.indexOf(el.__anchor);
        if (i >= 0 && !out.includes(el)) out.splice(i + 1, 0, el);
        else if (el.__atEnd && !out.includes(el)) out.push(el);
      }
      return out;
    };
    const moveTo = (from, dir, atEnd) => {
      const list = stops();
      const i = list.indexOf(from);
      const target = list[i + dir];
      if (!target) return false;
      deselectCard();
      if (isCard(target)) selectCard(target);
      else placeCaret(target, atEnd ? target.textContent.length : 0);
      target.scrollIntoView?.({ block: 'nearest' });
      return true;
    };

    /** Shortcuts that work wherever the focus is, as long as editing is on. */
    const onGlobalKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const inField = e.target.closest?.('.note-editor-ui, .note-editor-source');
      if (inField) return;
      const key = e.key.toLowerCase();
      if (e.altKey && e.code === 'KeyN') {
        // ⌘⇧N is the browser's own (a private window) and cannot be taken.
        e.preventDefault();
        newNote();
      } else if (e.shiftKey && key === 'f') {
        e.preventDefault();
        setFocusMode(!article.classList.contains('note-editor-focus'));
      } else if (key === '/' && !e.shiftKey) {
        e.preventDefault();
        if (ui.panel.kind() === 'shortcuts') ui.panel.hide();
        else showShortcuts();
      } else if (key === '.' && !e.shiftKey) {
        e.preventDefault();
        if (ui.panel.kind() === 'settings') ui.panel.hide();
        else showSettings();
      } else if (key === 'z' && !e.altKey) {
        const block = e.target.closest?.('[contenteditable="true"]');
        // Unsaved typing undoes in the block, as usual; anything saved, in the file.
        if (block && dirty.has(block)) return;
        e.preventDefault();
        history(e.shiftKey ? 'redo' : 'undo');
      }
    };

    const onKeydown = (e) => {
      if (ui.menu.open && ui.menu.key(e)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (selectedCard && e.target === selectedCard) {
        if (mod && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          moveBlock(selectedCard, e.key === 'ArrowUp' ? -1 : 1);
        } else if (mod && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          duplicate(selectedCard);
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          removeCard(selectedCard);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const card = selectedCard;
          const kind = cardKind(card);
          if (kind !== 'figure' && kind !== 'divider') editSource(card);
          else {
            deselectCard();
            newBlockAfter(card, { asListItem: false });
          }
        } else if (e.key === 'Escape') {
          if (ui.panel.open) ui.panel.hide();
          else deselectCard();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          moveTo(selectedCard, -1, true);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          moveTo(selectedCard, 1, false);
        }
        return;
      }
      const block = e.target.closest?.('[contenteditable="true"]');
      if (!block) return;
      const key = e.key.toLowerCase();
      if (mod && key === 's') {
        e.preventDefault();
        saveAll();
        return;
      }
      if (mod && e.key === 'Enter') {
        // A paragraph after whatever this block sits in: the callout, the list, the quote.
        e.preventDefault();
        const top = [...article.querySelectorAll('.prose > *')].find((el) => el.contains(block));
        if (top) {
          if (dirty.has(block)) save(block);
          newBlockAfter(top.matches('[data-src]') ? top : holderOf(block), { asListItem: false });
        }
        return;
      }
      if (mod && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        if (isText(block) && kindOf(block) === 'block') moveBlock(block, e.key === 'ArrowUp' ? -1 : 1);
        return;
      }
      if (mod && !e.shiftKey && !e.altKey) {
        const inline = { b: 'bold', i: 'italic' }[key];
        if (inline) {
          e.preventDefault();
          exec(block, inline);
          return;
        }
        if (key === 'e') {
          e.preventDefault();
          if (isText(block)) wrapSelection(block, 'code');
          return;
        }
        if (key === 'k') {
          e.preventDefault();
          askLink(block, caretRect(block));
          return;
        }
        if (key === 'd') {
          e.preventDefault();
          if (kindOf(block) === 'block') duplicate(block);
          return;
        }
      }
      if (mod && e.shiftKey && key === 'x') {
        e.preventDefault();
        exec(block, 'strikeThrough');
        return;
      }
      if (mod && e.altKey && isText(block) && !block.closest('aside') && /^[023]$/.test(e.code.slice(-1))) {
        e.preventDefault();
        const to = { 0: 'p', 2: 'h2', 3: 'h3' }[e.code.slice(-1)];
        if (kindOfBlock(block) !== to) convert(block, to);
        return;
      }
      if (mod && e.shiftKey && isText(block) && !block.closest('aside') && /^Digit[789]$/.test(e.code)) {
        e.preventDefault();
        const to = { 7: 'ol', 8: 'ul', 9: 'quote' }[e.code.slice(-1)];
        convert(block, kindOfBlock(block) === to ? 'p' : to);
        return;
      }
      if (e.key === 'Escape') {
        // Step out: the menu, a panel, the bar, then the block.
        if (ui.panel.open) ui.panel.hide();
        else if (ui.toolbar.open) ui.toolbar.hide();
        else {
          ui.menu.hide();
          if (isText(block) && /^\/\S*$/.test(block.textContent.replace(/\u00A0/g, ' ').trim())) {
            block.textContent = '';
            dirty.delete(block);
            clearTimeout(timers.get(block));
          }
          block.blur();
        }
        return;
      }
      const kind = kindOf(block);
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey && isText(block)) {
          // A line break inside the block.
          document.execCommand('insertHTML', false, '<br>​');
          schedule(block);
          return;
        }
        if (kind === 'title') {
          const desc = article.querySelector('.note-header .description');
          if (desc) placeCaret(desc, desc.textContent.length);
          return;
        }
        if (kind === 'description') {
          const first = stops().find((s) => s.closest('.prose'));
          if (first) moveTo(block, 1, false) || placeCaret(first, 0);
          else newBlockAfter(null);
          return;
        }
        if (kind === 'new') {
          if (!block.textContent.trim()) {
            // Enter on an empty item or quote line leaves the list or quote.
            if (kindOfBlock(block) !== 'p') convert(block, 'p');
            return;
          }
          // Save this block and carry on in a fresh one once the page is back;
          // if the save is already on its way, just ask for the new block.
          if (dirty.has(block)) save(block, undefined, { openBelow: true });
          else stash(block, { openBelow: true });
          return;
        }
        if (kind !== 'block') {
          block.blur();
          return;
        }
        if (block.tagName === 'LI' && !block.textContent.trim()) {
          convert(block, 'p');
          return;
        }
        const [before, after] = splitAtCaret(block);
        if (after.trim() === '') {
          if (dirty.has(block)) save(block);
          // After a heading or a quote, a paragraph; after an item, an item.
          newBlockAfter(holderOf(block), { asListItem: block.tagName === 'LI' });
          return;
        }
        // Split the page too, so typing carries straight on in the second half
        // while the file catches up. The second half is a "new" block whose
        // text is already in the file; only what is typed after this is kept.
        const holder = holderOf(block);
        const rest = document.createElement(block.tagName === 'LI' ? 'li' : 'p');
        const at = getSelection().getRangeAt(0);
        const tail = document.createRange();
        tail.selectNodeContents(block);
        tail.setStart(at.endContainer, at.endOffset);
        rest.append(tail.extractContents());
        rest.className = 'note-editor-new';
        rest.contentEditable = 'true';
        rest.__anchor = holder;
        rest.__split = true;
        holder.after(rest);
        baseline.set(rest, blockMarkdown(rest));
        dirty.add(block);
        save(block, { text: blockMarkdown(block), after });
        placeCaret(rest, 0);
        return;
      }
      if (e.key === 'Backspace') {
        const empty = block.textContent.trim() === '';
        const atStart = caretOffset(block) === 0 && getSelection().isCollapsed;
        if (kind === 'new' && empty) {
          e.preventDefault();
          const anchor = block.__anchor;
          dirty.delete(block);
          clearTimeout(timers.get(block));
          if (block.__atEnd) return; // the only block on an empty note stays
          block.remove();
          ui.menu.hide();
          const back = editableOf(anchor);
          if (back) placeCaret(back, back.textContent.length);
          else if (isCard(anchor)) selectCard(anchor);
          setState(dirty.size ? 'Unsaved' : 'Saved');
          return;
        }
        if (kind === 'caption' && !block.textContent) {
          // An empty caption goes; the figure stays selected.
          e.preventDefault();
          const card = block.closest('figure');
          clearTimeout(timers.get(block));
          dirty.delete(block);
          block.remove();
          if (baseline.get(block) !== '') {
            stash(card, { selectCard: true });
            send('attrs', { set: { caption: null } }, { el: card });
          }
          selectCard(card);
          return;
        }
        if (isText(block) && atStart && kindOfBlock(block) !== 'p') {
          // Backspace at the start of a heading, item or quote: back to a paragraph.
          e.preventDefault();
          convert(block, 'p');
          return;
        }
        if (kind === 'block' && empty && block.tagName !== 'LI') {
          e.preventDefault();
          ui.menu.hide();
          save(block, { delete: true }, { focusPrev: true, caret: 1e9 });
          return;
        }
        if (kind === 'block' && atStart && !empty) {
          // Join with the block above, the way one editor would: only when it
          // really is the block right above in the file (same parent, nothing
          // between), and a paragraph may also run on into a heading.
          const list = stops();
          const prev = list[list.indexOf(block) - 1];
          const holder = holderOf(block);
          const same = kindOfBlock(prev ?? block) === kindOfBlock(block);
          const intoHeading = kindOfBlock(block) === 'p' && /^h[23]$/.test(kindOfBlock(prev ?? block));
          if (
            prev &&
            !isCard(prev) &&
            isText(prev) &&
            kindOf(prev) === 'block' &&
            (same || intoHeading) &&
            holderOf(prev).parentElement === holder.parentElement &&
            holderOf(prev).nextElementSibling === holder
          ) {
            e.preventDefault();
            const at = prev.textContent.length;
            const expectNext = original.get(holder) ?? holder.textContent;
            holder.remove();
            // Enter trimmed the space at the split; Backspace gives it back.
            if (/\S$/.test(prev.textContent) && /^\S/.test(block.textContent)) prev.append(' ');
            prev.append(...block.childNodes);
            placeCaret(prev, at);
            dirty.add(prev);
            save(prev, { text: blockMarkdown(prev), joinNext: true, expectNext });
          }
        }
        return;
      }
      if (e.key.startsWith('Arrow') && !e.shiftKey && !mod && getSelection().isCollapsed) {
        const up = e.key === 'ArrowUp' && onFirstLine(block);
        const down = e.key === 'ArrowDown' && onLastLine(block);
        const left = e.key === 'ArrowLeft' && caretOffset(block) === 0;
        const right = e.key === 'ArrowRight' && caretOffset(block) === block.textContent.length;
        if ((up || left) && moveTo(block, -1, true)) e.preventDefault();
        else if ((down || right) && moveTo(block, 1, false)) e.preventDefault();
      }
    };

    const onPaste = (e) => {
      const block = e.target.closest?.('[contenteditable="true"]');
      if (!block) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault();
        const anchor = block.__anchor ?? (block.__atEnd ? null : holderOf(block));
        if (anchor) uploadImage(files[0], anchor);
        else setState('Write something first, then drop the image after it', 2500);
        return;
      }
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');
      if (!html && !text) return;
      e.preventDefault();
      const sel = getSelection();
      if (isUrl(text) && isText(block)) {
        const url = text.trim();
        if (sel.isCollapsed) {
          document.execCommand('insertHTML', false, `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>\u200B`);
        } else document.execCommand('createLink', false, url);
        schedule(block);
        return;
      }
      const paras = html && !isUrl(text) ? htmlToBlocks(html) : textToBlocks(text);
      if (!paras.length) return;
      if (!isText(block)) {
        document.execCommand('insertText', false, paras.join(' ').replace(/[*_`~]/g, ''));
        schedule(block);
        return;
      }
      if (paras.length > 1 && kindOf(block) === 'new' && !block.textContent.trim()) {
        // Nothing here yet: the whole passage goes in as blocks of its own.
        const anchor = block.__anchor;
        dirty.delete(block);
        block.remove();
        if (anchor) insertAfter(anchor, paras.join('\n\n'), { skip: paras.length - 1, caret: 1e9 });
        else {
          sessionStorage.setItem(
            KEY_STASH,
            JSON.stringify({ index: blocks().length + paras.length - 1, caret: 1e9, base: null }),
          );
          send('insert-after', { text: paras.join('\n\n'), atEnd: true }, {});
        }
        return;
      }
      const first = paras[0].replace(/^(#{1,6} |[-*] |\d+\. |> )/, '');
      document.execCommand('insertHTML', false, inlineToHtml(first));
      if (paras.length > 1 && kindOf(block) === 'block') {
        // The rest becomes blocks of its own after this one.
        dirty.add(block);
        save(
          block,
          { text: blockMarkdown(block), after: paras.slice(1).join('\n\n') },
          { caret: 1e9, skip: paras.length - 1 },
        );
        return;
      }
      schedule(block);
    };

    /** Copying from a block puts its markdown on the clipboard, not its HTML. */
    const onCopy = (e) => {
      const sel = getSelection();
      const block = e.target.closest?.('[contenteditable="true"]');
      if (!block || !sel?.rangeCount || sel.isCollapsed || !selectionInside(block)) return;
      const box = document.createElement('div');
      box.append(sel.getRangeAt(0).cloneContents());
      const md = toMarkdown(box).replace(/[ \t]+/g, ' ').trim();
      if (!md) return;
      e.preventDefault();
      e.clipboardData.setData('text/plain', md);
      e.clipboardData.setData('text/html', box.innerHTML);
    };

    // Dropping an image file onto the page adds it after the block it lands on.
    let dropTarget = null;
    const onDragOver = (e) => {
      if (![...(e.dataTransfer?.types ?? [])].includes('Files')) return;
      e.preventDefault();
      const holder = e.target.closest?.('.prose [data-src]') ?? [...blocks()].filter((b) => b.closest('.prose')).at(-1);
      if (dropTarget !== holder) {
        dropTarget?.classList.remove('note-editor-drop');
        dropTarget = holder;
        holder?.classList.add('note-editor-drop');
      }
    };
    const onDrop = (e) => {
      const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      dropTarget?.classList.remove('note-editor-drop');
      if (!files.length || !dropTarget) return;
      e.preventDefault();
      uploadImage(files[0], dropTarget);
      dropTarget = null;
    };

    const onClick = (e) => {
      const card = e.target.closest?.(CARD);
      const link = e.target.closest?.('a');
      if (link && link.closest('[contenteditable="true"]')) {
        e.preventDefault(); // edit the link, don't follow it
        return;
      }
      if (card && card.matches('[data-src]') && !e.target.closest('figcaption')) {
        e.preventDefault();
        if (e.detail === 2 && !['figure', 'divider'].includes(cardKind(card))) editSource(card);
        else selectCard(card);
        return;
      }
      if (!e.target.closest('.note-editor-ui, .note-editor-source')) deselectCard();
    };

    const onBlur = (e) => {
      const block = e.target.closest?.('[contenteditable="true"]');
      if (block && dirty.has(block)) save(block);
      setTimeout(showPlus, 0);
    };
    const onFocus = (e) => {
      if (e.target.matches?.(CARD)) return;
      deselectCard();
      showPlus();
    };
    const onSelection = () => {
      reportContext();
      showBar();
      countWords();
    };
    let scrollTimer = null;
    const onScroll = () => {
      ui.toolbar.hide();
      ui.plus.hide();
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (selectedCard) selectCard(selectedCard);
        else {
          showBar();
          showPlus();
        }
      }, 150);
    };

    /** Make every block on the page editable and remember what it showed. */
    const prepare = () => {
      stampFences(article);
      for (const holder of blocks()) {
        original.set(holder, holder.textContent);
        const el = editableOf(holder);
        if (el) {
          el.contentEditable = 'true';
          el.dataset.placeholder = placeholderFor(el);
          baseline.set(el, blockMarkdown(el));
        }
        if (holder.tagName === 'ASIDE' && !isCard(holder)) {
          for (const p of holder.querySelectorAll(':scope > p')) {
            p.contentEditable = 'true';
            baseline.set(p, blockMarkdown(p));
          }
        }
        if (isCard(holder)) {
          holder.classList.add('note-editor-card');
          holder.tabIndex = -1;
        }
      }
      // An empty note: somewhere to start typing.
      if (!article.querySelector('.prose [data-src], .prose .note-editor-new')) {
        newBlockAfter(null);
      }
      countWords();
    };

    /**
     * The file changed because of a save from this page. Astro re-rendered
     * it, but the reload it would normally send was held back (see
     * integration.mjs). Fetch the fresh page and swap the article's blocks in
     * place: new source ranges, no flash, caret kept.
     */
    let refreshing = false;
    let refreshAgain = false;
    let refreshWith = null;
    const refresh = async (shape) => {
      if (shape?.fences) refreshWith = shape;
      if (refreshing) {
        refreshAgain = true;
        return;
      }
      shape = refreshWith;
      refreshWith = null;
      refreshing = true;
      try {
        const res = await fetch(location.href, { cache: 'no-store' });
        const fresh = new DOMParser()
          .parseFromString(await res.text(), 'text/html')
          .querySelector('article');
        if (!fresh || !on) return;
        // The refresh message carries the file's new shape; only an old server
        // leaves it out, and then it is asked for.
        if (shape?.fences) take(shape);
        else await hello();
        stampFences(fresh);
        // Plain typing changes no block's place: update the source ranges and
        // any other block's text, and leave the one being typed in alone. Only
        // a block added, removed or turned into another kind (a heading, say)
        // needs the whole article swapped, with the caret carried across.
        const before = blocks();
        const after = [...fresh.querySelectorAll(BLOCK_SELECTOR)];
        const active = document.activeElement?.closest?.('[contenteditable="true"]');
        // A new block on the page that is still to be written (or a split
        // whose write is queued) does not change the shape yet; the write that
        // adds it brings its own refresh.
        const phantomOk = writes.length > 0 || !article.querySelector('.note-editor-new');
        const sameShape =
          before.length === after.length &&
          phantomOk &&
          before.every(
            (o, i) =>
              o.tagName === after[i].tagName &&
              o.className.replace(/\s*(note-editor-\S+|is-selected)/g, '').trim() ===
                after[i].className.trim(),
          );
        if (sameShape) {
          before.forEach((o, i) => {
            const n = after[i];
            if (n.dataset.src) o.dataset.src = n.dataset.src;
            original.set(o, n.textContent);
            if (isCard(o) && !o.contains(document.activeElement) && o.innerHTML !== n.innerHTML) {
              // A figure's alt or caption changed, a code block was edited: take
              // the new markup whole, attributes included (a fence's language).
              o.innerHTML = n.innerHTML;
              for (const { name, value } of [...n.attributes]) {
                if (name !== 'class') o.setAttribute(name, value);
              }
              const cap = editableOf(o);
              if (cap) {
                cap.contentEditable = 'true';
                cap.dataset.placeholder = placeholderFor(cap);
                baseline.set(cap, blockMarkdown(cap));
              }
              return;
            }
            const oe = editableOf(o);
            const ne = editableOf(n);
            if (!oe || !ne) return;
            // The first half of a split whose write is still queued: the file
            // still holds the whole paragraph, the page already shows the halves.
            if (o.nextElementSibling?.__split) return;
            if (oe === active) {
              // The block being typed in: only take the file's version when
              // nothing typed here is still waiting to be saved.
              if (dirty.has(oe) || oe.innerHTML === ne.innerHTML) return;
              const at = caretOffset(oe) ?? 0;
              oe.innerHTML = ne.innerHTML;
              placeCaret(oe, Math.min(at, oe.textContent.length));
            } else if (oe.innerHTML !== ne.innerHTML) {
              oe.innerHTML = ne.innerHTML;
            }
            baseline.set(oe, blockMarkdown(oe));
          });
          countWords();
          // A card edited in place stays selected; the rest of the stash is moot.
          const s = JSON.parse(sessionStorage.getItem(KEY_STASH) || 'null');
          sessionStorage.removeItem(KEY_STASH);
          if (s?.selectCard && isCard(blocks()[s.index]) && !selectedCard) selectCard(blocks()[s.index]);
          if (ui.panel.kind() === 'settings') showSettings();
          return;
        }
        stashCurrent();
        for (const t of timers.values()) clearTimeout(t);
        timers.clear();
        dirty.clear();
        original.clear();
        baseline.clear();
        selectedCard = null;
        ui.toolbar.hide();
        ui.menu.hide();
        ui.plus.hide();
        article.innerHTML = fresh.innerHTML;
        prepare();
        restore();
        setState(dirty.size ? 'Unsaved' : 'Saved');
        if (ui.panel.kind() === 'settings') showSettings();
      } catch (err) {
        console.warn('[note-editor] refresh failed, reloading', err);
        location.reload();
      } finally {
        refreshing = false;
        if (refreshAgain) {
          refreshAgain = false;
          refresh();
        } else if (awaitingRefresh) {
          nextWrite();
        }
      }
    };

    /* ---- turning editing on and off ---- */
    const setEditing = async (state) => {
      if (state === on) return;
      on = state;
      sessionStorage.setItem(KEY_ON, state ? '1' : '');
      pill.hidden = !state;
      if (state) {
        document.head.append(style);
        ui.mount();
        article.classList.toggle('note-editor-focus', Boolean(sessionStorage.getItem(KEY_FOCUS)));
        article.addEventListener('beforeinput', onBeforeInput);
        article.addEventListener('input', onInput);
        article.addEventListener('compositionstart', onComposition);
        article.addEventListener('compositionend', onComposition);
        article.addEventListener('keydown', onKeydown);
        article.addEventListener('paste', onPaste);
        article.addEventListener('copy', onCopy);
        article.addEventListener('click', onClick);
        article.addEventListener('focusin', onFocus);
        article.addEventListener('focusout', onBlur);
        document.addEventListener('keydown', onGlobalKey);
        article.addEventListener('dragover', onDragOver);
        article.addEventListener('drop', onDrop);
        document.addEventListener('selectionchange', onSelection);
        window.addEventListener('scroll', onScroll, { passive: true });
        await hello();
        if (!on) return;
        prepare();
        restore();
        showChanged();
      } else {
        saveAll();
        style.remove();
        ui.unmount();
        article.classList.remove('note-editor-focus');
        if (globalThis.CSS?.highlights) CSS.highlights.delete('note-editor-tk');
        for (const el of article.querySelectorAll('.note-editor-new, .note-editor-source')) el.remove();
        for (const el of article.querySelectorAll('[contenteditable="true"]')) {
          el.removeAttribute('contenteditable');
          delete el.dataset.placeholder;
        }
        for (const el of article.querySelectorAll('.note-editor-card')) {
          el.classList.remove('note-editor-card', 'is-selected');
          el.removeAttribute('tabindex');
          el.hidden = false;
        }
        article.removeEventListener('beforeinput', onBeforeInput);
        article.removeEventListener('input', onInput);
        article.removeEventListener('compositionstart', onComposition);
        article.removeEventListener('compositionend', onComposition);
        article.removeEventListener('keydown', onKeydown);
        article.removeEventListener('paste', onPaste);
        article.removeEventListener('copy', onCopy);
        article.removeEventListener('click', onClick);
        article.removeEventListener('focusin', onFocus);
        article.removeEventListener('focusout', onBlur);
        document.removeEventListener('keydown', onGlobalKey);
        article.removeEventListener('dragover', onDragOver);
        article.removeEventListener('drop', onDrop);
        document.removeEventListener('selectionchange', onSelection);
        window.removeEventListener('scroll', onScroll);
      }
    };

    /**
     * After a reload that this page did not ask for (Claude, an editor), light
     * up the blocks whose text is not what it was, so the change is visible
     * without reading the whole note again.
     */
    const showChanged = () => {
      const raw = sessionStorage.getItem(KEY_TEXTS);
      if (!raw) return;
      const { at, texts, path } = JSON.parse(raw);
      // Astro often reloads twice for one change; the snapshot from before the
      // first reload has to outlive the second, or the flash is lost with it.
      if (Date.now() - at > 4000) sessionStorage.removeItem(KEY_TEXTS);
      if (path !== location.pathname) return; // another note's snapshot
      const was = new Set(texts);
      const changed = blocks().filter((b) => !was.has(b.textContent.trim()));
      if (!changed.length) return;
      for (const b of changed) {
        b.classList.add('note-editor-changed');
        b.addEventListener('animationend', () => b.classList.remove('note-editor-changed'), {
          once: true,
        });
      }
      setState(`Changed outside the editor · ${changed.length} block${changed.length > 1 ? 's' : ''}`, 5000);
      const first = changed[0].getBoundingClientRect();
      if (first.bottom < 0 || first.top > innerHeight) {
        changed[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };

    /** After a refresh, or a reload, put the caret back. */
    const restore = () => {
      // After a reload, put the page back where it was first.
      const y = sessionStorage.getItem(KEY_SCROLL);
      if (y !== null) {
        sessionStorage.removeItem(KEY_SCROLL);
        scrollTo(0, Number(y));
      }
      const raw = sessionStorage.getItem(KEY_STASH);
      if (!raw) return;
      sessionStorage.removeItem(KEY_STASH);
      const s = JSON.parse(raw);
      let index = s.index;
      if (s.focusNext) index += 1;
      if (s.focusPrev) index -= 1;
      // A new block that never reached the file: open it again under its anchor.
      if (s.html !== undefined && s.base === null) {
        const anchor = s.atEnd ? null : blocks()[s.anchorIndex];
        if (!anchor && !s.atEnd) return;
        const fresh = article.querySelector('.note-editor-new') ?? newBlockAfter(anchor);
        if (s.html) {
          fresh.innerHTML = s.html;
          schedule(fresh);
          placeCaret(fresh, s.caret);
        }
        return;
      }
      const holder = blocks()[index] ?? (s.atEnd ? blocks().at(-1) : null);
      if (!holder) return;
      if (s.editSource && isCard(holder)) {
        holder.scrollIntoView({ block: 'nearest' });
        editSource(holder);
        return;
      }
      if (s.selectCard && isCard(holder)) {
        selectCard(holder);
        holder.scrollIntoView({ block: 'nearest' });
        return;
      }
      const el = editableOf(holder);
      if (!el) {
        if (isCard(holder)) selectCard(holder);
        return;
      }
      // Unsaved typing from before the reload goes back only if the block at
      // that index still shows what the file had for it.
      if (s.html !== undefined) {
        if (blockMarkdown(el) === s.base) {
          el.innerHTML = s.html;
          schedule(el);
        } else {
          console.warn(
            '[note-editor] dropped unsaved typing: the block changed underneath it',
            s.html,
          );
        }
      }
      placeCaret(el, s.focusNext ? 0 : Math.min(s.caret ?? 0, el.textContent.length));
      if (s.selectAll) {
        const r = document.createRange();
        r.selectNodeContents(el);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
      }
      const box = el.getBoundingClientRect();
      if (box.bottom < 0 || box.top > innerHeight) el.scrollIntoView({ block: 'center' });
      // Enter was pressed in a new block: carry on in the next one.
      if (s.openBelow) newBlockAfter(holder);
      showPlus();
    };

    // Before a refresh or reload: keep the caret, and any text typed since the
    // save went out (only that — never text the file already has).
    const stashCurrent = () => {
      const active = document.activeElement?.closest?.('[contenteditable="true"]');
      if (!active) return;
      // A new block nothing has been written for yet (Astro sometimes reloads
      // twice for one change): reopen it, with whatever it holds, after the reload.
      if ((active.__anchor || active.__atEnd) && !active.__split && !baseline.has(active)) {
        stash(active, { html: active.innerHTML });
        return;
      }
      const previous = JSON.parse(sessionStorage.getItem(KEY_STASH) || '{}');
      const structural = previous.focusNext || previous.focusPrev;
      const typedSince =
        !structural && dirty.has(active) && baseline.get(active) !== blockMarkdown(active);
      stash(active, {
        ...(structural
          ? {
              index: previous.index,
              focusNext: previous.focusNext,
              focusPrev: previous.focusPrev,
              caret: previous.caret,
            }
          : {}),
        ...(previous.openBelow ? { openBelow: true } : {}),
        ...(typedSince ? { html: active.innerHTML } : {}),
      });
    };
    window.addEventListener('beforeunload', () => {
      if (!on) return;
      sessionStorage.setItem(KEY_SCROLL, String(scrollY));
      // What every block said, so the ones a reload changes can be pointed out.
      const previous = JSON.parse(sessionStorage.getItem(KEY_TEXTS) || 'null');
      if (!previous || Date.now() - previous.at > 4000) {
        sessionStorage.setItem(
          KEY_TEXTS,
          JSON.stringify({
            at: Date.now(),
            path: location.pathname,
            texts: blocks().map((b) => b.textContent.trim()),
          }),
        );
      }
      stashCurrent();
    });

    app.onToggled(({ state }) => setEditing(state));
    if (sessionStorage.getItem(KEY_ON)) {
      app.toggleState({ state: true });
      setEditing(true);
    }
  },
};
