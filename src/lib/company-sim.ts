/**
 * A toy company for the "why big companies are slow" sandbox. Work arrives,
 * needs a decision, then passes through one or more teams in order; teams
 * are pools of people with a queue in front. The reader's choices change how
 * the company is split, who decides, how often the senior people meet, how
 * busy teams are kept, and how a company-wide project is prioritised.
 *
 * Every rate here is invented. What the model is for is the shape of each
 * trade-off, not its size. It is stepped in tenths of a day from a seed, so
 * the same choices and seed give the same run.
 */

export type Split = 'one' | 'specialist';
export type Decide = 'local' | 'escalate-big' | 'escalate-unsure';
export type Busy = 'slack' | 'lean';
export type Priority = 'none' | 'fit' | 'drop' | 'project';

export interface Choices {
  split: Split;
  decide: Decide;
  /** Days between meetings of the senior group. */
  meet: number;
  busy: Busy;
  priority: Priority;
}

export const defaults: Choices = { split: 'specialist', decide: 'escalate-big', meet: 14, busy: 'lean', priority: 'fit' };

interface Size {
  cafes: number;
  /** Teams that do the company's change work, and how likely each is to be needed. */
  teams: { name: string; weight: number }[];
  /** Pieces of work arriving per day, how many teams each needs on average, and person-days per step. */
  arrivals: number;
  reach: number;
  effort: number;
  /** Mean value of a piece of work if shipped at once; it fades while waiting. */
  value: number;
  /** A café's day: takings, and what its own staff, food and everything else cost. */
  till: Till;
  /** The stall: one owner, part of whose day is free for anything but serving. */
  owner?: number;
  /** How often decisions that go up are made, if not by a senior group: the owner at lunch. */
  lunch?: boolean;
  /** The probe change, tea, as stages of steps; steps in a stage run side by side. */
  tea: { team: string; effort: number }[][];
  /** A company-wide project with a deadline, allergen labelling; only at a dozen cafés. */
  allergen?: { team: string; effort: number }[][];
}

interface Till {
  revenue: number;
  wages: number;
  food: number;
  other: number;
}

/**
 * A café's day, roughly in the proportions of UK chains' filed accounts:
 * staff about 35% of takings, food and packaging about 29%, rent and the
 * rest about 24%. The stall's owner takes no wage; what is left is theirs.
 */
const shop: Till = { revenue: 5000, wages: 1750, food: 1450, other: 1200 };

export const sizes: Record<number, Size> = {
  1: {
    cafes: 1,
    teams: [{ name: 'Owner', weight: 1 }],
    arrivals: 0.15,
    reach: 1,
    effort: 1,
    value: 400,
    till: { revenue: 900, wages: 0, food: 280, other: 370 },
    owner: 0.35,
    lunch: true,
    tea: [[{ team: 'Owner', effort: 0.5 }]],
  },
  2: {
    cafes: 2,
    teams: [
      { name: 'Owner', weight: 2 },
      { name: 'Cafés', weight: 1 },
      { name: 'Finance', weight: 1 },
    ],
    arrivals: 0.6,
    reach: 1.4,
    effort: 1.5,
    value: 1000,
    till: shop,
    lunch: true,
    tea: [[{ team: 'Owner', effort: 0.5 }], [{ team: 'Cafés', effort: 0.3 }]],
  },
  5: {
    cafes: 5,
    teams: [
      { name: 'Head office', weight: 1.5 },
      { name: 'Buying', weight: 1 },
      { name: 'Finance', weight: 1 },
      { name: 'People', weight: 0.7 },
      { name: 'Marketing', weight: 0.7 },
      { name: 'Cafés', weight: 2 },
    ],
    arrivals: 1.8,
    reach: 2,
    effort: 1.5,
    value: 1000,
    till: shop,
    tea: [
      [{ team: 'Buying', effort: 0.5 }],
      [{ team: 'Finance', effort: 0.3 }],
      [
        { team: 'Marketing', effort: 0.5 },
        { team: 'Cafés', effort: 0.5 },
      ],
    ],
  },
  12: {
    cafes: 12,
    teams: [
      { name: 'Head office', weight: 1 },
      { name: 'Buying', weight: 1.5 },
      { name: 'Finance', weight: 1.5 },
      { name: 'People', weight: 1 },
      { name: 'IT', weight: 2.5 },
      { name: 'Marketing', weight: 1.5 },
      { name: 'Warehouse', weight: 1 },
      { name: 'App', weight: 1.5 },
      { name: 'Customer service', weight: 0.7 },
      { name: 'Legal', weight: 0.5 },
      { name: 'Cafés', weight: 3 },
    ],
    arrivals: 5.4,
    reach: 2.8,
    effort: 1.5,
    value: 1000,
    till: shop,
    tea: [
      [{ team: 'Buying', effort: 1 }],
      [{ team: 'Finance', effort: 0.5 }],
      [{ team: 'IT', effort: 1 }],
      [
        { team: 'Marketing', effort: 1 },
        { team: 'Cafés', effort: 1 },
        { team: 'App', effort: 0.5 },
      ],
      [{ team: 'IT', effort: 0.5 }],
    ],
    allergen: [
      [{ team: 'Buying', effort: 25 }],
      [
        { team: 'IT', effort: 30 },
        { team: 'App', effort: 20 },
        { team: 'Marketing', effort: 20 },
      ],
      [{ team: 'Cafés', effort: 40 }],
      [{ team: 'IT', effort: 15 }],
    ],
  },
};

/** The rules, in one place, so the page can show them. */
export const rules = {
  dt: 0.1,
  /** Share of work that is a one-way door: hard to undo. */
  oneWay: 0.12,
  /** How fast unshipped value fades, in days: competitors get there first. */
  fade: 60,
  /** Target utilisation for each busy choice; teams are staffed to hit it. */
  utilisation: { slack: 0.7, lean: 0.9 } as Record<Busy, number>,
  /** Pay per office person per day. */
  pay: 150,
  /** Time lost passing work from one team to another. */
  handoff: 0.5,
  /** One big team: everyone a generalist, and talk grows with the team. */
  generalist: 1.25,
  chatter: 0.012,
  /** Chance of a bad decision. Local decisions see only their own part. */
  badLocal: { oneWay: [0.1, 0.4], twoWay: [0.05, 0.15] },
  badMeeting: { oneWay: 0.08, twoWay: 0.04 },
  /** Chance of sending a decision up, by policy and kind. */
  escalate: {
    local: { oneWay: 0, twoWay: 0, twoWayWide: 0 },
    'escalate-big': { oneWay: 0.8, twoWay: 0.15, twoWayWide: 0.15 },
    'escalate-unsure': { oneWay: 0.95, twoWay: 0.1, twoWayWide: 0.4 },
  } as Record<Decide, { oneWay: number; twoWay: number; twoWayWide: number }>,
  /** Decisions one meeting can get through, and the days it costs each senior person: preparing, meeting, and passing the outcome on. */
  agenda: 40,
  meetingCost: 1.25,
  /** What a bad decision costs: share of value kept, and share of the work done again. */
  badOutcome: { oneWay: { keep: 0.3, redo: 1 }, twoWay: { keep: 0.85, redo: 0.3 } },
  /** Allergen labelling must be done this many days after it starts; after that, the cafés lose this share of their margin each day, because unlabelled food can't be sold. */
  deadline: 45,
  latePenalty: 0.15,
  /** Staffing allows for rework and meetings, and no team is planned above this. */
  overhead: 1.08,
  ceiling: 0.97,
  /** A big piece of work is shared out in chunks of about this many person-days. */
  chunk: 2.5,
  /** Up to this many cafés, the office is a handful of people who cover for each other. */
  pooled: 5,
  /** A project team pulls up to this many people from each team the project needs, and works a little slower at first. */
  projectPull: 2,
  projectSpeed: 0.8,
  /** Dropping everything for the project: work put down is picked up again with this many days lost. */
  switchCost: 0.5,
};

/** A small deterministic PRNG. */
export const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Kind = 'work' | 'tea' | 'allergen';
type Phase = 'decision' | 'queue' | 'work' | 'handoff';

interface Step {
  team: number;
  effort: number;
  left: number;
  state: 'waiting' | 'queued' | 'serving' | 'done';
  /** When it can join its team's queue, after a handoff. */
  ready: number;
}

interface Item {
  id: number;
  kind: Kind;
  born: number;
  value: number;
  oneWay: boolean;
  /** How many teams it needs; local decisions see one of them. */
  reach: number;
  stages: Step[][];
  stage: number;
  /** Waiting for a decision until this is set. */
  decided: boolean;
  bad: boolean;
  escalated: boolean;
  reworked: boolean;
  finished?: number;
  /** For the probes: time by what was happening. */
  time?: Record<Phase | 'rework', number>;
  people?: number;
  priority: boolean;
}

interface Team {
  name: string;
  servers: number;
  /** Person-days of work done per person per day. */
  speed: number;
  queue: Step[];
  owners: Map<Step, Item>;
  serving: Step[];
  /** People away at the senior meeting until this time. */
  awayUntil: number;
}

export interface Result {
  /** Days for tea from idea to on sale, and where they went. */
  tea: number;
  teaTime: Record<Phase | 'rework', number>;
  teaPeople: number;
  /** Days for allergen labelling, if it ran. */
  allergen?: number;
  /** Profit per day over the measured window, and its parts. */
  profit: number;
  value: number;
  payroll: number;
  /** The cafés' takings and costs per day; the office's are payroll. */
  costs: { revenue: number; cafeWages: number; food: number; other: number };
  /** Median days for ordinary work to ship, and the share of value lost to waiting and bad calls. */
  lead: number;
  lost: number;
  people: number;
  utilisation: number;
  /** Decisions waiting for the senior group when tea starts. */
  backlog: number;
  /** Total days that ordinary work arriving around the project spent waiting and being done, for measuring the knock-on. */
  otherDays: number;
  /** Where office people's paid days went over the window, as shares: work, rework, meetings, idle. */
  paidTime: { work: number; rework: number; meetings: number; idle: number };
}

export function run(size: number, choices: Choices, seed = 1): Result {
  const S = sizes[size];
  const rand = mulberry(seed * 9973 + size);
  // The probes draw from their own stream, so ordinary work is the same with or without them.
  const prand = mulberry(seed * 7919 + size + 1);
  const R = rules;
  const gamma2 = (mean: number) => (-Math.log(1 - rand()) - Math.log(1 - rand())) * (mean / 2);

  // Teams, staffed so that their expected load sits at the chosen utilisation.
  const names = S.teams.map((t) => t.name);
  const wsum = S.teams.reduce((a, t) => a + t.weight, 0);
  const n = names.length;
  const q = n > 1 ? (S.reach - 1) / (n - 1) : 0;
  const target = R.utilisation[choices.busy];
  const merge = n > 2 && (choices.split === 'one' || S.cafes <= R.pooled);
  const teams: Team[] = [];
  const teamOf = new Map<string, number>();
  const make = (name: string, servers: number, speed: number) => {
    teamOf.set(name, teams.length);
    teams.push({ name, servers, speed, queue: [], owners: new Map(), serving: [], awayUntil: 0 });
  };
  // People needed for a load at a speed: aim for the target, never plan above the ceiling.
  const staff = (load: number, speed = 1) => {
    const need = (load * R.overhead) / speed;
    let m = Math.max(1, Math.round(need / target));
    while (need / m > R.ceiling) m++;
    return m;
  };
  if (S.owner) make('Owner', 1, S.owner);
  else {
    const load = (w: number) => (S.arrivals * S.effort * (1 + q * (n - 1)) * w) / wsum;
    if (merge) {
      // Everyone but the cafés in one team: no handoffs, but generalists who talk more.
      // Talk depends on headcount and headcount on speed, so settle the two together.
      const office = S.teams.filter((t) => t.name !== 'Cafés');
      const total = office.reduce((a, t) => a + load(t.weight), 0);
      let people = staff(total);
      let speed = 1;
      for (let i = 0; i < 20; i++) {
        speed = 1 / R.generalist / (1 + R.chatter * (people - 1));
        people = staff(total, speed);
      }
      make('Office', people, speed);
      for (const t of office) teamOf.set(t.name, 0);
      const cafes = S.teams.find((t) => t.name === 'Cafés');
      if (cafes) make('Cafés', staff(load(cafes.weight)), 1);
    } else for (const t of S.teams) make(t.name, staff(load(t.weight)), 1);
  }
  const people = teams.reduce((a, t) => a + t.servers, 0) - (S.owner ? 1 : 0);
  const seniors = new Set(teams.map((_, i) => i)).size;

  const items: Item[] = [];
  let ids = 0;
  const stepsFor = (spec: { team: string; effort: number }[][]) =>
    spec
      .map((stage) =>
        stage.flatMap((s) => {
          // A big job is shared out among the team, a chunk each.
          const parts = Math.max(1, Math.round(s.effort / R.chunk));
          return Array.from({ length: parts }, () => ({ team: teamOf.get(s.team)!, effort: s.effort / parts, left: s.effort / parts, state: 'waiting' as const, ready: 0 }));
        }),
      )
      .reduce<Step[][]>((out, stage) => {
        // Consecutive stages in the same single team are one piece of work for it.
        const last = out[out.length - 1];
        if (last && last.length === 1 && stage.length === 1 && last[0].team === stage[0].team) {
          last[0].effort += stage[0].effort;
          last[0].left += stage[0].effort;
        } else out.push(stage);
        return out;
      }, []);

  const arrive = (t: number, kind: Kind) => {
    let stages: Step[][];
    let reach: number;
    let oneWay: boolean;
    if (kind === 'work') {
      // Which teams this piece of work needs, in the order it needs them.
      let k = 1;
      for (let i = 1; i < n; i++) if (rand() < q) k++;
      const pool = S.teams.map((x) => ({ ...x }));
      const chosen: string[] = [];
      while (chosen.length < k) {
        let r = rand() * pool.reduce((a, x) => a + x.weight, 0);
        const i = pool.findIndex((x) => (r -= x.weight) <= 0);
        chosen.push(pool.splice(i < 0 ? pool.length - 1 : i, 1)[0].name);
      }
      stages = stepsFor(chosen.map((name) => [{ team: name, effort: gamma2(S.effort) }]));
      reach = k;
      oneWay = rand() < R.oneWay;
    } else {
      stages = stepsFor(kind === 'tea' ? S.tea : S.allergen!);
      reach = new Set(stages.flat().map((s) => s.team)).size;
      oneWay = size >= 5;
    }
    const item: Item = {
      id: ids++,
      kind,
      born: t,
      value: kind === 'work' ? gamma2(S.value) : 0,
      oneWay,
      reach,
      stages,
      stage: 0,
      decided: false,
      bad: false,
      escalated: false,
      reworked: false,
      priority: kind === 'allergen' && choices.priority === 'drop',
      time: kind === 'work' ? undefined : { decision: 0, queue: 0, work: 0, handoff: 0, rework: 0 },
      people: 0,
    };
    // Who decides. The stall and two cafés decide at lunch; bigger, by policy.
    const p = R.escalate[choices.decide];
    const r = kind === 'work' ? rand : prand;
    const goUp = S.lunch ? reach > 1 || oneWay : r() < (oneWay ? p.oneWay : reach > 1 ? p.twoWayWide : p.twoWay);
    if (goUp) {
      item.escalated = true;
      upward.push(item);
    } else {
      const share = 1 - 1 / reach;
      const [a, b] = oneWay ? R.badLocal.oneWay : R.badLocal.twoWay;
      item.bad = S.owner ? false : r() < a + b * share;
      decide(item, t);
      item.people! += 1;
    }
    items.push(item);
    return item;
  };

  const upward: Item[] = [];
  const decide = (item: Item, t: number) => {
    item.decided = true;
    start(item, t);
  };
  const start = (item: Item, t: number) => {
    for (const s of item.stages[item.stage]) {
      s.state = 'waiting';
      s.ready = t + (item.stage > 0 && !merge ? R.handoff : 0);
    }
  };

  // A project team for allergen labelling: one person from each team it needs.
  let project: Team | undefined;
  let lent: number[] = [];

  const value = { delivered: 0, possible: 0 };
  const leads: number[] = [];
  let payroll = 0;
  let busySum = 0;
  let busyN = 0;
  const paid = { work: 0, rework: 0, meetings: 0, idle: 0 };
  const window = [60, 260];
  // Tea turns up on an ordinary day, wherever that falls between meetings.
  const teaAt = 150 + prand() * 28;
  const allergenAt = 140;
  let tea: Item | undefined;
  let allergen: Item | undefined;
  let backlog = 0;
  let late = 0;
  let nextMeeting = choices.meet;

  for (let t = 0; t < 400; t += R.dt) {
    // Arrivals.
    if (rand() < S.arrivals * R.dt) arrive(t, 'work');
    if (S.allergen && !allergen && t >= allergenAt && choices.priority !== 'none') {
      allergen = arrive(t, 'allergen');
      if (choices.priority === 'project') {
        const needed = new Set(allergen.stages.flat().map((s) => s.team));
        for (const i of needed)
          for (let k = 0; k < R.projectPull && teams[i].servers > 1; k++) {
            teams[i].servers--;
            lent.push(i);
          }
        project = { name: 'Project', servers: lent.length, speed: R.projectSpeed, queue: [], owners: new Map(), serving: [], awayUntil: 0 };
        teams.push(project);
        const pi = teams.length - 1;
        for (const st of allergen.stages) for (const s of st) s.team = pi;
      }
    }
    if (!tea && t >= teaAt) {
      backlog = upward.length;
      tea = arrive(t, 'tea');
    }

    // Decisions that went up: at lunch every day, or at the senior meeting.
    if (S.lunch) {
      if (Math.floor(t + R.dt) > Math.floor(t)) {
        for (const item of upward.splice(0)) {
          item.bad = false;
          decide(item, t);
          item.people! += 1;
        }
      }
    } else if (t >= nextMeeting) {
      nextMeeting += choices.meet;
      for (const team of teams) if (team !== project) team.awayUntil = t + R.meetingCost;
      for (const item of upward.splice(0, R.agenda)) {
        item.bad = (item.kind === 'work' ? rand : prand)() < (item.oneWay ? R.badMeeting.oneWay : R.badMeeting.twoWay);
        decide(item, t);
        item.people! += seniors;
      }
    }

    // Steps whose handoff is over join their team's queue; priority work goes to the front.
    for (const item of items) {
      if (item.finished !== undefined || !item.decided) continue;
      for (const s of item.stages[item.stage]) {
        if (s.state === 'waiting' && t >= s.ready) {
          s.state = 'queued';
          const team = teams[s.team];
          team.owners.set(s, item);
          if (item.priority) team.queue.unshift(s);
          else team.queue.push(s);
        }
      }
    }

    // Teams work. A senior away at the meeting takes one person out for the time.
    for (const team of teams) {
      const capacity = team.servers - (t < team.awayUntil && team.servers > 0 ? 1 : 0);
      // Dropping everything: project work waiting takes a person off ordinary work, who loses time picking it up again.
      if (choices.priority === 'drop')
        while (team.queue.length && team.owners.get(team.queue[0])!.priority && team.serving.length >= capacity) {
          const i = team.serving.findIndex((x) => !team.owners.get(x)!.priority);
          if (i < 0) break;
          const [put] = team.serving.splice(i, 1);
          put.state = 'queued';
          put.left += R.switchCost;
          const at = team.queue.findIndex((x) => !team.owners.get(x)!.priority);
          team.queue.splice(at < 0 ? team.queue.length : at, 0, put);
        }
      while (team.serving.length < capacity && team.queue.length) {
        const s = team.queue.shift()!;
        s.state = 'serving';
        team.serving.push(s);
        team.owners.get(s)!.people! += 1;
      }
      busySum += Math.min(team.serving.length, capacity) / Math.max(1, team.servers);
      busyN++;
      if (t >= window[0] && t < window[1] && team.name !== 'Owner') {
        const active = team.serving.slice(0, Math.max(0, capacity));
        const redo = active.filter((s) => team.owners.get(s)!.reworked).length;
        const away = team.servers - capacity;
        paid.rework += redo * R.dt;
        paid.work += (active.length - redo) * R.dt;
        paid.meetings += away * R.dt;
        paid.idle += Math.max(0, capacity - active.length) * R.dt;
      }
      for (const s of team.serving.slice(0, Math.max(0, capacity))) s.left -= team.speed * R.dt;
      for (const s of team.serving.filter((x) => x.left <= 0)) {
        s.state = 'done';
        team.serving.splice(team.serving.indexOf(s), 1);
      }
    }

    // Items move on when a whole stage is done; at the end, a bad call comes back as rework.
    for (const item of items) {
      if (item.finished !== undefined || !item.decided) continue;
      if (!item.stages[item.stage].every((s) => s.state === 'done')) continue;
      if (item.stage < item.stages.length - 1) {
        item.stage++;
        start(item, t);
        continue;
      }
      if (item.bad && !item.reworked) {
        const o = item.oneWay ? R.badOutcome.oneWay : R.badOutcome.twoWay;
        item.reworked = true;
        item.value *= o.keep;
        for (const st of item.stages) for (const s of st) s.left = s.effort * o.redo;
        if (o.redo > 0) {
          item.stage = 0;
          start(item, t);
          continue;
        }
      }
      item.finished = t;
      if (item === allergen && project) {
        // The project is done: its people go back to their teams.
        for (const i of lent) teams[i].servers++;
        lent = [];
        project.servers = 0;
      }
      if (item.kind === 'work' && t >= window[0] && t < window[1]) {
        const kept = item.value * Math.exp(-(t - item.born) / R.fade);
        value.delivered += kept;
        leads.push(t - item.born);
      }
    }
    for (const item of items) if (item.kind === 'work' && item.born >= window[0] && item.born < window[1] && item.born + R.dt > t && item.born <= t) value.possible += item.value;

    // Where the probes' time goes, by the most hopeful thing happening to them.
    for (const item of [tea, allergen]) {
      if (!item || item.finished !== undefined) continue;
      const steps = item.stages[item.stage];
      const phase: Phase = !item.decided
        ? 'decision'
        : steps.some((s) => s.state === 'serving')
          ? 'work'
          : steps.some((s) => s.state === 'waiting' && t < s.ready)
            ? 'handoff'
            : 'queue';
      item.time![item.reworked ? 'rework' : phase] += R.dt;
    }

    if (t >= window[0] && t < window[1]) {
      payroll += people * R.pay * R.dt;
      if (allergen && allergen.finished === undefined && t - allergen.born > R.deadline) late += R.dt;
    }
    if (tea?.finished !== undefined && (!S.allergen || allergen?.finished !== undefined || t > 380) && t >= window[1]) break;
  }

  leads.sort((a, b) => a - b);
  const days = window[1] - window[0];
  const till = S.till;
  const margin = S.cafes * (till.revenue - till.wages - till.food - till.other);
  return {
    tea: tea!.finished !== undefined ? tea!.finished - tea!.born : Infinity,
    teaTime: tea!.time!,
    teaPeople: tea!.people!,
    allergen: allergen ? (allergen.finished !== undefined ? allergen.finished - allergen.born : Infinity) : undefined,
    profit: margin + (value.delivered - payroll - late * margin * R.latePenalty) / days,
    value: value.delivered / days,
    payroll: payroll / days,
    costs: { revenue: S.cafes * till.revenue, cafeWages: S.cafes * till.wages, food: S.cafes * till.food, other: S.cafes * till.other },
    lead: leads.length ? leads[Math.floor(leads.length / 2)] : NaN,
    lost: value.possible ? 1 - value.delivered / value.possible : 0,
    people,
    utilisation: busySum / busyN,
    backlog,
    otherDays: items.filter((i) => i.kind === 'work' && i.born >= 130 && i.born < 230).reduce((a, i) => a + ((i.finished ?? 400) - i.born), 0),
    paidTime: (() => {
      const total = paid.work + paid.rework + paid.meetings + paid.idle || 1;
      return { work: paid.work / total, rework: paid.rework / total, meetings: paid.meetings / total, idle: paid.idle / total };
    })(),
  };
}
