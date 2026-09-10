import { describe, it, expect } from 'vitest';
import { createRng, restoreRng } from '@/engine/rng';

describe('engine/rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng('alpha');
    const b = createRng('alpha');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    const a = createRng('alpha');
    const b = createRng('beta');
    expect(a.next()).not.toBe(b.next());
  });

  it('restores an exact stream from saved state', () => {
    const a = createRng('gamma');
    for (let i = 0; i < 7; i++) a.next();
    const state = JSON.parse(JSON.stringify(a.getState()));
    const b = restoreRng('gamma', state);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('int() is inclusive on both ends and covers the range', () => {
    const rng = createRng('int');
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(rng.int(1, 6));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('weighted() never returns a zero-weight item and respects proportions', () => {
    const rng = createRng('weighted');
    const items = [
      { id: 'a', w: 0 },
      { id: 'b', w: 1 },
      { id: 'c', w: 3 },
    ];
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 4000; i++) counts[rng.weighted(items, (x) => x.w).id]!++;
    expect(counts.a).toBe(0);
    expect(counts.c! / counts.b!).toBeGreaterThan(2.4);
    expect(counts.c! / counts.b!).toBeLessThan(3.6);
  });

  it('weighted() throws when every weight is zero', () => {
    const rng = createRng('w0');
    expect(() => rng.weighted([1, 2], () => 0)).toThrow();
  });

  it('shuffle() is a permutation and does not mutate its input', () => {
    const rng = createRng('shuffle');
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = rng.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((x, y) => x - y)).toEqual(input);
  });

  it('derive() yields independent but reproducible streams', () => {
    const root1 = createRng('root');
    const root2 = createRng('root');
    const d1 = root1.derive('classmates');
    const d2 = root2.derive('classmates');
    const other = root1.derive('parishes');
    expect(d1.next()).toBe(d2.next());
    expect(d1.next()).not.toBe(other.next());
    // Deriving does not consume the parent stream.
    expect(root1.next()).toBe(root2.next());
  });

  it('gaussian() has roughly zero mean and unit variance', () => {
    const rng = createRng('gauss');
    const n = 5000;
    let sum = 0;
    let sq = 0;
    for (let i = 0; i < n; i++) {
      const g = rng.gaussian();
      sum += g;
      sq += g * g;
    }
    const mean = sum / n;
    const variance = sq / n - mean * mean;
    expect(Math.abs(mean)).toBeLessThan(0.08);
    expect(Math.abs(variance - 1)).toBeLessThan(0.12);
  });
});
