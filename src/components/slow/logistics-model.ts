// Fictional inventory movements. Time is animation time, not real shipping time.
export const DURATION = 20000;
export const initial = { origin: 8, west: 6, north: 5, local: 6, south: 2, customs: 0, main: 0, retail: 0, away: 0 };
export type Location = keyof typeof initial;
export type Movement = { from: Location | null; to: Location | null; at: number; duration: number; kind: 'stock' | 'other' | 'transfer' };
export const movements: Movement[] = [];
const batch = (from: Location | null, to: Location | null, count: number, at: number, spacing: number, duration = 650, kind: Movement['kind'] = 'stock') => {
  for (let i = 0; i < count; i++) movements.push({ from, to, at: at + i * spacing, duration, kind });
};
// The local warehouse empties, borrows from South, then waits for the inbound batch.
batch('local', null, 6, 600, 650, 650, 'other');
batch('south', 'local', 2, 4000, 500, 2500, 'transfer');
batch('local', null, 2, 7400, 500, 650, 'other');
batch('origin', 'main', 8, 200, 200);
batch('main', 'customs', 8, 11000, 150);
batch('customs', 'local', 8, 13500, 180);
batch('local', 'south', 2, 17000, 400, 1300);
batch(null, 'origin', 8, 2600, 2000);
// This boat serves the North depot; its stock is committed to other orders.
batch('west', 'retail', 4, 500, 200, 500, 'other');
batch('retail', 'north', 4, 6500, 200, 500, 'other');
batch('north', null, 4, 8000, 1000, 650, 'other');
batch(null, 'west', 4, 12000, 1000, 700);
// A third shipment leaves for a destination outside the picture.
batch('origin', 'away', 2, 5500, 400, 550, 'other');
batch('away', null, 2, 11000, 300, 550, 'other');
batch(null, 'origin', 2, 18000, 400);

export function networkAt(time: number) {
  const stock = { ...initial };
  const moving: Movement[] = [];
  for (const movement of movements) {
    if (time < movement.at) continue;
    if (movement.from) stock[movement.from]--;
    if (time >= movement.at + movement.duration) {
      if (movement.to) stock[movement.to]++;
    } else moving.push(movement);
  }
  const transfer = moving.find(m => m.kind === 'transfer');
  const source = stock.local > 0 ? 'local' : stock.south > 0 || transfer ? 'south' : time < 11000 ? 'main' : 'customs';
  return { stock, moving, source } as const;
}
