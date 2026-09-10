import seedrandom from 'seedrandom';
import type { RngState } from '@/types';

/**
 * The single source of randomness for game logic. Wraps `seedrandom` so the
 * stream can be saved and restored exactly. Never call Math.random() in
 * /engine, /systems, or /generation — see CLAUDE.md rule 2.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], inclusive on both ends. */
  int(min: number, max: number): number;
  /** Uniform float in [min, max). */
  float(min: number, max: number): number;
  /** True with probability `p`. */
  chance(p: number): boolean;
  /** One element, uniformly. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** One element, weighted. Zero-weight items are never chosen. Throws if total weight is 0. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T;
  /** A shuffled copy (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[];
  /** Approximately normal, mean 0, sd 1 (Box–Muller). */
  gaussian(): number;
  /** A derived, independent stream. Same seed + same label = same stream. */
  derive(label: string): Rng;
  /** Serializable state for the save file. */
  getState(): RngState;
  readonly seed: string;
}

function wrap(seed: string, prng: seedrandom.StatefulPRNG<seedrandom.State.Arc4>): Rng {
  const rng: Rng = {
    seed,
    next: () => prng(),
    int(min, max) {
      if (max < min) throw new Error(`rng.int: max ${max} < min ${min}`);
      return min + Math.floor(prng() * (max - min + 1));
    },
    float: (min, max) => min + prng() * (max - min),
    chance: (p) => prng() < p,
    pick(items) {
      if (items.length === 0) throw new Error('rng.pick: empty array');
      return items[Math.floor(prng() * items.length)] as (typeof items)[number];
    },
    weighted(items, weight) {
      let total = 0;
      for (const item of items) total += Math.max(0, weight(item));
      if (total <= 0) throw new Error('rng.weighted: total weight is 0');
      let roll = prng() * total;
      for (const item of items) {
        const w = Math.max(0, weight(item));
        if (w === 0) continue;
        roll -= w;
        if (roll < 0) return item;
      }
      // Floating-point tail: return the last positively weighted item.
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i] as (typeof items)[number];
        if (weight(item) > 0) return item;
      }
      throw new Error('rng.weighted: unreachable');
    },
    shuffle(items) {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(prng() * (i + 1));
        const tmp = out[i] as (typeof out)[number];
        out[i] = out[j] as (typeof out)[number];
        out[j] = tmp;
      }
      return out;
    },
    gaussian() {
      let u = 0;
      let v = 0;
      while (u === 0) u = prng();
      while (v === 0) v = prng();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    derive: (label) => createRng(`${seed}::${label}`),
    getState: () => prng.state(),
  };
  return rng;
}

/** A fresh stream from a seed string. */
export function createRng(seed: string): Rng {
  return wrap(seed, seedrandom(seed, { state: true }));
}

/** A stream resumed from a saved state. */
export function restoreRng(seed: string, state: RngState): Rng {
  return wrap(seed, seedrandom('', { state: state as seedrandom.State.Arc4 }));
}
