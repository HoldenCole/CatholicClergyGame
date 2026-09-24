import type { GameState } from '@/types';
import type { Rng } from '@/engine/rng';
import { seasonOf } from '@/engine/time';
import houseLife from '@/content/religious/houseLife.json';
import { currentHouse } from './house';

/**
 * The house around him: one line most weeks, from content/religious/houseLife.json,
 * as a parish's week carries a line of the place around the pastor. The pools
 * are the house's season, its kind, and his stage (formation or priest);
 * a line the Record still shows from the last few weeks is not said again.
 */
export const HOUSE_LIFE = {
  /** The chance a week carries a line of the house. Invented. */
  chance: 0.75,
  /** Weeks of the Record a line must be absent from before it is said again. */
  memoryWeeks: 12,
} as const;

const POOLS = houseLife as unknown as Record<string, string[]>;

/** Every house line, so the Record can file them with the parish's ambient lines. */
export const HOUSE_LIFE_LINES: readonly string[] = Object.entries(POOLS).filter(([k]) => k !== '_notes').flatMap(([, v]) => v);

export function houseLifeLine(state: GameState, rng: Rng): string | null {
  if (!state.religious || state.study) return null;
  if (!rng.chance(HOUSE_LIFE.chance)) return null;
  const pools: string[][] = [POOLS.any ?? []];
  const season = POOLS[seasonOf(state.clock)];
  if (season) pools.push(season);
  const house = currentHouse(state);
  const kind = house ? POOLS[house.kind] : undefined;
  if (kind) pools.push(kind);
  const stage = POOLS[state.flags.ordained ? 'priest' : 'formation'];
  if (stage) pools.push(stage);
  const recent = new Set(state.digest.slice(-HOUSE_LIFE.memoryWeeks).flatMap((d) => d.lines));
  const pool = rng.pick(pools).filter((l) => !recent.has(l));
  const fallback = pools.flat().filter((l) => !recent.has(l));
  const from = pool.length ? pool : fallback;
  return from.length ? rng.pick(from) : null;
}
