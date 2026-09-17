/**
 * The editor's floating pieces: a formatting bar over a selection, a menu of
 * block kinds under a "/" or a "+", and a bar under a selected card. They are
 * ordinary elements at the end of <body>, positioned from page coordinates,
 * and all carry the note-editor- prefix so scripts/verify-build.mjs can prove
 * none of it reaches a build.
 */

const GOLD = '#d3a74e';

const CSS = `
  .note-editor-ui { position: absolute; z-index: 2147482000; font: 13px/1.3 system-ui, sans-serif;
    color: #f4f1ea; background: #1c1b19; border-radius: 8px; box-shadow: 0 6px 24px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.08);
    user-select: none; -webkit-user-select: none; }
  .note-editor-ui[hidden] { display: none; }
  .note-editor-bar { display: flex; align-items: stretch; padding: 3px; gap: 1px; white-space: nowrap; }
  .note-editor-bar button, .note-editor-bar select { all: unset; box-sizing: border-box; min-width: 30px; height: 30px; padding: 0 8px;
    display: inline-flex; align-items: center; justify-content: center; border-radius: 5px; cursor: pointer;
    font: 500 13px/1 system-ui, sans-serif; color: inherit; }
  .note-editor-bar button:hover, .note-editor-bar select:hover { background: rgba(255,255,255,.1); }
  .note-editor-bar button.is-active { color: ${GOLD}; background: rgba(211,167,78,.14); }
  .note-editor-bar button[data-danger]:hover { color: #ff8a80; }
  .note-editor-bar .sep { width: 1px; margin: 5px 3px; background: rgba(255,255,255,.14); }
  .note-editor-bar .b { font-weight: 700; } .note-editor-bar .i { font-style: italic; font-family: Georgia, serif; }
  .note-editor-bar .c { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
  .note-editor-bar .s { text-decoration: line-through; }
  .note-editor-bar a { color: #9ecbff; text-decoration: none; max-width: 260px; overflow: hidden; text-overflow: ellipsis; padding: 0 8px; display: inline-flex; align-items: center; }
  .note-editor-bar input { all: unset; box-sizing: border-box; height: 30px; width: 280px; padding: 0 10px; color: inherit; font: 13px system-ui, sans-serif; }
  .note-editor-bar input::placeholder { color: rgba(255,255,255,.45); }
  .note-editor-menu { min-width: 240px; max-height: 320px; overflow-y: auto; padding: 4px; }
  .note-editor-menu input { all: unset; box-sizing: border-box; display: block; width: 100%; height: 30px; padding: 0 8px; margin-bottom: 4px;
    border-bottom: 1px solid rgba(255,255,255,.12); font: 13px system-ui, sans-serif; color: inherit; }
  .note-editor-menu .item { display: flex; gap: 10px; align-items: center; padding: 6px 8px; border-radius: 5px; cursor: pointer; }
  .note-editor-menu .item.is-active { background: rgba(211,167,78,.16); }
  .note-editor-menu .item .k { width: 22px; text-align: center; color: ${GOLD}; font-weight: 700; font-family: Georgia, serif; flex: none; }
  .note-editor-menu .item .t { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .note-editor-menu .item .h { color: rgba(255,255,255,.45); font-size: 12px; }
  .note-editor-menu .empty { padding: 8px; color: rgba(255,255,255,.45); }
  .note-editor-plus { all: unset; position: absolute; z-index: 2147481000; width: 26px; height: 26px; border-radius: 50%; display: flex;
    align-items: center; justify-content: center; cursor: pointer; color: ${GOLD}; border: 1px solid color-mix(in srgb, ${GOLD} 55%, transparent);
    font: 18px/1 system-ui, sans-serif; background: transparent; opacity: .6; }
  .note-editor-plus:hover { opacity: 1; }
`;

const pageRect = (rect) => ({
  left: rect.left + scrollX,
  top: rect.top + scrollY,
  right: rect.right + scrollX,
  bottom: rect.bottom + scrollY,
  width: rect.width,
  height: rect.height,
});

/** Place `el` above (or below, when there is no room) the given viewport rect. */
const placeAt = (el, rect, { below = false, alignLeft = false } = {}) => {
  const r = pageRect(rect);
  el.hidden = false;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  let left = alignLeft ? r.left : r.left + r.width / 2 - w / 2;
  left = Math.max(scrollX + 8, Math.min(left, scrollX + innerWidth - w - 8));
  let top = below || rect.top - h - 10 < 0 ? r.bottom + 8 : r.top - h - 8;
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
};

export const createUi = () => {
  const style = document.createElement('style');
  style.id = 'note-editor-ui-style';
  style.textContent = CSS;

  const bar = document.createElement('div');
  bar.className = 'note-editor-ui note-editor-bar';
  bar.hidden = true;
  // Clicking a button must not move the selection it acts on.
  bar.addEventListener('mousedown', (e) => {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') e.preventDefault();
  });

  const menu = document.createElement('div');
  menu.className = 'note-editor-ui note-editor-menu';
  menu.hidden = true;
  menu.addEventListener('mousedown', (e) => {
    if (e.target.tagName !== 'INPUT') e.preventDefault();
  });

  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'note-editor-plus';
  plus.textContent = '+';
  plus.title = 'Add a block';
  plus.hidden = true;
  plus.addEventListener('mousedown', (e) => e.preventDefault());

  const mount = () => document.body.append(style, bar, menu, plus);
  const unmount = () => {
    for (const el of [style, bar, menu, plus]) el.remove();
  };

  /* ---- the bar: a row of buttons, a select, a link, or an input ---- */
  const toolbar = {
    open: false,
    /**
     * items: { label, html?, title?, active?, danger?, run } | { sep: true }
     *      | { select: [{value, label}], value, onChange } | { href }
     */
    show(rect, items, opts) {
      bar.replaceChildren();
      for (const item of items) {
        if (item.sep) {
          const s = document.createElement('span');
          s.className = 'sep';
          bar.append(s);
        } else if (item.select) {
          const sel = document.createElement('select');
          for (const o of item.select) {
            const opt = document.createElement('option');
            opt.value = o.value;
            opt.textContent = o.label;
            opt.selected = o.value === item.value;
            sel.append(opt);
          }
          sel.addEventListener('change', () => item.onChange(sel.value));
          bar.append(sel);
        } else if (item.href) {
          const a = document.createElement('a');
          a.href = item.href;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = item.href;
          bar.append(a);
        } else {
          const b = document.createElement('button');
          b.type = 'button';
          if (item.html) b.innerHTML = item.html;
          else b.textContent = item.label;
          b.title = item.title ?? item.label ?? '';
          if (item.active) b.classList.add('is-active');
          if (item.danger) b.dataset.danger = '';
          b.addEventListener('click', () => item.run());
          bar.append(b);
        }
      }
      placeAt(bar, rect, opts);
      toolbar.open = true;
    },
    /** Swap the bar for one text field. */
    prompt(rect, { value = '', placeholder, onSubmit, onCancel }, opts) {
      bar.replaceChildren();
      const input = document.createElement('input');
      input.value = value;
      input.placeholder = placeholder ?? '';
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          onSubmit(input.value.trim());
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel?.();
        }
      });
      bar.append(input);
      placeAt(bar, rect, opts);
      toolbar.open = true;
      input.focus();
      input.select();
    },
    hide() {
      bar.hidden = true;
      toolbar.open = false;
    },
    contains: (node) => bar.contains(node),
  };

  /* ---- the menu: block kinds, or a list of images ---- */
  let menuItems = [];
  let menuVisible = [];
  let menuIndex = 0;
  let menuPick = null;
  let menuInput = null;
  const renderMenu = () => {
    for (const el of menu.querySelectorAll('.item, .empty')) el.remove();
    if (!menuVisible.length) {
      const e = document.createElement('div');
      e.className = 'empty';
      e.textContent = 'Nothing matches';
      menu.append(e);
      return;
    }
    menuVisible.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'item' + (i === menuIndex ? ' is-active' : '');
      el.innerHTML = `<span class="k">${item.key ?? ''}</span><span class="t">${item.label}</span>${
        item.hint ? `<span class="h">${item.hint}</span>` : ''
      }`;
      el.addEventListener('click', () => pick(item));
      el.addEventListener('mousemove', () => {
        if (menuIndex !== i) {
          menuIndex = i;
          renderMenu();
        }
      });
      menu.append(el);
    });
    menu.querySelector('.item.is-active')?.scrollIntoView({ block: 'nearest' });
  };
  const pick = (item) => {
    const fn = menuPick;
    menuApi.hide();
    fn?.(item);
  };
  const menuApi = {
    open: false,
    /** items: { key?, label, hint?, ...anything }. `search` adds a text field. */
    show(rect, items, onPick, { search = false, placeholder = '' } = {}) {
      menuItems = items;
      menuPick = onPick;
      menuIndex = 0;
      menu.replaceChildren();
      menuInput = null;
      if (search) {
        menuInput = document.createElement('input');
        menuInput.placeholder = placeholder;
        menuInput.addEventListener('input', () => menuApi.filter(menuInput.value));
        menuInput.addEventListener('keydown', (e) => {
          if (menuApi.key(e)) return;
          e.stopPropagation();
        });
        menu.append(menuInput);
      }
      menuApi.filter('');
      placeAt(menu, rect, { below: true, alignLeft: true });
      menuApi.open = true;
      menuInput?.focus();
    },
    filter(q) {
      const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      menuVisible = menuItems.filter((it) => {
        const hay = `${it.label} ${it.hint ?? ''} ${it.keywords ?? ''}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      });
      menuIndex = 0;
      renderMenu();
    },
    /** Keyboard handling for the menu; true when the key was consumed. */
    key(e) {
      if (!menuApi.open) return false;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = menuVisible.length;
        if (n) menuIndex = (menuIndex + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
        renderMenu();
        return true;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (menuVisible[menuIndex]) pick(menuVisible[menuIndex]);
        else menuApi.hide();
        return true;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        menuApi.hide();
        return true;
      }
      return false;
    },
    hide() {
      menu.hidden = true;
      menuApi.open = false;
      menuPick = null;
    },
    contains: (node) => menu.contains(node),
  };

  /* ---- the "+" in the margin of an empty block ---- */
  let plusRun = null;
  plus.addEventListener('click', () => plusRun?.());
  const plusApi = {
    show(rect, run) {
      plusRun = run;
      plus.hidden = false;
      const r = pageRect(rect);
      plus.style.left = `${Math.max(4, r.left - 36)}px`;
      plus.style.top = `${r.top + Math.max(0, (rect.height - 26) / 2)}px`;
    },
    hide() {
      plus.hidden = true;
      plusRun = null;
    },
  };

  return { mount, unmount, toolbar, menu: menuApi, plus: plusApi, placeAt };
};
