// @ts-check
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

const isTable = (node) =>
  (node.type === 'element' && node.tagName === 'table') ||
  (node.type === 'mdxJsxFlowElement' && node.name === 'table');

const countTables = (node) =>
  (isTable(node) ? 1 : 0) +
  (node.children ?? []).reduce((total, child) => total + countTables(child), 0);

/**
 * Wrap every table in a scroll container.
 *
 * This runs in the shared Sätteri pipeline, so `.md` and `.mdx` behave the same —
 * an MDX `components={{ table: ... }}` override would only ever have covered
 * `.mdx`. Wrapping the real node also keeps whatever the author wrote on it: id,
 * class, caption, scope, aria-*. Whether it actually scrolls is CSS's decision;
 * see `.table-wrap` in global.css.
 *
 * Both a Markdown table and one an author wrote out as HTML in an .mdx file are
 * handled: the first arrives as an element, the second as a JSX node.
 */
const wrapTable = (node, ctx) => {
  const parent = ctx.parent(node);
  const wrapped =
    parent?.type === 'element' &&
    parent.tagName === 'div' &&
    String(parent.properties?.className ?? '').includes('table-wrap');
  if (wrapped) return;

  /*
   * A matrix table — row labels down the side, column labels across the top —
   * has an empty corner cell, and Markdown has no way to say it is not a header.
   * An empty <th> announces a header that names nothing, so make the corner the
   * <td> the HTML spec calls for. Only ever the very first cell of the very
   * first header row: a genuinely blank column heading elsewhere is the author's
   * business, as is anything in hand-written JSX.
   */
  if (node.type === 'element') {
    const head = node.children.find(
      (child) => child.type === 'element' && child.tagName === 'thead',
    );
    const firstRow = head?.children.find(
      (child) => child.type === 'element' && child.tagName === 'tr',
    );
    const corner = firstRow?.children.find((child) => child.type === 'element');
    if (corner?.tagName === 'th' && ctx.textContent(corner).trim() === '') {
      ctx.replaceNode(corner, { ...corner, tagName: 'td' });
    }
  }

  const index = (ctx.data.tableIndex = (ctx.data.tableIndex ?? 0) + 1);
  // A table's own caption is the best name for the region around it.
  const caption = node.children.find(
    (child) =>
      (child.type === 'element' && child.tagName === 'caption') ||
      (child.type === 'mdxJsxFlowElement' && child.name === 'caption'),
  );
  const label =
    (caption ? ctx.textContent(caption).trim() : '') ||
    (ctx.data.tableCount > 1 ? `Table ${index}` : 'Table');

  ctx.wrapNode(node, {
    type: 'element',
    tagName: 'div',
    properties: {
      className: ['table-wrap'],
      role: 'region',
      'aria-label': label,
      tabIndex: 0,
    },
    children: [],
  });
};

const wrapTables = {
  name: 'wrap-tables',

  // Counted up front so the labels can be numbered only when there is actually
  // more than one: two regions both called "Table" would be indistinguishable.
  before(root, ctx) {
    ctx.data.tableCount = countTables(root);
    ctx.data.tableIndex = 0;
  },

  element: { filter: ['table'], visit: wrapTable },
  mdxJsxFlowElement: { filter: ['table'], visit: wrapTable },
};

/*
 * Three GitHub theme colours were drawn for GitHub's own backgrounds rather than
 * this site's code surface, and land below the 4.5:1 that text this size needs.
 * Each is replaced by a neighbouring colour from GitHub's own palette, so the
 * highlighting still looks like itself:
 *
 *   comments     #6A737D  4.30:1 on light, 3.51:1 on dark  ->  5.70 / 5.49
 *   keywords     #D73A49  4.09:1 on light                  ->  6.01
 *   parameters   #E36209  3.12:1 on light                  ->  5.77
 *
 * The dark counterparts of the last two already pass and are left alone.
 * Contrast is measured against --surface, which is what `pre` actually paints:
 * #f4f2ed light, #1d1d1b dark.
 *
 * Done as a transformer because Astro forwards `transformers` to Shiki but not
 * `colorReplacements`.
 */
const CONTRAST_FIXES = {
  '--shiki-light:#6A737D': '--shiki-light:#586069',
  '--shiki-dark:#6A737D': '--shiki-dark:#8B949E',
  '--shiki-light:#D73A49': '--shiki-light:#B31D28',
  '--shiki-light:#E36209': '--shiki-light:#A04100',
};

const raiseCommentContrast = {
  name: 'raise-comment-contrast',
  span(node) {
    const style = node.properties?.style;
    if (typeof style !== 'string') return;
    node.properties.style = Object.entries(CONTRAST_FIXES).reduce(
      (out, [from, to]) => out.replace(from, to),
      style,
    );
  },
};

// https://astro.build/config
export default defineConfig({
  site: 'https://ryannel.dev',
  integrations: [mdx(), sitemap()],
  markdown: {
    // @astrojs/mdx extends this config by default, so .mdx gets the same pipeline.
    processor: satteri({ hastPlugins: [wrapTables] }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      // Emits --shiki-light / --shiki-dark custom properties; CSS picks between them.
      defaultColor: false,
      wrap: false,
      transformers: [raiseCommentContrast],
    },
  },
  build: {
    // Emits /writing/slug/index.html — the canonical URLs on this site all end in "/".
    format: 'directory',
  },
});
