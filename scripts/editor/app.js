/**
 * Dev-toolbar app: edit a note in place, the way a Ghost post is edited.
 *
 * Toggle it on from Astro's dev toolbar and every paragraph, heading, list
 * item, quote, callout, caption, the title and the description become
 * editable. Each block knows its character range in the MDX file
 * (`data-src`, stamped by stamp.mjs); when you pause, the block's new text is
 * written into exactly that range. Astro re-renders the page; the reload it
 * would send is held back (integration.mjs) and this app swaps the fresh
 * blocks in instead, with the caret where it was. Changes from anywhere else
 * still reload the page.
 *
 * Writing: markdown converts as you type (**bold**, *italic*, `code`,
 * [text](url), ~~struck~~; "## ", "- ", "1. ", "> " at the start of a block;
 * "---" for a divider). Select text for a formatting bar. Type "/" in an
 * empty block, or click its "+", for headings, lists, quotes, dividers,
 * images and callouts. Enter splits, Backspace at the start of a heading,
 * item or quote makes it a paragraph, arrow keys move between blocks, and a
 * figure or divider is a card: click to select, Backspace to remove, Enter
 * for a paragraph after it. Paste keeps markdown and links; drop an image to
 * add it.
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
const IDLE_MS = 2000;
const EDITABLE = 'P, H1, H2, H3, H4, LI, FIGCAPTION';
const CARD = 'FIGURE, HR';
const CALLOUT_LABELS = {
  hypothesis: 'Current hypothesis',
  surprise: 'What surprised me',
  failed: 'What didn’t work',
  update: 'Update',
  note: 'Note',
};

const slugOf = () => /^\/writing\/([a-z0-9-]+)\/?$/.exec(location.pathname)?.[1] ?? null;

/* ----------------------------------------------------------------------------
   Caret helpers: character offsets within a block's text.
   ------------------------------------------------------------------------- */
const caretOffset = (el) => {
  const sel = getSelection();
  if (!sel?.rangeCount || !el.contains(sel.anchorNode)) return null;
  const r = sel.getRangeAt(0).cloneRange();
  r.selectNodeContents(el);
  r.setEnd(sel.anchorNode, sel.anchorOffset);
  return r.toString().length;
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

const wordCount = (root) =>
  (root.textContent.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? []).length;

/* ----------------------------------------------------------------------------
   The app
   ------------------------------------------------------------------------- */
export default {
  init(canvas, app, server) {
    const slug = slugOf();
    const article = document.querySelector('article');
    if (!slug || !article?.querySelector('.prose [data-src]')) return;

    let hash = null;
    let on = false;
    let msgId = 0;
    const pending = new Map(); // id -> { block, kind, then }
    const timers = new Map(); // block -> timeout
    const dirty = new Set();
    const ui = createUi();

    /* ---- chrome: a small status pill in the toolbar's shadow root ---- */
    const pill = document.createElement('div');
    pill.hidden = true;
    pill.innerHTML = `
      <style>
        div.pill { position: fixed; top: 12px; right: 12px; z-index: 2147483000;
          font: 500 12px/1 system-ui, sans-serif; letter-spacing: .02em; color: #1c1b19;
          background: ${GOLD}; padding: 7px 10px; border-radius: 999px;
          box-shadow: 0 1px 6px rgba(0,0,0,.25); display: flex; gap: 8px; align-items: center; }
        div.pill .state { opacity: .75; }
        div.pill .words { opacity: .6; font-weight: 400; }
      </style>
      <div class="pill"><strong>Editing</strong> <span class="state">Saved</span>
        <span class="words"></span></div>`;
    canvas.append(pill);
    const stateEl = pill.querySelector('.state');
    const wordsEl = pill.querySelector('.words');
    const setState = (text) => {
      stateEl.textContent = text;
    };
    let wordsTimer = null;
    const countWords = () => {
      clearTimeout(wordsTimer);
      wordsTimer = setTimeout(() => {
        const prose = article.querySelector('.prose');
        if (prose) wordsEl.textContent = `${wordCount(prose).toLocaleString()} words`;
      }, 400);
    };

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
      .note-editor-new:empty::before, [contenteditable="true"]:is(p, li, h2, h3, figcaption):empty::before {
        content: attr(data-placeholder); color: color-mix(in srgb, currentColor 40%, transparent); pointer-events: none; }
      .note-editor-drop { outline: 2px dashed ${GOLD} !important; outline-offset: 8px; }
    `;

    /* ---- messaging ---- */
    // Writes go one at a time, each with the hash the last reply gave, so a
    // blur save and an idle save landing together never make the second stale.
    const WRITES = new Set(['replace', 'insert-after', 'attrs', 'frontmatter', 'figure']);
    const writes = [];
    let writing = false;
    const nextWrite = () => {
      clearTimeout(writeTimer);
      writing = false;
      const next = writes.shift();
      if (next) dispatch(next);
    };
    let writeTimer = null;
    const dispatch = ({ event, payload, id }) => {
      writing = true;
      server.send(`note-editor:${event}`, { id, slug, hash, ...payload });
      // No reply within a few seconds means the server is gone; don't hold the rest.
      clearTimeout(writeTimer);
      writeTimer = setTimeout(nextWrite, 5000);
    };
    const send = (event, payload, meta) => {
      const id = ++msgId;
      if (meta) pending.set(id, meta);
      if (WRITES.has(event)) {
        if (writing) writes.push({ event, payload, id });
        else dispatch({ event, payload, id });
      } else {
        server.send(`note-editor:${event}`, { id, slug, hash, ...payload });
      }
      return id;
    };

    server.on('note-editor:hello', (msg) => {
      hash = msg.hash;
    });
    let stashFor = null; // the write whose refresh will consume the stash
    server.on('note-editor:saved', (msg) => {
      hash = msg.hash;
      const meta = pending.get(msg.id);
      pending.delete(msg.id);
      // Nothing changed, so no refresh is coming to use the caret stash.
      if (msg.changed === false && stashFor === msg.id) sessionStorage.removeItem(KEY_STASH);
      // Typing that landed after the save went out is still unsaved.
      if (meta?.block && baseline.get(meta.block) === blockMarkdown(meta.block))
        dirty.delete(meta.block);
      setState(dirty.size ? 'Unsaved' : 'Saved');
      meta?.then?.();
      nextWrite();
      // A `refresh` follows from the server; if the write changed nothing, it won't.
    });
    server.on('note-editor:stale', () => {
      setState('File changed elsewhere, reloading');
      pending.clear();
      writes.length = 0;
      writing = false;
      // The content change that made us stale also triggers Astro's reload.
    });
    server.on('note-editor:refresh', () => refresh());
    server.on('note-editor:error', (msg) => {
      setState(`Not saved: ${msg.message}`);
      console.warn('[note-editor]', msg.message);
      // Don't keep retrying the same rejected text across reloads.
      const meta = pending.get(msg.id);
      pending.delete(msg.id);
      if (meta?.block) dirty.delete(meta.block);
      sessionStorage.removeItem(KEY_STASH);
      nextWrite();
    });
    server.on('note-editor:assets', (msg) => {
      const meta = pending.get(msg.id);
      pending.delete(msg.id);
      meta?.then?.(msg.files);
    });
    server.on('note-editor:uploaded', (msg) => {
      const meta = pending.get(msg.id);
      pending.delete(msg.id);
      meta?.then?.(msg.file);
    });

    /* ---- what is editable ---- */
    const BLOCK_SELECTOR = '.prose [data-src], .note-header h1, .note-header .description';
    const blocks = () => [...article.querySelectorAll(BLOCK_SELECTOR)];
    const editableOf = (el) =>
      el.matches(EDITABLE)
        ? el
        : el.tagName === 'FIGURE'
          ? el.querySelector('figcaption')
          : el.tagName === 'ASIDE'
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
    const kindOf = (el) => {
      if (el.classList.contains('note-editor-new')) return 'new';
      if (el.matches('.note-header h1')) return 'title';
      if (el.matches('.note-header .description')) return 'description';
      if (el.tagName === 'FIGCAPTION') return 'caption';
      if (el.classList.contains('callout-label')) return 'label';
      return 'block';
    };
    const isText = (el) => kindOf(el) === 'block' || kindOf(el) === 'new';
    const placeholderFor = (el) =>
      el.tagName === 'FIGCAPTION'
        ? 'Caption'
        : el.tagName === 'LI'
          ? 'List item'
          : /^H/.test(el.tagName)
            ? 'Heading'
            : 'Type here, or "/" for a menu…';

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
      const index = block.__anchor
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
        JSON.stringify({ index: index + skip, caret, base, anchorIndex, ...rest }),
      );
    };

    /**
     * Open an empty block after `anchor`, in the page only. Markdown has no
     * empty paragraph, so nothing is written until something is typed; then it
     * is inserted after the anchor's range. After a list item, the new block is
     * the next item.
     */
    const newBlockAfter = (anchor, { asListItem = anchor.tagName === 'LI' } = {}) => {
      const el = document.createElement(asListItem ? 'li' : 'p');
      el.className = 'note-editor-new';
      el.contentEditable = 'true';
      el.__anchor = anchor;
      el.dataset.placeholder = placeholderFor(el);
      anchor.after(el);
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
        send('frontmatter', { field: kind, value: block.textContent }, { block });
        return;
      }
      if (kind === 'new') {
        // Not in the file yet: insert after the block it was opened under. A
        // list item typed under a list item joins that list.
        const text = blockMarkdown(block);
        if (!text || !block.textContent.trim()) return;
        if (block.__split) return; // the split already put this text in the file
        const anchor = block.__anchor;
        const tight = anchor.tagName === 'LI' && /^([-*]|\d+\.) /.test(text);
        baseline.set(block, text);
        send('insert-after', { ...rangeOf(anchor), text, tight }, { block });
        return;
      }
      const range = rangeOf(block);
      if (!range) return;
      if (kind === 'caption') {
        baseline.set(block, blockMarkdown(block));
        send('attrs', { ...range, set: { caption: block.textContent.trim() } }, { block });
        return;
      }
      if (kind === 'label') {
        const aside = block.closest('aside');
        const type = /callout-(\w+)/.exec(aside.className)?.[1];
        const label = block.textContent.trim();
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
      send('insert-after', { ...rangeOf(anchor), text }, {});
    };
    const insertDivider = (anchor) => insertAfter(anchor, '---', { selectCard: true });
    const insertCallout = (anchor) =>
      insertAfter(anchor, '<Callout type="note">\n  Something worth setting apart.\n</Callout>', {
        selectAll: true,
      });
    const insertFigure = (anchor, file) => {
      const index = blocks().indexOf(anchor) + 1 + anchor.querySelectorAll('[data-src]').length;
      sessionStorage.setItem(
        KEY_STASH,
        JSON.stringify({ index, caret: 0, base: null, selectCard: true }),
      );
      setState('Adding image…');
      send('figure', { ...rangeOf(anchor), file, alt: '' }, {});
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

    /**
     * The block menu ("/" or "+"): what an empty block can become, or what can
     * come after a card.
     */
    const menuItems = (el) => {
      const anchor = el.__anchor ?? holderOf(el);
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
      items.push(
        { key: '—', label: 'Divider', keywords: 'hr rule', run: () => insertDivider(after()) },
        {
          key: '▣',
          label: 'Image',
          hint: 'from src/assets',
          keywords: 'figure picture photo',
          run: () => pickImage(after()),
        },
        { key: '❝', label: 'Callout', keywords: 'aside note', run: () => insertCallout(after()) },
      );
      return items;
    };
    const pickImage = (anchor) => {
      send(
        'assets',
        {},
        {
          then: (files) => {
            const rect = anchor.getBoundingClientRect();
            ui.menu.show(
              rect,
              files.map((f) => ({ label: f, run: () => insertFigure(anchor, f) })),
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
    const askLink = (block, rect) => {
      const a = linkAt();
      if (!getSelection().rangeCount) return;
      const saved = getSelection().getRangeAt(0).cloneRange();
      ui.toolbar.prompt(rect, {
        value: a?.getAttribute('href') ?? '',
        placeholder: 'Paste or type a link, Enter to apply, empty to remove',
        onSubmit: (href) => {
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
              `<a href="${href.replace(/"/g, '%22')}">${href.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])}</a>\u200B`,
            );
          } else if (href) document.execCommand('createLink', false, href);
          else document.execCommand('unlink');
          schedule(block);
          ui.toolbar.hide();
          block.focus({ preventScroll: true });
        },
        onCancel: () => {
          ui.toolbar.hide();
          const sel = getSelection();
          sel.removeAllRanges();
          sel.addRange(saved);
          block.focus({ preventScroll: true });
        },
      });
    };
    const barItems = (block, rect) => {
      const kind = kindOfBlock(block);
      const isHeading = /^h[1-4]$/.test(kind);
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
          title: 'Code',
          active: Boolean(getSelection().anchorNode?.parentElement?.closest('code')),
          run: () => wrapSelection(block, 'code'),
        },
        {
          html: '<span class="s">S</span>',
          title: 'Strikethrough',
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
            title: 'Heading',
            active: kind === 'h2',
            run: () => convert(block, kind === 'h2' ? 'p' : 'h2'),
          },
          {
            label: 'H3',
            title: 'Subheading',
            active: kind === 'h3',
            run: () => convert(block, kind === 'h3' ? 'p' : 'h3'),
          },
          {
            html: '“ ”',
            title: 'Quote',
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
        document.execCommand(
          'insertHTML',
          false,
          `<${tag}>${text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])}</${tag}>`,
        );
      }
      schedule(block);
      showBar();
    };
    const setCalloutType = (aside, type) => {
      const label = aside.querySelector('.callout-label');
      const range = rangeOf(aside);
      const custom =
        label &&
        label.textContent.trim() !== CALLOUT_LABELS[/callout-(\w+)/.exec(aside.className)?.[1]];
      stash(editableOf(aside) ?? label, {});
      setState('Saving…');
      send('attrs', { ...range, set: { type, ...(custom ? {} : { label: null }) } }, {});
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
        if (block.isConnected && /^\/\S*$/.test(block.textContent.replace(/\u00A0/g, ' ').trim()))
          block.textContent = '';
        menuFor = null;
        item.run();
      });
    };

    /* ---- cards: figures and dividers ---- */
    let selectedCard = null;
    const selectCard = (card) => {
      deselectCard();
      selectedCard = card;
      card.classList.add('is-selected');
      card.focus({ preventScroll: true });
      const items = [];
      if (card.tagName === 'FIGURE' && card.querySelector(':scope > img')) {
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
                    send('attrs', { ...rangeOf(card), set: { alt } }, {});
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
          { sep: true },
        );
      }
      items.push({ label: 'Remove', danger: true, run: () => removeCard(card) });
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
      send('replace', { ...rangeOf(card), delete: true }, {});
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
    const onInput = (e) => {
      const block = e.target.closest?.('[contenteditable="true"]');
      if (!block) return;
      // Markdown as you type: inline shortcuts close on their last character,
      // block shortcuts on the space after their marker.
      if (e.inputType === 'insertText' && isText(block)) {
        const sel = getSelection();
        const node = sel.anchorNode;
        if (node?.nodeType === Node.TEXT_NODE && sel.isCollapsed) {
          const before = node.data.slice(0, sel.anchorOffset);
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
        {
          // A trailing space in a contenteditable is a no-break space.
          const head = block.textContent.slice(0, caretOffset(block) ?? 0).replace(/\u00A0/g, ' ');
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
      const plain = block.textContent.replace(/\u00A0/g, ' ').trim();
      if (isText(block) && block.tagName === 'P' && plain === '---') {
        // A divider: written as its own block, replacing this empty one.
        block.textContent = '';
        const anchor = block.__anchor ?? holderOf(block);
        if (kindOf(block) === 'new') {
          dirty.delete(block);
          block.remove();
          insertDivider(anchor);
        } else {
          dirty.add(block);
          save(block, { text: '---' }, { selectCard: true });
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
        if (holder.matches(CARD)) out.push(holder);
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
      }
      return out;
    };
    const moveTo = (from, dir, atEnd) => {
      const list = stops();
      const i = list.indexOf(from);
      const target = list[i + dir];
      if (!target) return false;
      deselectCard();
      if (target.matches(CARD)) selectCard(target);
      else placeCaret(target, atEnd ? target.textContent.length : 0);
      target.scrollIntoView?.({ block: 'nearest' });
      return true;
    };

    const onKeydown = (e) => {
      if (ui.menu.open && ui.menu.key(e)) return;
      if (selectedCard && e.target === selectedCard) {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          removeCard(selectedCard);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const card = selectedCard;
          deselectCard();
          newBlockAfter(card, { asListItem: false });
        } else if (e.key === 'Escape') {
          deselectCard();
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
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 's') {
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
      if (mod && e.key === 'b') {
        e.preventDefault();
        exec(block, 'bold');
        return;
      }
      if (mod && e.key === 'i') {
        e.preventDefault();
        exec(block, 'italic');
        return;
      }
      if (mod && e.key === 'k') {
        e.preventDefault();
        askLink(block, caretRect(block));
        return;
      }
      if (e.key === 'Escape') {
        ui.toolbar.hide();
        ui.menu.hide();
        block.blur();
        return;
      }
      const kind = kindOf(block);
      if (e.key === 'Enter') {
        e.preventDefault();
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
          block.remove();
          ui.menu.hide();
          const back = editableOf(anchor);
          if (back) placeCaret(back, back.textContent.length);
          else if (anchor.matches(CARD)) selectCard(anchor);
          setState(dirty.size ? 'Unsaved' : 'Saved');
          return;
        }
        if (kind === 'caption' && !block.textContent) {
          // An empty caption goes; the figure stays selected.
          e.preventDefault();
          const card = block.closest('figure');
          const range = rangeOf(card);
          clearTimeout(timers.get(block));
          dirty.delete(block);
          block.remove();
          if (baseline.get(block) !== '') {
            stash(card, { selectCard: true });
            send('attrs', { ...range, set: { caption: null } }, {});
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
          // Join with the block above, the way one editor would.
          const list = stops();
          const prev = list[list.indexOf(block) - 1];
          if (
            prev &&
            !prev.matches(CARD) &&
            isText(prev) &&
            kindOf(prev) === 'block' &&
            kindOfBlock(prev) === kindOfBlock(block)
          ) {
            e.preventDefault();
            const at = prev.textContent.length;
            const gone = rangeOf(block);
            holderOf(block).remove();
            prev.append(...block.childNodes);
            placeCaret(prev, at);
            dirty.add(prev);
            save(prev, { text: blockMarkdown(prev), remove: gone });
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
        uploadImage(files[0], block.__anchor ?? holderOf(block));
        return;
      }
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');
      if (!html && !text) return;
      e.preventDefault();
      const sel = getSelection();
      if (isUrl(text) && !sel.isCollapsed && isText(block)) {
        document.execCommand('createLink', false, text.trim());
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
        insertAfter(anchor, paras.join('\n\n'), { skip: paras.length - 1, caret: 1e9 });
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

    // Dropping an image file onto the page adds it after the block it lands on.
    let dropTarget = null;
    const onDragOver = (e) => {
      if (![...(e.dataTransfer?.types ?? [])].includes('Files')) return;
      e.preventDefault();
      const holder = e.target.closest?.('[data-src]') ?? [...blocks()].at(-1);
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
        selectCard(card);
        return;
      }
      if (!e.target.closest('.note-editor-ui')) deselectCard();
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
      for (const holder of blocks()) {
        original.set(holder, holder.textContent);
        const el = editableOf(holder);
        if (el) {
          el.contentEditable = 'true';
          el.dataset.placeholder = placeholderFor(el);
          baseline.set(el, blockMarkdown(el));
        }
        if (holder.tagName === 'ASIDE') {
          for (const p of holder.querySelectorAll(':scope > p')) {
            p.contentEditable = 'true';
            baseline.set(p, blockMarkdown(p));
          }
        }
        if (holder.matches(CARD)) {
          holder.classList.add('note-editor-card');
          holder.tabIndex = -1;
        }
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
    const refresh = async () => {
      if (refreshing) {
        refreshAgain = true;
        return;
      }
      refreshing = true;
      try {
        const res = await fetch(location.href, { cache: 'no-store' });
        const fresh = new DOMParser()
          .parseFromString(await res.text(), 'text/html')
          .querySelector('article');
        if (!fresh || !on) return;
        send('hello', {});
        // Plain typing changes no block's place: update the source ranges and
        // any other block's text, and leave the one being typed in alone. Only
        // a block added, removed or turned into another kind (a heading, say)
        // needs the whole article swapped, with the caret carried across.
        const before = blocks();
        const after = [...fresh.querySelectorAll(BLOCK_SELECTOR)];
        const active = document.activeElement?.closest?.('[contenteditable="true"]');
        const sameShape =
          before.length === after.length &&
          !article.querySelector('.note-editor-new') &&
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
            if (
              o.matches(CARD) &&
              !o.contains(document.activeElement) &&
              o.innerHTML !== n.innerHTML
            ) {
              // A figure's alt or caption changed: take the new markup whole.
              o.innerHTML = n.innerHTML;
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
      } catch (err) {
        console.warn('[note-editor] refresh failed, reloading', err);
        location.reload();
      } finally {
        refreshing = false;
        if (refreshAgain) {
          refreshAgain = false;
          refresh();
        }
      }
    };

    /* ---- turning editing on and off ---- */
    const setEditing = (state) => {
      if (state === on) return;
      on = state;
      sessionStorage.setItem(KEY_ON, state ? '1' : '');
      pill.hidden = !state;
      if (state) {
        document.head.append(style);
        ui.mount();
        prepare();
        article.addEventListener('input', onInput);
        article.addEventListener('keydown', onKeydown);
        article.addEventListener('paste', onPaste);
        article.addEventListener('click', onClick);
        article.addEventListener('focusin', onFocus);
        article.addEventListener('focusout', onBlur);
        document.addEventListener('dragover', onDragOver);
        document.addEventListener('drop', onDrop);
        document.addEventListener('selectionchange', onSelection);
        window.addEventListener('scroll', onScroll, { passive: true });
        send('hello', {});
        restore();
      } else {
        saveAll();
        style.remove();
        ui.unmount();
        for (const el of article.querySelectorAll('.note-editor-new')) el.remove();
        for (const el of article.querySelectorAll('[contenteditable="true"]')) {
          el.removeAttribute('contenteditable');
          delete el.dataset.placeholder;
        }
        for (const el of article.querySelectorAll('.note-editor-card')) {
          el.classList.remove('note-editor-card', 'is-selected');
          el.removeAttribute('tabindex');
        }
        article.removeEventListener('input', onInput);
        article.removeEventListener('keydown', onKeydown);
        article.removeEventListener('paste', onPaste);
        article.removeEventListener('click', onClick);
        article.removeEventListener('focusin', onFocus);
        article.removeEventListener('focusout', onBlur);
        document.removeEventListener('dragover', onDragOver);
        document.removeEventListener('drop', onDrop);
        document.removeEventListener('selectionchange', onSelection);
        window.removeEventListener('scroll', onScroll);
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
        const anchor = blocks()[s.anchorIndex];
        if (!anchor) return;
        const fresh = newBlockAfter(anchor);
        if (s.html) {
          fresh.innerHTML = s.html;
          schedule(fresh);
          placeCaret(fresh, s.caret);
        }
        return;
      }
      const holder = blocks()[index];
      if (!holder) return;
      if (s.selectCard && holder.matches(CARD)) {
        selectCard(holder);
        holder.scrollIntoView({ block: 'nearest' });
        return;
      }
      const el = editableOf(holder);
      if (!el) {
        if (holder.matches(CARD)) selectCard(holder);
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
      if (active.__anchor && !active.__split && !baseline.has(active)) {
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
      stashCurrent();
    });

    app.onToggled(({ state }) => setEditing(state));
    if (sessionStorage.getItem(KEY_ON)) {
      app.toggleState({ state: true });
      setEditing(true);
    }
  },
};
