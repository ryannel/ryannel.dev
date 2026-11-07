// Headless runs of the lanes prototype: node scripts/sim/lanes.ts
import { Lanes, type Mode } from '../../src/components/slow/lanes-model.ts';

const SEEDS = Number(process.env.SEEDS ?? 10);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
console.log('| Teams | Mode | Shipped vs alone | Lead p50 | p85 | Working · aligning · blocked · redo · idle | Waiting |');
console.log('|---|---|---|---|---|---|---|');
for (const n of [1, 2, 4, 6, 8, 10])
  for (const mode of ['align', 'later'] as Mode[]) {
    const rs: { ratio: number; p50: number; p85: number; time: Record<string, number>; waiting: number }[] = [];
    for (let s = 1; s <= SEEDS; s++) {
      const l = new Lanes(n, mode, s);
      l.run(200);
      const recent = l.shipped.filter((x) => x.at > 100);
      const ds = recent.map((x) => x.days).sort((a, b) => a - b);
      rs.push({ ratio: recent.length / 100 / (n / l.R.effort), p50: ds[Math.floor(ds.length / 2)], p85: ds[Math.floor(ds.length * 0.85)], time: l.time(), waiting: l.waiting() });
    }
    const tm = (k: string) => (mean(rs.map((r) => r.time[k])) * 100).toFixed(0);
    console.log(`| ${n} | ${mode} | ${(mean(rs.map((r) => r.ratio)) * 100).toFixed(0)}% | ${mean(rs.map((r) => r.p50)).toFixed(1)} | ${mean(rs.map((r) => r.p85)).toFixed(1)} | ${tm('work')} · ${tm('align')} · ${tm('blocked')} · ${tm('rework')} · ${tm('idle')} | ${mean(rs.map((r) => r.waiting)).toFixed(0)} |`);
  }
