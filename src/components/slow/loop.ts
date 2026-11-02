/** Ambient illustrations run on sight and stop offscreen. */
export function loop(figure: HTMLElement, duration: number, still: number, draw: (time: number) => void) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pause = figure.querySelector<HTMLButtonElement>('[data-pause-loop]');
  let visible = false;
  let paused = false;
  let time = 0;
  let last = 0;
  let frame = 0;
  const tick = (now: number) => {
    if (last) time = (time + Math.min(64, now - last)) % duration;
    last = now;
    draw(time);
    frame = requestAnimationFrame(tick);
  };
  const update = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    if (pause) pause.hidden = motion.matches;
    if (motion.matches) draw(still);
    else if (visible && !paused && !document.hidden) frame = requestAnimationFrame(tick);
  };
  pause?.addEventListener('click', () => {
    paused = !paused;
    pause.setAttribute('aria-label', paused ? 'Resume animation' : 'Pause animation');
    pause.setAttribute('aria-pressed', String(paused));
    pause.textContent = paused ? '▶' : 'Ⅱ';
    update();
  });
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { threshold: 0.15 });
  observer.observe(figure);
  document.addEventListener('visibilitychange', update);
  motion.addEventListener('change', update);
  document.addEventListener('astro:before-swap', () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    document.removeEventListener('visibilitychange', update);
    motion.removeEventListener('change', update);
  }, { once: true });
  draw(motion.matches ? still : time);
}
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const ease = (n: number) => { const p = clamp(n); return p * p * (3 - 2 * p); };
