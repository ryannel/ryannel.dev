/**
 * The model behind SlowLanes: identical teams, each a lane with one person and
 * a pile of work that comes and goes at random but never quite runs out. Most work belongs to one team; some is coupled, split into
 * chips that land in several lanes at once and ship only when every chip is
 * done. The more teams there are, the likelier any piece of work is to need
 * another one. Two ways to handle coupled work:
 *
 *  - align first: nobody starts a coupled chip until every team involved has
 *    reached its part and agreed how it fits. Someone who reaches their part
 *    first waits a little for the others, then puts it aside and gets on with
 *    something else. Agreeing takes time, but little goes wrong.
 *  - integrate later: everyone starts as soon as they reach their part, and
 *    finished parts wait for the rest. The longer the parts were made apart,
 *    the likelier they don't fit, and one goes back to be redone.
 *
 * Every rate is invented; the point is the shape. Queues are kept in order of
 * arrival, so the oldest work goes first.
 */

/** A small deterministic PRNG; the same as canvas.ts's, kept here so the model runs outside a browser. */
const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const STEP = 0.02; // simulated days per step

export const rules = {
  /**
   * Work turns up for each team at random, about as fast as one person can do it. A team whose
   * pile runs out finds something of its own to do, so nobody is idle; a pile that is full turns
   * new work away. And work's mean size in person-days.
   */
  arrivals: 0.95,
  pileMax: 10,
  effort: 1,
  /** Chance that a new piece of work also needs any one other team. */
  touch: 0.12,
  /** Splitting work across teams adds this much to it. */
  split: 1.2,
  /** Align first: days each team spends agreeing, per other team involved. */
  align: 0.06,
  /** How long someone waits for the other teams before putting their part aside. */
  patience: 0.2,
  /** Chance a coupled item doesn't fit together: aligned, or integrated later (base + per day its parts finished apart). */
  misfitAligned: 0.04,
  misfitBase: 0.15,
  misfitPerDay: 0.12,
  misfitMax: 0.8,
  /** Share of a part's work done again when it doesn't fit, and the chance each other part has to change too. */
  redo: 1,
  alsoBack: 0.5,
};

export type Mode = 'align' | 'later';
export type State = 'queued' | 'holding' | 'aside' | 'aligning' | 'working' | 'parked' | 'gone';
export type Use = 'work' | 'align' | 'blocked' | 'rework' | 'idle';

export interface Chip {
  item: Item;
  team: number;
  left: number;
  effort: number;
  state: State;
  rework: boolean;
  /** Align first: this part has been agreed and still needs its share of the agreeing time. */
  toAlign: number;
  alignLeft: number;
  holdUntil: number;
  doneAt: number;
  // For drawing.
  x: number;
  y: number;
  alpha: number;
  flash: number;
}

export interface Item {
  id: number;
  born: number;
  chips: Chip[];
  hue: number;
  aligned: boolean;
  checked: boolean;
}

export const coupledShare = (teams: number) => 1 - (1 - rules.touch) ** (teams - 1);
const fresh = (): Record<Use, number> => ({ work: 0, align: 0, blocked: 0, rework: 0, idle: 0 });

export class Lanes {
  R = rules;
  mode: Mode;
  teams = 0;
  t = 0;
  ids = 0;
  rand = mulberry(7);
  queues: Chip[][] = [];
  serving: (Chip | null)[] = [];
  aside: Chip[][] = [];
  parked: Chip[][] = [];
  items: Item[] = [];
  /** Chips of shipped items, for drawing them on their way out. */
  leaving: Chip[] = [];
  /** Per team, days spent on each use, fading so it shows how things are now. */
  use: Record<Use, number>[] = [];
  shipped: { at: number; days: number; coupled: boolean }[] = [];
  history: { t: number; shipped: number; alone: number; teams: number }[] = [];
  nextSample = 0;
  onArrive?: (c: Chip) => void;

  constructor(teams: number, mode: Mode, seed = 7) {
    this.mode = mode;
    this.rand = mulberry(seed);
    for (let i = 0; i < teams; i++) this.addTeam();
  }

  addTeam() {
    this.teams++;
    this.queues.push([]);
    this.serving.push(null);
    this.aside.push([]);
    this.parked.push([]);
    this.use.push(fresh());
  }

  private gamma2(mean: number) {
    return (-Math.log(1 - this.rand()) - Math.log(1 - this.rand())) * (mean / 2);
  }

  /** Keeps a queue in order of arrival. */
  private enqueue(c: Chip) {
    const q = this.queues[c.team];
    let i = q.length;
    while (i > 0 && q[i - 1].item.id > c.item.id) i--;
    q.splice(i, 0, c);
    c.state = 'queued';
  }

  private arrive(home: number) {
    const R = this.R;
    const lanes = [home];
    for (let j = 0; j < this.teams; j++) if (j !== home && this.rand() < R.touch) lanes.push(j);
    const total = this.gamma2(R.effort) * (lanes.length > 1 ? R.split : 1);
    const item: Item = { id: this.ids++, born: this.t, chips: [], hue: this.rand(), aligned: lanes.length === 1, checked: false };
    for (const team of lanes) {
      const effort = total / lanes.length;
      const chip: Chip = { item, team, left: effort, effort, state: 'queued', rework: false, toAlign: 0, alignLeft: 0, holdUntil: 0, doneAt: 0, x: 0, y: 0, alpha: 0, flash: 0 };
      item.chips.push(chip);
      this.onArrive?.(chip);
      this.enqueue(chip);
    }
    this.items.push(item);
  }

  private ship(item: Item) {
    for (const c of item.chips) {
      this.parked[c.team] = this.parked[c.team].filter((p) => p !== c);
      c.state = 'gone';
      this.leaving.push(c);
    }
    this.items = this.items.filter((i) => i !== item);
    this.shipped.push({ at: this.t, days: this.t - item.born, coupled: item.chips.length > 1 });
    if (this.shipped.length > 600) this.shipped.shift();
  }

  /** A part is finished: park it, and if it was the last, see whether the item fits together. */
  private finish(c: Chip) {
    const R = this.R;
    this.serving[c.team] = null;
    c.state = 'parked';
    c.doneAt = this.t;
    this.parked[c.team].push(c);
    const item = c.item;
    if (!item.chips.every((x) => x.state === 'parked')) return;
    if (item.chips.length === 1) return this.ship(item);
    const times = item.chips.map((x) => x.doneAt);
    const apart = Math.max(...times) - Math.min(...times);
    // Parts made apart are likelier not to fit; a part that was redone was made to fit, so only the base risk is left.
    const misfit = item.aligned ? R.misfitAligned : item.checked ? R.misfitBase : Math.min(R.misfitMax, R.misfitBase + R.misfitPerDay * apart);
    item.checked = true;
    if (this.rand() < misfit) {
      // At least one part goes back, and each of the others is as likely as not to need changing too.
      const first = Math.floor(this.rand() * item.chips.length);
      item.chips.forEach((back, i) => {
        if (i !== first && this.rand() >= R.alsoBack) return;
        this.parked[back.team] = this.parked[back.team].filter((p) => p !== back);
        back.left = back.effort * R.redo;
        back.rework = true;
        back.flash = 1;
        this.enqueue(back);
      });
    } else this.ship(item);
  }

  /** Align first: once every part has been reached, the item is agreed, and its parts go back to the front of their piles. */
  private agree(item: Item) {
    item.aligned = true;
    for (const c of item.chips) {
      c.toAlign = this.R.align * (item.chips.length - 1);
      if (c.state === 'holding') {
        c.state = 'aligning';
        c.alignLeft = c.toAlign;
        c.toAlign = 0;
      } else if (c.state === 'aside') {
        this.aside[c.team] = this.aside[c.team].filter((a) => a !== c);
        this.enqueue(c);
      }
    }
  }

  step() {
    const R = this.R;
    for (let i = 0; i < this.teams; i++) {
      const pile = this.queues[i].length;
      if ((pile < R.pileMax && this.rand() < R.arrivals * STEP) || (pile === 0 && !this.serving[i])) this.arrive(i);
    }

    // Free people pick up the next part in their pile.
    for (let i = 0; i < this.teams; i++) {
      if (this.serving[i] || !this.queues[i].length) continue;
      const c = this.queues[i].shift()!;
      this.serving[i] = c;
      if (this.mode === 'align' && !c.item.aligned) {
        c.state = 'holding';
        c.holdUntil = this.t + R.patience;
        if (c.item.chips.every((x) => x.state === 'holding' || x.state === 'aside')) this.agree(c.item);
      } else if (c.toAlign > 0) {
        c.state = 'aligning';
        c.alignLeft = c.toAlign;
        c.toAlign = 0;
      } else c.state = 'working';
    }

    // Everyone works for a step, and the time is counted by what they were doing.
    for (let i = 0; i < this.teams; i++) {
      const c = this.serving[i];
      let u: Use = 'idle';
      if (c?.state === 'holding') {
        u = 'blocked';
        if (this.t >= c.holdUntil) {
          c.state = 'aside';
          this.aside[i].push(c);
          this.serving[i] = null;
        }
      } else if (c?.state === 'aligning') {
        u = 'align';
        c.alignLeft -= STEP;
        if (c.alignLeft <= 0) c.state = 'working';
      } else if (c?.state === 'working') {
        u = c.rework ? 'rework' : 'work';
        c.left -= STEP;
        if (c.left <= 0) this.finish(c);
      }
      this.use[i][u] += STEP;
    }
    this.t += STEP;

    if (this.t >= this.nextSample) {
      this.nextSample = this.t + 1;
      const span = Math.min(15, this.t);
      const recent = this.shipped.filter((s) => s.at > this.t - span).length;
      this.history.push({ t: this.t, shipped: span > 1 ? recent / span : 0, alone: this.teams / R.effort, teams: this.teams });
      if (this.history.length > 240) this.history.shift();
      for (const u of this.use) for (const k of Object.keys(u) as Use[]) u[k] *= 0.96;
    }
  }

  run(days: number) {
    const end = this.t + days;
    while (this.t < end) this.step();
  }

  /** All teams' time together, as shares. */
  time() {
    const sum = fresh();
    for (const u of this.use) for (const k of Object.keys(sum) as Use[]) sum[k] += u[k];
    const total = Object.values(sum).reduce((a, v) => a + v, 0) || 1;
    for (const k of Object.keys(sum) as Use[]) sum[k] /= total;
    return sum;
  }

  waiting() {
    return this.queues.reduce((a, q) => a + q.length, 0) + this.aside.reduce((a, q) => a + q.length, 0);
  }
}
