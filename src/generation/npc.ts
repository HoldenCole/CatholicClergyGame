import type { HiddenTrait, Npc, NpcRole, Origin, Stats, Struggle } from '@/types';
import { HIDDEN_TRAITS } from '@/types';
import type { Rng } from '@/engine/rng';
import { clampSigned } from '@/systems/reputation';
import { emptyStats } from '@/systems/stats';

/** Struggles roll with these weights, independently of everything else. Invented. */
export const STRUGGLE_WEIGHTS: Record<Struggle, number> = {
  none: 3,
  loneliness: 2,
  doubt: 2,
  drink: 1,
  ambition: 1,
  family: 1.5,
  health: 0.5,
  anger: 1,
};

export function rollStruggle(rng: Rng): Struggle {
  const keys = Object.keys(STRUGGLE_WEIGHTS) as Struggle[];
  return rng.weighted(keys, (k) => STRUGGLE_WEIGHTS[k]);
}

export function rollHiddenTrait(rng: Rng): HiddenTrait {
  return rng.pick(HIDDEN_TRAITS);
}

/** Alignment rolls from a wide normal so both wings are common. Independent of stats. */
export function rollAlignment(rng: Rng, mean = 0, sd = 35): number {
  return Math.round(clampSigned(mean + rng.gaussian() * sd));
}

/** Each stat rolls its own base; modifiers are added by the caller. */
export function rollBaseStats(rng: Rng, low = 25, high = 45): Stats {
  const s = emptyStats();
  for (const key of Object.keys(s) as (keyof Stats)[]) s[key] = rng.int(low, high);
  return s;
}

export function addStats(stats: Stats, delta: Partial<Stats>): Stats {
  const out = { ...stats };
  for (const [k, v] of Object.entries(delta) as [keyof Stats, number][]) {
    out[k] = Math.min(100, Math.max(0, out[k] + v));
  }
  return out;
}

export interface NpcSeed {
  id: string;
  name: Npc['name'];
  role: NpcRole;
  title: string;
  birthYear: number;
  origin: Origin;
  stats: Stats;
  tags?: string[];
  alignment?: number;
  relationship?: number;
  ambition?: number;
}

/** Fill in the independently rolled hidden parts of any NPC. */
export function finishNpc(rng: Rng, seed: NpcSeed): Npc {
  return {
    id: seed.id,
    name: seed.name,
    role: seed.role,
    title: seed.title,
    birthYear: seed.birthYear,
    origin: seed.origin,
    alignment: seed.alignment ?? rollAlignment(rng),
    stats: seed.stats,
    ambition: seed.ambition ?? rng.int(5, 95),
    struggle: rollStruggle(rng),
    hiddenTrait: rollHiddenTrait(rng),
    traitKnown: false,
    relationship: seed.relationship ?? Math.round(rng.gaussian() * 8),
    status: 'active',
    tags: seed.tags ?? [],
  };
}
