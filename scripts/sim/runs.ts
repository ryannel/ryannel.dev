// Stage 1 spike: run the toy company under each choice and print tables.
// node scripts/sim/runs.ts
import { run, defaults, type Choices, type Result } from '../../src/lib/company-sim.ts';

const SEEDS = Number(process.env.SEEDS ?? 60);
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const f = (x: number, d = 0) => (Number.isFinite(x) ? x.toFixed(d) : '∞');

function many(size: number, c: Choices) {
  const rs: Result[] = [];
  for (let seed = 1; seed <= SEEDS; seed++) rs.push(run(size, c, seed));
  const tt = (k: keyof Result['teaTime']) => mean(rs.map((r) => r.teaTime[k]));
  const pt = (k: keyof Result['paidTime']) => mean(rs.map((r) => r.paidTime[k]));
  return {
    tea50: pct(rs.map((r) => r.tea), 0.5),
    tea85: pct(rs.map((r) => r.tea), 0.85),
    work: tt('work'),
    queue: tt('queue'),
    decision: tt('decision'),
    handoff: tt('handoff'),
    rework: tt('rework'),
    people: mean(rs.map((r) => r.teaPeople)),
    allergen50: rs[0].allergen === undefined ? NaN : pct(rs.map((r) => r.allergen!), 0.5),
    onTime: rs[0].allergen === undefined ? NaN : rs.filter((r) => r.allergen! <= 45).length / rs.length,
    profit: mean(rs.map((r) => r.profit)),
    payroll: mean(rs.map((r) => r.payroll)),
    lead: pct(rs.map((r) => r.lead), 0.5),
    lost: mean(rs.map((r) => r.lost)),
    staff: rs[0].people,
    util: mean(rs.map((r) => r.utilisation)),
    backlog: mean(rs.map((r) => r.backlog)),
    otherDays: mean(rs.map((r) => r.otherDays)),
    paidWork: pt('work'),
    paidRework: pt('rework'),
    paidMeet: pt('meetings'),
    paidIdle: pt('idle'),
  };
}

const header = '| Choice | Tea p50 / p85 days | Work · queue · decision · handoff · rework | People on tea | Allergen p50 · on time | Profit/day | Office staff | Paid time: work · redo · meetings · idle | Other work p50 lead | Value lost |';
const sep = '|---|---|---|---|---|---|---|---|---|---|';
const row = (label: string, m: ReturnType<typeof many>) =>
  `| ${label} | ${f(m.tea50, 1)} / ${f(m.tea85, 1)} | ${f(m.work, 1)} · ${f(m.queue, 1)} · ${f(m.decision, 1)} · ${f(m.handoff, 1)} · ${f(m.rework, 1)} | ${f(m.people)} | ${Number.isNaN(m.allergen50) ? '–' : `${f(m.allergen50)} · ${f(m.onTime * 100)}%`} | ${f(m.profit)} | ${m.staff} | ${f(m.paidWork * 100)} · ${f(m.paidRework * 100)} · ${f(m.paidMeet * 100)} · ${f(m.paidIdle * 100)}% | ${f(m.lead, 1)} | ${f(m.lost * 100)}% |`;

const out: string[] = [];
out.push(`Seeds per row: ${SEEDS}. Defaults: ${JSON.stringify(defaults)}.\n`);
out.push('## Growing (defaults at every size)\n', header, sep);
for (const size of [1, 2, 5, 12]) out.push(row(`${size} café${size > 1 ? 's' : ''}`, many(size, defaults)));

out.push('\n## Where the money goes (defaults; per day)\n');
out.push('| Size | Takings | Café staff | Food | Rent and other | Office staff pay | Value from changes | Profit | Staff as share of takings | Office share of staff pay | Office staff | Paid office time: work · redo · meetings · idle |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const size of [1, 2, 5, 12]) {
  const rs = Array.from({ length: SEEDS }, (_, i) => run(size, defaults, i + 1));
  const m = (g: (r: Result) => number) => mean(rs.map(g));
  const c = rs[0].costs;
  const pay = m((r) => r.payroll);
  const pt = (k: keyof Result['paidTime']) => f(m((r) => r.paidTime[k]) * 100);
  out.push(`| ${size} | ${f(c.revenue)} | ${f(c.cafeWages)} | ${f(c.food)} | ${f(c.other)} | ${f(pay)} | ${f(m((r) => r.value))} | ${f(m((r) => r.profit))} | ${f(((c.cafeWages + pay) / c.revenue) * 100)}% | ${f((pay / (c.cafeWages + pay || 1)) * 100)}% | ${rs[0].people} | ${pt('work')} · ${pt('rework')} · ${pt('meetings')} · ${pt('idle')}% |`);
}

const layers: [string, keyof Choices, (string | number)[]][] = [
  ['1. Split the work', 'split', ['one', 'specialist']],
  ['2. Who decides', 'decide', ['local', 'escalate-big', 'escalate-unsure']],
  ['3. How often the seniors meet', 'meet', [7, 14, 30]],
  ['4. How busy teams are kept', 'busy', ['slack', 'lean']],
];
const layer5: [string, keyof Choices, (string | number)[]] = ['5. Allergen labelling arrives', 'priority', ['fit', 'drop', 'project']];
for (const [title, key, options] of layers) {
  out.push(`\n## ${title} (a dozen cafés; other choices at defaults)\n`, header, sep);
  for (const o of options) out.push(row(String(o), many(12, { ...defaults, [key]: o } as Choices)));
}
{
  const [title, key, options] = layer5;
  const base = many(12, { ...defaults, priority: 'none' });
  out.push(`\n## ${title} (a dozen cafés; other choices at defaults)\n`);
  out.push('Knock-on: extra days spent by ordinary work arriving days 130–230, against the same company with no allergen project.\n');
  out.push(header.replace(' |\n', ' |') + ' Knock-on (work-days) |', sep + '---|');
  out.push(row('no project', base) + ' 0 |');
  for (const o of options) {
    const m = many(12, { ...defaults, [key]: o } as Choices);
    out.push(row(String(o), m) + ` ${f(m.otherDays - base.otherDays)} |`);
  }
}
console.log(out.join('\n'));
