/**
 * Geometry and colour shared by the system map and the scripts that light it.
 * Lives apart from the component so client scripts can import it too.
 */
import type { Service } from '../data/human-in-the-loop';

export const MAP_W = 640;
export const MAP_H = 400;
export const BOX_W = 122;
export const BOX_H = 44;

/** Light tints that stay distinct on paper and on dark paper. */
export const tint = (hue: number) => `light-dark(hsl(${hue} 55% 60%), hsl(${hue} 45% 55%))`;

/** A contract leaves the edge of one box and arrives at the edge of the other. */
export function edge(a: Service, b: Service) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const horizontal = Math.abs(dx) > Math.abs(dy);
  const sx = horizontal ? Math.sign(dx) * (BOX_W / 2) : 0;
  const sy = horizontal ? 0 : Math.sign(dy) * (BOX_H / 2);
  return { x1: a.x + sx, y1: a.y + sy, x2: b.x - sx, y2: b.y - sy };
}

/** Set or clear one of the map's state classes on every matching element. */
export function mark(root: ParentNode, selector: string, cls: string, on: boolean) {
  for (const el of root.querySelectorAll(selector)) el.classList.toggle(cls, on);
}

/** Clear every state class the figures use, on the map and in any list beside it. */
export function clearStates(root: ParentNode) {
  for (const el of root.querySelectorAll('.is-lit, .is-dim, .is-active')) {
    el.classList.remove('is-lit', 'is-dim', 'is-active');
  }
}
