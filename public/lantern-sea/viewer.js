/* Standalone static tile viewer. No master image, external libraries or APIs. */
(async () => {
  'use strict';
  const $ = id => document.getElementById(id);
  const stage = $('stage'), canvas = stage.querySelector('canvas');
  const ctx = canvas.getContext('2d', {alpha: true});
  const message = text => { $('message').hidden = false; $('message').textContent = text; };
  if (location.protocol === 'file:') {
    message('To explore, serve the map_creation folder with a local HTTP server. The README has the one-line start command.');
    $('status').textContent = 'Open through a local server';
    return;
  }
  let config;
  try {
    const response = await fetch('map.json');
    if (!response.ok) throw Error('Missing map configuration');
    config = await response.json();
  } catch {
    message('The map could not load. Check your connection, then reload this page.');
    $('status').textContent = 'Map unavailable';
    return;
  }
  const {width, height, maxLevel, tileSize, overlap} = config;
  const baseLevel = Math.min(9, maxLevel);
  const cache = new Map(), pending = new Map(), failures = new Set(), pointers = new Map();
  const view = {cx: 0, cy: 0, scale: 1, fit: true};
  let W = 0, H = 0, DPR = 1, frame = 0, flight = 0, queue = [], wanted = new Set();
  let mode = config.modes.labels ? 'labels' : 'artwork', started = false, lastGesture = null;
  let detailTimer = 0, detailAfter = 0;
  let saveTimer = 0, receivedBytes = 0, receivedTiles = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  $('labels').checked = mode === 'labels';
  $('labels').disabled = !config.modes.labels;
  const embedded = new URLSearchParams(location.search).has('embed');
  if (embedded) {
    document.body.classList.add('embedded');
    document.querySelector('.desktop-help').textContent = 'Drag to explore · hold Ctrl or ⌘ and scroll to zoom';
  }

  const fitScale = () => Math.min(W / width, H / height) * .96;
  const clampScale = s => Math.max(fitScale(), Math.min(2, s));
  function constrain() {
    const x = Math.max(0, width / 2 - W / (2 * view.scale));
    const y = Math.max(0, height / 2 - H / (2 * view.scale));
    view.cx = Math.max(-x, Math.min(x, view.cx));
    view.cy = Math.max(-y, Math.min(y, view.cy));
  }
  const levelSize = l => [Math.ceil(width / 2 ** (maxLevel - l)), Math.ceil(height / 2 ** (maxLevel - l))];
  const world = (x, y) => ({x: (x - W / 2) / view.scale + view.cx + width / 2,
                          y: (y - H / 2) / view.scale + view.cy + height / 2});
  function tileBounds(level) {
    const factor = 2 ** (maxLevel - level), [w, h] = levelSize(level);
    const a = world(0, 0), b = world(W, H);
    return {x0: Math.max(0, Math.floor(a.x / factor / tileSize)),
            x1: Math.min(Math.ceil(w / tileSize) - 1, Math.floor(b.x / factor / tileSize)),
            y0: Math.max(0, Math.floor(a.y / factor / tileSize)),
            y1: Math.min(Math.ceil(h / tileSize) - 1, Math.floor(b.y / factor / tileSize))};
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
  function request(level, x, y, priority) {
    const key = `${mode}/${level}/${x}/${y}`;
    wanted.add(key);
    if (cache.has(key)) {
      const bitmap = cache.get(key);
      cache.delete(key); cache.set(key, bitmap);
      return bitmap;
    }
    if (!pending.has(key) && !failures.has(key) && !queue.some(t => t.key === key))
      queue.push({key, level, x, y, mode, priority});
    return null;
  }
  function evict() {
    // At most 96 decoded 514px tiles (roughly 100MB); visible tiles are preferred.
    while (cache.size > 96) {
      const key = [...cache.keys()].find(k => !wanted.has(k));
      if (!key) break;
      cache.get(key).close(); cache.delete(key);
    }
  }
  function pump() {
    queue = queue.filter(t => wanted.has(t.key)).sort((a, b) => a.priority - b.priority);
    for (const [key, controller] of pending) if (!wanted.has(key)) controller.abort();
    while (pending.size < 6 && queue.length) {
      const tile = queue.shift();
      if (pending.has(tile.key)) continue;
      const controller = new AbortController();
      pending.set(tile.key, controller);
      fetch(`tiles/${tile.mode}/${tile.level}/${tile.x}_${tile.y}.webp?v=${config.revision}`, {signal: controller.signal})
        .then(response => { if (!response.ok) throw Error('Tile unavailable'); return response.blob(); })
        .then(blob => { receivedBytes += blob.size; receivedTiles++; return blob; })
        .then(createImageBitmap)
        .then(bitmap => { cache.set(tile.key, bitmap); failures.delete(tile.key); evict(); })
        .catch(error => { if (error.name !== 'AbortError') failures.add(tile.key); })
        .finally(() => { pending.delete(tile.key); schedule(); });
    }
  }
  function layer(level, priority, load = true) {
    const b = tileBounds(level), factor = 2 ** (maxLevel - level);
    const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const bitmap = load ? request(level, x, y, priority + Math.hypot(x - mx, y - my)) : cache.get(`${mode}/${level}/${x}/${y}`);
      if (bitmap) {
        const px = (x * tileSize - (x ? overlap : 0)) * factor - width / 2;
        const py = (y * tileSize - (y ? overlap : 0)) * factor - height / 2;
        ctx.drawImage(bitmap, px, py, bitmap.width * factor, bitmap.height * factor);
      }
    }
  }
  function draw() {
    frame = 0;
    const start = performance.now();
    wanted = new Set();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(W / 2 - view.cx * view.scale, H / 2 - view.cy * view.scale);
    ctx.scale(view.scale, view.scale);
    const level = Math.max(baseLevel, Math.min(maxLevel, maxLevel + Math.ceil(Math.log2(view.scale * DPR))));
    layer(baseLevel, 0);
    // Cached intermediate detail remains visible while sharper tiles arrive.
    for (let l = baseLevel + 1; l < level; l++) {
      const b = tileBounds(l), factor = 2 ** (maxLevel - l);
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
        const bitmap = cache.get(`${mode}/${l}/${x}/${y}`);
        if (bitmap) ctx.drawImage(bitmap, (x * tileSize - (x ? overlap : 0)) * factor - width / 2,
          (y * tileSize - (y ? overlap : 0)) * factor - height / 2, bitmap.width * factor, bitmap.height * factor);
      }
    }
    if (level > baseLevel) layer(level, 10, performance.now() >= detailAfter);
    evict(); pump();
    $('zoom').textContent = Math.round(view.scale * 100) + '%';
    const missing = [...wanted].filter(key => !cache.has(key));
    const failed = missing.some(key => failures.has(key));
    $('status').textContent = failed ? 'Some detail unavailable' : missing.length ? 'Loading detail…' : 'Ready to explore';
    $('retry').hidden = !failed;
    canvas.dataset.scale = String(view.scale);
    canvas.dataset.center = `${view.cx},${view.cy}`;
    canvas.dataset.tiles = String(cache.size);
    canvas.dataset.receivedBytes = String(receivedBytes);
    canvas.dataset.receivedTiles = String(receivedTiles);
    canvas.dataset.mode = mode;
    canvas.dataset.drawMs = (performance.now() - start).toFixed(2);
  }
  // During motion use cached detail; request fresh sharp tiles once the camera settles.
  function deferDetail() {
    detailAfter = performance.now() + 90;
    clearTimeout(detailTimer);
    detailTimer = setTimeout(schedule, 100);
  }
  function savePosition() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const hash = new URLSearchParams({x: (view.cx / width + .5).toFixed(5), y: (view.cy / height + .5).toFixed(5),
        z: view.scale.toFixed(5), names: String(mode === 'labels' ? 1 : 0)});
      history.replaceState(null, '', `${location.pathname}${location.search}#${hash}`);
    }, 250);
  }
  function apply(next) {
    view.cx = next.cx; view.cy = next.cy; view.scale = clampScale(next.scale);
    constrain(); schedule(); savePosition();
  }
  function fly(next) {
    cancelAnimationFrame(flight);
    if (reduced.matches) { apply(next); return; }
    const from = {...view}, a = Math.log(view.scale), b = Math.log(next.scale), start = performance.now();
    function tick(now) {
      deferDetail();
      const t = Math.min(1, (now - start) / 450), e = 1 - (1 - t) ** 3;
      apply({cx: from.cx + (next.cx - from.cx) * e, cy: from.cy + (next.cy - from.cy) * e, scale: Math.exp(a + (b - a) * e)});
      if (t < 1) flight = requestAnimationFrame(tick);
    }
    flight = requestAnimationFrame(tick);
  }
  function fit(animate = true) {
    view.fit = true;
    const next = {cx: 0, cy: 0, scale: fitScale()};
    if (animate) fly(next); else { cancelAnimationFrame(flight); apply(next); }
  }
  function zoom(next, x = W / 2, y = H / 2) {
    cancelAnimationFrame(flight); deferDetail(); next = clampScale(next);
    view.cx += (x - W / 2) / view.scale - (x - W / 2) / next;
    view.cy += (y - H / 2) / view.scale - (y - H / 2) / next;
    view.scale = next; view.fit = false;
    constrain(); schedule(); savePosition();
  }
  $('fit').onclick = () => fit();
  $('native').onclick = () => { view.fit = false; fly({...view, scale: 1}); };
  $('in').onclick = () => zoom(view.scale * 1.5);
  $('out').onclick = () => zoom(view.scale / 1.5);
  $('labels').onchange = () => { mode = $('labels').checked ? 'labels' : 'artwork'; schedule(); savePosition(); };
  $('retry').onclick = () => { failures.clear(); schedule(); };
  function setExpanded(expanded) {
    document.body.classList.toggle('expanded', expanded);
    $('full').textContent = expanded ? 'Exit expanded view' : 'Expand map';
    $('full').setAttribute('aria-pressed', String(expanded));
    if (embedded && parent !== window) parent.postMessage({type: 'lantern-sea:expanded', expanded}, location.origin);
  }
  $('full').onclick = async () => {
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    const expanded = !document.body.classList.contains('expanded');
    setExpanded(expanded);
    // Standalone fullscreen; embedded expansion is handled by the article.
    if (expanded && !embedded && document.documentElement.requestFullscreen) {
      try { await document.documentElement.requestFullscreen(); } catch { /* CSS expansion remains available. */ }
    }
  };
  document.addEventListener('fullscreenchange', () => setExpanded(Boolean(document.fullscreenElement)));
  window.addEventListener('message', event => {
    if (!embedded || event.origin !== location.origin || event.source !== parent) return;
    if (event.data?.type === 'lantern-sea:theme') {
      const theme = event.data.theme;
      if (!['system', 'light', 'dark'].includes(theme)) return;
      document.documentElement.style.colorScheme = theme === 'system' ? 'light dark' : theme;
      const allowed = ['--paper', '--ink', '--muted', '--rule', '--surface', '--accent', '--font-ui'];
      for (const key of allowed) {
        const value = event.data.tokens?.[key];
        if (typeof value === 'string' && value.length < 600) document.documentElement.style.setProperty(key, value);
      }
    }
    if (event.data?.type === 'lantern-sea:collapse') {
      setExpanded(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setExpanded(false); });
  const local = e => { const rect = stage.getBoundingClientRect(); return {x: e.clientX - rect.left, y: e.clientY - rect.top}; };
  function gesture() {
    const p = [...pointers.values()];
    return {x: p.reduce((a, b) => a + b.x, 0) / p.length, y: p.reduce((a, b) => a + b.y, 0) / p.length,
            d: p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0, n: p.length};
  }
  stage.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    cancelAnimationFrame(flight); e.preventDefault(); stage.focus({preventScroll: true});
    stage.setPointerCapture(e.pointerId); pointers.set(e.pointerId, local(e));
    lastGesture = gesture(); stage.classList.add('dragging');
  });
  stage.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, local(e));
    const g = gesture();
    if (lastGesture && lastGesture.n === g.n) {
      view.cx -= (g.x - lastGesture.x) / view.scale;
      view.cy -= (g.y - lastGesture.y) / view.scale;
      if (g.n > 1 && lastGesture.d > 0) zoom(view.scale * g.d / lastGesture.d, g.x, g.y);
      view.fit = false; deferDetail(); constrain(); schedule(); savePosition();
    }
    lastGesture = g;
  });
  function end(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId); lastGesture = pointers.size ? gesture() : null;
    if (!pointers.size) stage.classList.remove('dragging');
    if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
  }
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(name, end);
  stage.addEventListener('wheel', e => {
    // Let ordinary wheel scrolling continue through an article containing the iframe.
    if (embedded && !document.body.classList.contains('expanded') && !e.ctrlKey && !e.metaKey) return;
    e.preventDefault(); const p = local(e);
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1);
    zoom(view.scale * Math.exp(-Math.max(-160, Math.min(160, dy)) * .003), p.x, p.y);
  }, {passive: false});
  stage.addEventListener('dblclick', e => { const p = local(e); zoom(view.scale * 2, p.x, p.y); });
  stage.addEventListener('keydown', e => {
    if (['+', '=', '-', '0', '1', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
    if (e.key === '+' || e.key === '=') zoom(view.scale * 1.5);
    if (e.key === '-') zoom(view.scale / 1.5);
    if (e.key === '0') fit();
    if (e.key === '1') $('native').click();
    if (e.key.startsWith('Arrow')) {
      cancelAnimationFrame(flight);
      const step = (e.shiftKey ? 180 : 60) / view.scale;
      if (e.key === 'ArrowLeft') view.cx -= step;
      if (e.key === 'ArrowRight') view.cx += step;
      if (e.key === 'ArrowUp') view.cy -= step;
      if (e.key === 'ArrowDown') view.cy += step;
      view.fit = false; deferDetail(); constrain(); schedule(); savePosition();
    }
  });
  window.addEventListener('pageshow', event => { if (embedded && event.persisted && started) fit(false); });
  new ResizeObserver(() => {
    W = stage.clientWidth; H = stage.clientHeight;
    if (!W || !H) return;
    DPR = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    if (!started) {
      started = true;
      const p = new URLSearchParams(location.hash.slice(1));
      const x = Number(p.get('x')), y = Number(p.get('y')), z = Number(p.get('z'));
      if (!embedded && p.has('x') && p.has('y') && x >= 0 && x <= 1 && y >= 0 && y <= 1 && z >= .001 && z <= 2) {
        view.fit = false;
        if (p.get('names') === '0') { mode = 'artwork'; $('labels').checked = false; }
        apply({cx: (x - .5) * width, cy: (y - .5) * height, scale: z});
      } else fit(false);
    } else if (view.fit) fit(false);
    else { constrain(); schedule(); }
  }).observe(stage);
  if (embedded && parent !== window) parent.postMessage({type: 'lantern-sea:ready'}, location.origin);
})();
