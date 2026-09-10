/**
 * Name pools, one JSON file per heritage. Generators draw first names from the
 * era bucket matching the NPC's birth year and combine them with a surname from
 * the same heritage; nothing else about the man is tied to the name (DESIGN.md §9.2).
 */

export type Heritage =
  | 'irish'
  | 'italian'
  | 'polish'
  | 'german'
  | 'anglo'
  | 'mexican'
  | 'central_american'
  | 'caribbean'
  | 'filipino'
  | 'vietnamese'
  | 'korean'
  | 'african_american'
  | 'nigerian'
  | 'indian'
  | 'lebanese';

export interface NamePool {
  heritage: Heritage;
  first: {
    /** Men's first names plausible for those born 1940–1975. */
    older: string[];
    /** Men's first names plausible for those born 1976–2005. */
    younger: string[];
  };
  /** Women's first names across both eras (mothers, sisters, lay leaders). */
  women: string[];
  /** Surnames. */
  last: string[];
}

export const HERITAGES: readonly Heritage[] = [
  'irish',
  'italian',
  'polish',
  'german',
  'anglo',
  'mexican',
  'central_american',
  'caribbean',
  'filipino',
  'vietnamese',
  'korean',
  'african_american',
  'nigerian',
  'indian',
  'lebanese',
] as const;

const modules = import.meta.glob<{ default: NamePool }>('./*.json', { eager: true });

const byHeritage = new Map<string, NamePool>(
  Object.values(modules).map((m) => [m.default.heritage, m.default]),
);

function poolFor(heritage: Heritage): NamePool {
  const pool = byHeritage.get(heritage);
  if (!pool) throw new Error(`Missing name pool for heritage "${heritage}"`);
  return pool;
}

export const namePools: Record<Heritage, NamePool> = Object.fromEntries(
  HERITAGES.map((h) => [h, poolFor(h)]),
) as Record<Heritage, NamePool>;
