import type { PersonName } from '@/types';
import type { Rng } from '@/engine/rng';
import { HERITAGES, namePools, type Heritage } from '@/content/names';

export type Era = 'older' | 'younger';

/** Rough heritage mix of the US diocesan presbyterate. Invented weights. */
export const CLERGY_HERITAGE: Record<Heritage, number> = {
  irish: 3,
  italian: 2,
  polish: 1.5,
  german: 1.5,
  anglo: 1,
  mexican: 1,
  central_american: 0.3,
  caribbean: 0.3,
  filipino: 0.5,
  vietnamese: 0.5,
  korean: 0.2,
  african_american: 0.3,
  nigerian: 0.3,
  indian: 0.3,
  lebanese: 0.2,
};

export function eraForBirthYear(year: number): Era {
  return year < 1976 ? 'older' : 'younger';
}

export function rollHeritage(rng: Rng, weights: Record<string, number>): Heritage {
  const keys = HERITAGES.filter((h) => (weights[h] ?? 0) > 0);
  if (keys.length === 0) return rng.pick(HERITAGES);
  return rng.weighted(keys, (h) => weights[h] ?? 0);
}

export function rollMaleName(rng: Rng, heritage: Heritage, era: Era): PersonName {
  const pool = namePools[heritage];
  return { first: rng.pick(pool.first[era]), last: rng.pick(pool.last) };
}

export function rollFemaleName(rng: Rng, heritage: Heritage, last?: string): PersonName {
  const pool = namePools[heritage];
  return { first: rng.pick(pool.women), last: last ?? rng.pick(pool.last) };
}

export function rollSurname(rng: Rng, heritage: Heritage): string {
  return rng.pick(namePools[heritage].last);
}
