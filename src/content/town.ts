import raw from './town.json';
import type { TownPlaceKind, TownPlaceState } from '@/types';

/** A kind of place a town can have, with what it is called and what it says. DESIGN §8.9. */
export interface TownArchetype {
  kind: TownPlaceKind;
  /** "the diner": the word for it when no place of the kind exists. */
  plain: string;
  owner: boolean;
  terrains: Record<string, number>;
  names: string[];
  blurbs: string[];
  lines: Record<TownPlaceState, string[]>;
  /** Share of the parish's households a closure costs and an opening brings. */
  households?: { closed: number; new: number };
  change: { fail: number; recover: number; close: number; thrive: number; settle: number };
}

export interface TownContent {
  count: { min: number; max: number };
  streets: string[];
  archetypes: TownArchetype[];
  initial: { thriving: number; failing: number };
  regard: { words: [number, string][] };
  review: Partial<Record<TownPlaceState, string>>;
}

export const townContent = raw as unknown as TownContent;
export const townArchetypes: TownArchetype[] = townContent.archetypes;

export function townArchetype(kind: TownPlaceKind): TownArchetype {
  const def = townArchetypes.find((a) => a.kind === kind);
  if (!def) throw new Error(`no town archetype ${kind}`);
  return def;
}
