/**
 * Markdown on both sides of the page: what a block's DOM means as source, and
 * what typed or pasted markdown means as DOM. Only the inline forms the notes
 * use survive: emphasis, strong, code, links, strikethrough.
 */

const ZWSP = '​';

export const escapeText = (s) =>
  s
    .replaceAll(ZWSP, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[<{]/g, (c) => (c === '<' ? '&lt;' : '\\{'))
    .replace(/(^|\s)\*(?=\S)/g, '$1\\*');

/** One inline element or text node → markdown. */
/** Inline HTML the notes may use; kept as tags, since MDX accepts them. */
const KEPT_TAGS = new Set(['KBD', 'SUP', 'SUB', 'ABBR', 'MARK', 'CITE', 'SMALL', 'U', 'Q']);

export const toMarkdown = (node) => {
  if (node.nodeType === Node.TEXT_NODE) return escapeText(node.data);
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  if (node.matches('.note-editor-plus, .callout-label')) return '';
  const inner = [...node.childNodes].map(toMarkdown).join('');
  const style = node.getAttribute('style') ?? '';
  switch (node.tagName) {
    case 'EM':
    case 'I':
      return inner.trim() ? `*${inner}*` : inner;
    case 'STRONG':
    case 'B':
      // Google Docs pastes wrap everything in <b style="font-weight:normal">.
      if (/font-weight:\s*(normal|400)/.test(style)) return inner;
      return inner.trim() ? `**${inner}**` : inner;
    case 'SPAN': {
      // Google Docs spells bold and italic as styled spans.
      const bold = /font-weight:\s*(bold|[6-9]00)/.test(style);
      const italic = /font-style:\s*italic/.test(style);
      if (!inner.trim()) return inner;
      return bold && italic ? `***${inner}***` : bold ? `**${inner}**` : italic ? `*${inner}*` : inner;
    }
    case 'DEL':
    case 'S':
    case 'STRIKE':
      return inner.trim() ? `~~${inner}~~` : inner;
    case 'CODE':
      return `\`${inner}\``;
    case 'A':
      return `[${inner}](${node.getAttribute('href')})`;
    case 'BR':
      // A hard line break: a backslash before the newline, the CommonMark
      // spelling that survives re-wrapping (two trailing spaces would not).
      return '\\\n';
    default:
      if (KEPT_TAGS.has(node.tagName)) {
        const title = node.tagName === 'ABBR' && node.title ? ` title="${node.title.replace(/"/g, '&quot;')}"` : '';
        const tag = node.tagName.toLowerCase();
        return `<${tag}${title}>${inner}</${tag}>`;
      }
      return inner;
  }
};

/** The block's own marker: heading hashes, list bullet or number, quote. */
export const prefixFor = (el) => {
  switch (el.tagName) {
    case 'H1':
      return el.closest('.prose') ? '## ' : '';
    case 'H2':
      return '## ';
    case 'H3':
      return '### ';
    case 'H4':
      return '#### ';
    case 'LI': {
      const list = el.parentElement;
      if (list?.tagName === 'OL') {
        const n = Number(list.getAttribute('start') ?? 1) + [...list.children].indexOf(el);
        return `${n}. `;
      }
      return '- ';
    }
    case 'P':
      return el.parentElement?.tagName === 'BLOCKQUOTE' ? '> ' : '';
    default:
      return '';
  }
};

/**
 * Text that would read as a block marker at the start of a line is escaped, so
 * a paragraph that begins "1986. It was…" or "-5 °C" stays a paragraph.
 */
const escapeMarker = (body) =>
  body.replace(/^(#{1,6}(?=\s)|[-*+](?=\s)|>|\d+(?=[.)]\s))/, (m) =>
    /^\d/.test(m) ? m + '\\' : '\\' + m,
  );

export const blockMarkdown = (el) =>
  (prefixFor(el) +
    escapeMarker(
      toMarkdown(el)
        .replace(/[ \t]+/g, ' ')
        // Keep hard breaks ("\\\n"); every other newline is just rendering.
        .replace(/ *\\\n */g, '\0')
        .replace(/\n/g, ' ')
        .replace(/ *\0 */g, '\\\n')
        .trim(),
    )).trim();

/* ----------------------------------------------------------------------------
   Markdown → HTML, for pasted text and the as-you-type shortcuts.
   ------------------------------------------------------------------------- */
const escapeHtml = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const INLINE =
  /(`+)(.+?)\1|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|(?<![\w*])\*([^*\s](?:[^*]*?[^*\s])?)\*(?![\w*])|(?<![\w_])_([^_\s](?:[^_]*?[^_\s])?)_(?![\w_])/;

export const inlineToHtml = (md) => {
  let out = '';
  let rest = md;
  for (;;) {
    const m = INLINE.exec(rest);
    if (!m) return out + escapeHtml(rest);
    out += escapeHtml(rest.slice(0, m.index));
    if (m[2] !== undefined) out += `<code>${escapeHtml(m[2])}</code>`;
    else if (m[3] !== undefined) out += `<a href="${escapeHtml(m[4])}">${inlineToHtml(m[3])}</a>`;
    else if (m[5] !== undefined || m[6] !== undefined)
      out += `<strong>${inlineToHtml(m[5] ?? m[6])}</strong>`;
    else if (m[7] !== undefined) out += `<del>${inlineToHtml(m[7])}</del>`;
    else out += `<em>${inlineToHtml(m[8] ?? m[9])}</em>`;
    rest = rest.slice(m.index + m[0].length);
  }
};

/**
 * The shortcut just completed at the end of `text` (what stands before the
 * caret in its text node), or null. Returns the length to replace and the
 * HTML to put there.
 */
export const shortcutAt = (text) => {
  const m =
    /(`+)([^`]+?)\1$|\[([^\]]+)\]\(([^)\s]+)\)$|\*\*([^*]+?)\*\*$|__([^_]+?)__$|~~([^~]+?)~~$|(?<![\w*])\*([^*\s][^*]*?)\*$|(?<![\w_])_([^_\s][^_]*?)_$/.exec(
      text,
    );
  if (!m) return null;
  return { length: m[0].length, html: inlineToHtml(m[0]) + ZWSP };
};

/**
 * Pasted HTML → one markdown string per block, so a copied passage lands as
 * paragraphs rather than a wall.
 */
export const htmlToBlocks = (html) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const BLOCK = 'p, div, li, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, section, article, tr, pre';
  const blocks = [];
  const push = (node, prefix = '') => {
    const md = toMarkdown(node).replace(/\s+/g, ' ').trim();
    if (md) blocks.push(prefix + md);
  };
  const walk = (node, prefix = '') => {
    for (const child of node.childNodes) {
      if (child.nodeType !== Node.ELEMENT_NODE) {
        push(child, prefix);
      } else if (child.querySelector(BLOCK)) {
        // A wrapper (Google Docs puts everything in one <b>): look inside it.
        const own = child.tagName === 'BLOCKQUOTE' ? '> ' : prefix;
        if (child.tagName === 'LI') {
          // An item with a nested list: its own text first, then the nested items.
          const shallow = child.cloneNode(true);
          for (const el of shallow.querySelectorAll(BLOCK)) el.remove();
          push(shallow, itemPrefix(child));
        }
        walk(child, own);
      } else if (!child.matches(BLOCK)) {
        push(child, prefix);
      } else if (/^H[1-6]$/.test(child.tagName)) {
        push(child, child.tagName <= 'H2' ? '## ' : '### ');
      } else {
        push(child, child.tagName === 'LI' ? itemPrefix(child) : prefix);
      }
    }
  };
  const itemPrefix = (li) =>
    li.parentElement?.tagName === 'OL'
      ? `${Number(li.parentElement.getAttribute('start') ?? 1) + [...li.parentElement.children].indexOf(li)}. `
      : '- ';
  walk(doc.body);
  return blocks;
};

/** Pasted plain text → blocks: blank lines separate them, single newlines join. */
export const textToBlocks = (text) =>
  text
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((s) => s.replace(/\n/g, ' ').trim())
    .filter(Boolean);

export const isUrl = (s) => /^https?:\/\/\S+$/.test(s.trim());
