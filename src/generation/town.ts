import type { Parish, Town, TownPlace, TownPlaceKind, TownPlaceState } from '@/types';
import type { Rng } from '@/engine/rng';
import { townArchetype, townArchetypes, townContent, type TownArchetype } from '@/content/town';
import { heritageFor } from './parishPeople';
import { rollSurname } from './names';

/**
 * The town around a parish: five to seven places of distinct kinds, rolled
 * independently from the archetypes the terrain allows, named from pools.
 * The employer, the diner, and the funeral home come first where the
 * terrain has them; the rest are drawn by weight. DESIGN §8.9.
 */
const FIRST: TownPlaceKind[] = ['employer', 'diner', 'funeral_home'];

function townWord(parish: Parish): string {
  return parish.place.replace(/^(the|downtown|east|west|north|south)\s+/i, '').replace(/\s+(county|parish)$/i, '');
}

/** One place, rolled: a name from the archetype's templates, a blurb, a state, an owner where there is one. */
export function rollPlace(rng: Rng, def: TownArchetype, parish: Parish, presetId: string, week: number, id: string, state?: TownPlaceState): TownPlace {
  const surname = () => rollSurname(rng, heritageFor(rng, parish, presetId));
  // The family in the name is the family that runs it; a second surname in a name is another family.
  const family = surname();
  let first = true;
  const name = rng.pick(def.names)
    .replace(/\{surname\}/g, () => { if (first) { first = false; return family; } return surname(); })
    .replace(/\{street\}/g, rng.pick(townContent.streets))
    .replace(/\{town\}/g, townWord(parish));
  const rolled: TownPlaceState = state ?? (rng.chance(townContent.initial.thriving) ? 'thriving' : rng.chance(townContent.initial.failing) ? 'failing' : 'open');
  return {
    id,
    kind: def.kind,
    name,
    blurb: rng.pick(def.blurbs),
    state: rolled,
    sinceWeek: week,
    regard: Math.round(rng.gaussian() * 8),
    ...(def.owner ? { owner: family } : {}),
  };
}

export function generateTown(rng: Rng, parish: Parish, presetId: string, week: number): Town {
  const weightOf = (a: TownArchetype) => a.terrains[parish.terrain] ?? 0;
  const count = rng.int(townContent.count.min, townContent.count.max);
  const chosen: TownArchetype[] = [];
  for (const kind of FIRST) {
    const def = townArchetype(kind);
    if (weightOf(def) > 0 && chosen.length < count) chosen.push(def);
  }
  let rest = townArchetypes.filter((a) => !chosen.includes(a) && weightOf(a) > 0);
  while (chosen.length < count && rest.length) {
    const pick = rng.weighted(rest, weightOf);
    chosen.push(pick);
    rest = rest.filter((a) => a !== pick);
  }
  const places = chosen.map((def, i) => rollPlace(rng.derive(`place:${def.kind}`), def, parish, presetId, week, `${parish.id}_town_${def.kind}_${i}`));
  return { parishId: parish.id, name: parish.place, places, memory: [] };
}
