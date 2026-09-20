/**
 * Sätteri hast plugin: mark each rendered block with the character range it
 * came from, as `data-src="start-end"` (offsets into the source Astro passed to
 * the markdown compiler). The in-browser editor uses these ranges to write a
 * block's new text back into exactly the right place in the file.
 *
 * Inert unless `enable()` was called, which the editor integration does only
 * for `astro dev`. Production HTML never carries the attribute, and
 * scripts/verify-build.mjs asserts that.
 */

let enabled = false;

export const enable = () => {
  enabled = true;
};

const BLOCKS = ['p', 'h1', 'h2', 'h3', 'h4', 'li', 'blockquote', 'hr', 'pre', 'table'];

const stamp = (node, ctx) => {
  if (!enabled || !node.position?.start || !node.position?.end) return;
  const { start, end } = node.position;
  if (typeof start.offset !== 'number' || typeof end.offset !== 'number') return;
  ctx.setProperty(node, 'data-src', `${start.offset}-${end.offset}`);
};

export const stampSource = {
  name: 'note-editor-stamp',
  // Position tracking costs a little compile time, so ask for it only when the
  // stamps are actually going to be written.
  get options() {
    return enabled ? { position: true } : {};
  },
  element: { filter: BLOCKS, visit: stamp },
  mdxJsxFlowElement: { filter: ['Figure', 'Callout'], visit: stamp },
  // An MDX comment, `{/* … */}`, is a note the writer leaves for Claude: in
  // dev it renders as a card the editor can edit; in a build it is nothing.
  mdxFlowExpression(node, ctx) {
    if (!enabled) return;
    const m = /^\s*\/\*([\s\S]*?)\*\/\s*$/.exec(node.value ?? '');
    if (!m) return;
    const { start, end } = node.position ?? {};
    const properties = { className: ['note-editor-comment'] };
    if (typeof start?.offset === 'number' && typeof end?.offset === 'number') {
      properties['data-src'] = `${start.offset}-${end.offset}`;
    }
    ctx.replaceNode(node, {
      type: 'element',
      tagName: 'aside',
      properties,
      children: [{ type: 'text', value: m[1].trim() }],
    });
  },
};
