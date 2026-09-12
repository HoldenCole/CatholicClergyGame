import { withLiturgy } from '@/systems/liturgy';
import type { DiocesePreset, HomeTerrain, Npc, Parish, ParishKind, SchoolStatus } from '@/types';
import type { Rng } from '@/engine/rng';
import { CLERGY_HERITAGE, eraForBirthYear, rollHeritage, rollMaleName } from './names';
import { patronalOf } from './patronal';
import { placeParish } from './geo';
import { addStats, finishNpc, rollAlignment, rollBaseStats } from './npc';

interface KindShape {
  terrain: HomeTerrain;
  households: [number, number];
  wealth: [number, number];
  generational: Parish['generational'][];
  alignmentMean: number;
  condition: [number, number];
  debt: [number, number];
  school: Record<SchoolStatus, number>;
  problems: string[];
  latinoShare: [number, number];
}

/** Each of the five parish kinds has a shape; the numbers roll inside it. Invented. DESIGN.md §9.1 */
const SHAPES: Record<ParishKind, KindShape> = {
  flagship_suburban: {
    terrain: 'suburban',
    households: [2400, 5000],
    wealth: [4, 5],
    generational: ['mixed', 'young', 'aging'],
    alignmentMean: -5,
    condition: [65, 95],
    debt: [0, 800_000],
    school: { open: 5, at_risk: 1, closing: 0, none: 1 },
    problems: ['donor_dependence', 'staff_empire', 'music_war', 'school_tuition', 'pastor_succession'],
    latinoShare: [0, 0.2],
  },
  struggling_urban: {
    terrain: 'urban',
    households: [300, 900],
    wealth: [1, 2],
    generational: ['aging', 'aging', 'mixed'],
    alignmentMean: 5,
    condition: [20, 55],
    debt: [200_000, 1_500_000],
    school: { open: 1, at_risk: 3, closing: 2, none: 3 },
    problems: ['roof', 'merger_rumor', 'boiler', 'empty_convent', 'neighborhood_change'],
    latinoShare: [0.1, 0.5],
  },
  immigrant_growing: {
    terrain: 'latino',
    households: [1500, 4500],
    wealth: [1, 3],
    generational: ['young', 'young', 'mixed'],
    alignmentMean: 0,
    condition: [40, 75],
    debt: [100_000, 1_200_000],
    school: { open: 2, at_risk: 2, closing: 0, none: 4 },
    problems: ['too_many_masses', 'immigration_fear', 'hall_too_small', 'anglo_remnant', 'sacramental_backlog'],
    latinoShare: [0.6, 0.95],
  },
  rural: {
    terrain: 'rural',
    households: [200, 700],
    wealth: [2, 3],
    generational: ['aging', 'mixed'],
    alignmentMean: -15,
    condition: [45, 85],
    debt: [0, 200_000],
    school: { open: 1, at_risk: 1, closing: 0, none: 6 },
    problems: ['mission_churches', 'no_priest_nearby', 'farm_crisis', 'cemetery', 'young_people_leaving'],
    latinoShare: [0, 0.4],
  },
  difficult: {
    terrain: 'urban',
    households: [500, 1800],
    wealth: [2, 4],
    generational: ['mixed', 'aging'],
    alignmentMean: 0,
    condition: [30, 70],
    debt: [400_000, 2_500_000],
    school: { open: 2, at_risk: 3, closing: 1, none: 2 },
    problems: ['predecessor_left_badly', 'divided_congregation', 'lawsuit', 'staff_theft', 'tlm_faction'],
    latinoShare: [0.05, 0.5],
  },
};

export interface GeneratedParish {
  parish: Parish;
  pastor: Npc;
}

function rangeInt(rng: Rng, [a, b]: [number, number]): number {
  return rng.int(a, b);
}

/** One parish from a seed, with its pastor. */
export function generateParish(rng: Rng, preset: DiocesePreset, seed: DiocesePreset['parishSeeds'][number], index: number, year: number): GeneratedParish {
  const shape = SHAPES[seed.kind];
  const id = `parish_${index + 1}`;
  const households = rangeInt(rng, shape.households);
  const wealth = rangeInt(rng, shape.wealth);
  const latino = Math.min(1, rng.float(shape.latinoShare[0], shape.latinoShare[1]) * (0.5 + preset.latinoShare));
  const heritageRest = rollHeritageMix(rng, preset.heritage, 1 - latino);
  const ethnic: Record<string, number> = { ...heritageRest };
  if (latino > 0.02) ethnic.latino = round2(latino);
  const school = rng.weighted(Object.keys(shape.school) as SchoolStatus[], (s) => shape.school[s]);
  const condition = () => rangeInt(rng, shape.condition);
  const collections = Math.round(households * (0.35 + wealth * 0.12) * rng.float(8, 14));

  const pastorAge = rng.int(38, 78);
  const pastorBirth = year - pastorAge;
  const pastor = finishNpc(rng, {
    id: `pastor_${index + 1}`,
    name: rollMaleName(rng, rollHeritage(rng, { ...CLERGY_HERITAGE, ...preset.heritage }), eraForBirthYear(pastorBirth)),
    role: 'priest',
    title: seed.cathedral || rng.chance(0.15) ? 'Msgr.' : 'Fr.',
    birthYear: pastorBirth,
    origin: rng.pick(['urban_ethnic', 'rural', 'suburban', 'latino_immigrant', 'convert', 'lapsed'] as const),
    stats: addStats(rollBaseStats(rng, 25, 60), { administration: rng.int(-10, 20), piety: rng.int(-5, 15) }),
    tags: [`pastor:${id}`, 'pastor'],
    alignment: rollAlignment(rng, shape.alignmentMean + preset.dispositionBias * 0.3, 30),
    relationship: 0,
  });

  const name = seed.real?.name ?? rng.pick(seed.patrons);
  // Where it sits: a real church where it stands, a rolled one near its named place, the cathedral at the center.
  const terrain = seed.cathedral ? 'urban' : shape.terrain;
  const place = seed.real?.place ?? rng.pick(seed.places);
  const at = placeParish(rng, preset, { real: seed.real, place, terrain, ...(seed.cathedral ? { cathedral: true } : {}) });
  const parish: Parish = {
    id,
    name,
    x: at.x,
    y: at.y,
    place,
    ...(seed.real ? { founded: seed.real.founded } : {}),
    kind: seed.kind,
    patronal: patronalOf(name, id),
    terrain,
    households: seed.cathedral ? Math.max(households, 2400) : households,
    wealth: seed.cathedral ? 5 : wealth,
    ethnic,
    generational: rng.pick(shape.generational),
    needsSpanish: latino >= 0.3,
    alignment: rollAlignment(rng, shape.alignmentMean + preset.dispositionBias * 0.3, 25),
    buildings: {
      church: condition(),
      rectory: condition(),
      hall: condition(),
      school: school === 'none' ? null : condition(),
    },
    debt: Math.round(rng.float(shape.debt[0], shape.debt[1]) / 1000) * 1000,
    weeklyCollections: collections,
    assessment: Math.round(collections * 52 * 0.1),
    school,
    pastorId: pastor.id,
    staffIds: [],
    groupIds: [],
    problem: rng.pick(shape.problems),
    ...(seed.cathedral ? { cathedral: true, school: 'none' as const, buildings: { church: rangeInt(rng, [70, 95]), rectory: condition(), hall: condition(), school: null } } : {}),
  };
  return { parish, pastor };
}

function rollHeritageMix(rng: Rng, weights: Record<string, number>, total: number): Record<string, number> {
  // Two or three dominant heritages, jittered.
  const keys = Object.keys(weights).filter((k) => !['mexican', 'central_american', 'caribbean'].includes(k));
  const chosen = rng.shuffle(keys.filter((k) => (weights[k] ?? 0) > 0.6)).slice(0, rng.int(2, 3));
  const raw = chosen.map((k) => (weights[k] ?? 1) * rng.float(0.5, 1.5));
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  const out: Record<string, number> = {};
  chosen.forEach((k, i) => (out[k] = round2(((raw[i] ?? 0) / sum) * total)));
  return out;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * The parishes of the diocese: the real churches by name, and the rolled ones
 * spread across the kinds, no two with the same name in the same place.
 * DESIGN.md §9.1
 */
export function generateParishes(rng: Rng, preset: DiocesePreset, year: number): GeneratedParish[] {
  const taken = new Set(preset.parishSeeds.filter((s) => s.real).map((s) => `${s.real!.name}|${s.real!.place}`));
  return preset.parishSeeds.map((seed, i) => {
    let made = generateParish(rng, preset, seed, i, year);
    for (let tries = 0; !seed.real && taken.has(`${made.parish.name}|${made.parish.place}`) && tries < 6; tries++) {
      const renamed = rng.pick(seed.patrons);
      const moved = rng.pick(seed.places);
      const at = placeParish(rng, preset, { place: moved, terrain: made.parish.terrain });
      made = { ...made, parish: { ...made.parish, name: renamed, place: moved, x: at.x, y: at.y, patronal: patronalOf(renamed, made.parish.id) } };
    }
    taken.add(`${made.parish.name}|${made.parish.place}`);
    return { ...made, parish: withLiturgy(rng.derive(`mass:${made.parish.id}`), made.parish) };
  });
}

export const PROBLEM_LABEL: Record<string, string> = {
  donor_dependence: 'One family gives a third of the collection and knows it.',
  staff_empire: 'A parish staff that has run the place through three pastors.',
  music_war: 'The music director and the choir are at war, and the pastor has picked a side.',
  school_tuition: 'A school that costs more each year than the families can pay.',
  pastor_succession: 'A pastor near retirement whom no one wants to follow.',
  roof: 'A roof that has been patched for a decade and cannot be patched again.',
  merger_rumor: 'A rumor, probably true, that the parish is on a list.',
  boiler: 'A boiler older than the pastor, and a winter coming.',
  empty_convent: 'A convent with two sisters left and forty rooms.',
  neighborhood_change: 'A neighborhood that has changed faster than the parish.',
  too_many_masses: 'Seven Masses on a Sunday and two priests.',
  immigration_fear: 'Families who have stopped coming because the parking lot is watched.',
  hall_too_small: 'A hall built for two hundred and a parish of two thousand.',
  anglo_remnant: 'An old guard that founded everything and is now a hundred people in a church of thousands.',
  sacramental_backlog: 'Baptisms and quinceañeras booked a year out.',
  mission_churches: 'Two mission churches, forty miles apart, each certain it is the real parish.',
  no_priest_nearby: 'The nearest brother priest is an hour away, and he is seventy-nine.',
  farm_crisis: 'A bad year on the farms, and the collection shows it.',
  cemetery: 'A cemetery that is the parish’s largest asset and its largest argument.',
  young_people_leaving: 'The young leave for the city and come back only to be buried.',
  predecessor_left_badly: 'A predecessor who left under a cloud nobody will describe.',
  divided_congregation: 'A congregation split down the middle over the last pastor.',
  lawsuit: 'A lawsuit, civil, that names the parish.',
  staff_theft: 'Money missing from an account the pastor did not know existed.',
  tlm_faction: 'A Latin Mass community that is either the parish’s future or its problem, depending on who is asked.',
};
