/**
 * What the canvas figures in notes/why-big-companies-are-slow share: a seeded
 * PRNG so each picture is the same on every visit, the page's colours resolved
 * for the current theme, a canvas sized to its box, and a switch that runs the
 * animation only while the figure is on screen.
 */

/** A small deterministic PRNG. */
export const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** An exponentially distributed draw with the given mean. */
export const exp = (rand: () => number, mean: number) =>
  -Math.log(1 - rand()) * mean;

export interface Colours {
  paper: string;
  ink: string;
  muted: string;
  rule: string;
  accent: string;
  strong: string;
  font: string;
}

/**
 * The page's colours, light or dark, kept current as the theme changes;
 * light-dark() is resolved on a real element. `redraw` runs after each change.
 */
export function theme(figure: HTMLElement, redraw: () => void): Colours {
  const probe = document.createElement("span");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  figure.append(probe);
  const colours: Colours = {
    paper: "",
    ink: "",
    muted: "",
    rule: "",
    accent: "",
    strong: "",
    font: "",
  };
  const read = () => {
    const s = getComputedStyle(document.documentElement);
    const resolve = (name: string) => {
      probe.style.color = s.getPropertyValue(name).trim();
      return getComputedStyle(probe).color;
    };
    colours.paper = resolve("--paper");
    colours.ink = resolve("--ink");
    colours.muted = resolve("--ink-muted");
    colours.rule = resolve("--rule");
    colours.accent = resolve("--accent");
    colours.strong = resolve("--accent-strong");
    colours.font = s.getPropertyValue("--font-ui").trim();
  };
  read();
  const change = () => {
    read();
    redraw();
  };
  new MutationObserver(change).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", change);
  return colours;
}

/**
 * Keeps the canvas's pixels matched to its box. The drawing is done in a
 * W × H space that `layout` chooses for the canvas's width, so a figure can
 * lay itself out differently on a phone; `px` turns CSS pixels into that
 * space, for text and lines.
 */
export function fit(
  canvas: HTMLCanvasElement,
  layout: (width: number) => { W: number; H: number },
  redraw: () => void,
) {
  const ctx = canvas.getContext("2d")!;
  const view = { scale: 1, px: 1, W: 1000, H: 600 };
  const size = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth || 1000;
    Object.assign(view, layout(w));
    canvas.style.aspectRatio = `${view.W} / ${view.H}`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round((w * view.H * dpr) / view.W);
    view.scale = (w / view.W) * dpr;
    view.px = view.W / w;
  };
  size();
  new ResizeObserver(() => {
    size();
    redraw();
  }).observe(canvas);
  /** Clears to paper and sets up the W × H space. */
  const clear = (paper: string) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
  };
  return { ctx, view, clear };
}

/** Below this width, in CSS pixels, figures use their narrow layout. */
export const NARROW = 560;

export const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Calls `tick(dt)` every frame, with dt in milliseconds, while the figure is
 * on screen and motion is allowed. Returns a function that draws one frame now,
 * for a figure that is still.
 */
export function animate(figure: HTMLElement, tick: (dt: number) => void) {
  let raf: number | undefined;
  let last = 0;
  const frame = (t: number) => {
    const dt = last ? Math.min(64, t - last) : 16;
    last = t;
    tick(dt);
    raf = requestAnimationFrame(frame);
  };
  if (reducedMotion()) return;
  new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !raf) {
          last = 0;
          raf = requestAnimationFrame(frame);
        } else if (!e.isIntersecting && raf) {
          cancelAnimationFrame(raf);
          raf = undefined;
        }
      }
    },
    { threshold: 0.2 },
  ).observe(figure);
}

/** Text with a paper halo, so it reads over lines. */
export function label(
  ctx: CanvasRenderingContext2D,
  c: Colours,
  px: number,
  text: string,
  x: number,
  y: number,
  colour: string,
  align: CanvasTextAlign = "center",
) {
  ctx.textAlign = align;
  ctx.lineJoin = "round";
  ctx.lineWidth = 3 * px;
  ctx.strokeStyle = c.paper;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
}

/** A hex colour made lighter (amt > 0) or darker, as rgb(). */
export const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
};

/** A shaded ball, squashed by `sq` (1 is round, < 1 flattened). */
export function ball(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  hex: string,
  sq = 1,
) {
  const w = r / Math.sqrt(sq);
  const h = r * sq;
  const g = ctx.createRadialGradient(x - w * 0.35, y - h * 0.4, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, shade(hex, 0.22));
  g.addColorStop(1, shade(hex, -0.06));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Owner colours shared by the figures: [light theme, dark theme]. */
export const HUES = {
  purchasing: ["#5fa8a0", "#6fc2b8"],
  factory: ["#6f97cf", "#86acdf"],
  warehouses: ["#9a88d6", "#b1a2e6"],
  logistics: ["#d585ad", "#e6a0c2"],
  sales: ["#86b766", "#9fcd80"],
  website: ["#8e9cb0", "#a9b5c6"],
  ours: ["#ec8a3c", "#f4a35e"],
} as const;
export type Hue = keyof typeof HUES;

/** True when the page is dark, judged from the resolved paper colour. */
export const isDark = (c: Colours) => {
  const m = c.paper.match(/\d+/g);
  return m ? Number(m[0]) + Number(m[1]) + Number(m[2]) < 300 : false;
};
