/** Small drawing helpers for the figures in notes/where-the-cash-goes. */
import type { Colours } from '../slow/canvas';
import { HUES, isDark } from '../slow/canvas';

export const orange = (c: Colours) => HUES.ours[isDark(c) ? 1 : 0];
export const grey = (c: Colours) => (isDark(c) ? '#919ca9' : '#8995a4');

/** "23 billion kr", "-4 billion kr", "400,000 kr". */
export const bn = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(Math.round(n))} billion kr`;
export const kr = (n: number) => `${n.toLocaleString('en-GB')} kr`;

export function text(
  ctx: CanvasRenderingContext2D,
  c: Colours,
  s: string,
  x: number,
  y: number,
  opts: { colour?: string; size?: number; weight?: number; align?: CanvasTextAlign } = {},
) {
  ctx.font = `${opts.weight ?? 400} ${opts.size ?? 12}px ${c.font}`;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = opts.colour ?? c.ink;
  ctx.fillText(s, x, y);
}

/** A tiny side-on car. */
export function car(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string, s = 1) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(x - 10 * s, y - 4 * s, 20 * s, 6 * s, 2 * s);
  ctx.roundRect(x - 5 * s, y - 8 * s, 10 * s, 5 * s, 2 * s);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - 5.5 * s, y + 2.5 * s, 2.4 * s, 0, Math.PI * 2);
  ctx.arc(x + 5.5 * s, y + 2.5 * s, 2.4 * s, 0, Math.PI * 2);
  ctx.fill();
}

/** A sheet of paper with lines: an unpaid invoice. */
export function invoice(ctx: CanvasRenderingContext2D, c: Colours, x: number, y: number, colour: string) {
  ctx.fillStyle = c.paper;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.rect(x - 6, y - 8, 12, 15);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  for (const dy of [-4, -1, 2]) {
    ctx.moveTo(x - 3, y + dy);
    ctx.lineTo(x + 3, y + dy);
  }
  ctx.stroke();
}

export function coin(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Eases shown values towards targets; calls draw each frame until settled. */
export function tween(values: () => number[], set: (v: number[]) => void, draw: () => void) {
  let shown: number[] | null = null;
  let frame = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  return () => {
    const target = values();
    if (!shown || reduce.matches || shown.length !== target.length) {
      shown = target.slice();
      set(shown);
      draw();
      return;
    }
    cancelAnimationFrame(frame);
    const step = () => {
      let moving = false;
      shown = shown!.map((v, i) => {
        const next = v + (target[i] - v) * 0.2;
        if (Math.abs(target[i] - next) < 0.01) return target[i];
        moving = true;
        return next;
      });
      set(shown);
      draw();
      if (moving) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };
}
